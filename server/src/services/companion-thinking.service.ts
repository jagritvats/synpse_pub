import { v4 as uuidv4 } from "uuid";
import ThinkingRecord, {
  IThinkingRecord,
} from "../models/thinking-record.model";
import {
  ChatMessageModel,
  MessageRole,
  MessageStatus,
} from "../models/chat.model";
import { aiService } from "./ai.service";
import { companionStateService } from "./companion-state.service";
import { contextService } from "./context.service";
import { memoryService } from "./memory.service";
import { summaryService } from "./summary.service";
import { loggerFactory } from "../utils/logger.service";
import { ContextType } from "../interfaces/context-type.enum";
import { ContextDuration } from "../interfaces/context-duration.enum";
import { databaseService } from "../config/mongodb";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
// import { SseResponseHelper } from "../utils/sse-response-helper";
// import { getUserThinking } from "./productivity/thinking.service";
import { messageProducerService } from "./kafka/message-producer.service";
import { sseConnections } from "../controllers/chat.controller";
import { modelEnum } from "../constants/models";

// Thought categories - imported from companion-state.service
export type ThoughtCategory =
  | "observation"
  | "reflection"
  | "plan"
  | "question"
  | "insight";

// Psychological insights structure
export interface PsychologicalInsight {
  id: string;
  userId: string;
  analysis: string;
  subconscious: string; // Deeper level psychological understanding
  topics: string[];
  sentiment: "positive" | "negative" | "neutral";
  timestamp: Date;
}

// AI meta-thinking output
export interface AIMetaThinking {
  insights: PsychologicalInsight;
  goalUpdates: {
    newGoals: Array<{ goal: string; priority: number; reason: string }>;
    updatedGoals: Array<{
      goal: string;
      newPriority: number;
      reason: string;
    }>;
    removedGoals: Array<{ goal: string; reason: string }>;
  };
  strategy: string; // How AI plans to guide the conversation
}

// Session analysis cache entry
interface SessionAnalysisCache {
  sessionId: string;
  userId: string;
  lastAnalysisTime: Date;
  insight: PsychologicalInsight | null;
  goals: Array<{ goal: string; priority: number; progress: number }>;
  strategy: string;
  processingInProgress: boolean;
}

// Define cache structure
interface ThoughtCacheEntry {
  timestamp: number; // When the analysis was created
  thoughts: string[]; // The recorded thoughts
  userInput: string; // The user input that triggered the thoughts
  userId: string; // User ID for reference
  messageId?: string; // Optional message ID for reference
}

/**
 * CompanionThinkingService handles the AI's meta-cognitive processes
 * including psychological analysis, goal management, and strategic planning
 */
class CompanionThinkingService {
  private logger = loggerFactory.getLogger("CompanionThinkingService");
  private enabled: boolean = true; // Flag to enable/disable thinking service
  private cacheLifetime: number = 60 * 60 * 1000; // Cache entries for 1 hour
  private cache: Map<string, ThoughtCacheEntry[]> = new Map(); // sessionId -> thought entries
  private forceSync: boolean = false; // Force synchronous processing (for testing)
  private notifyClients: boolean = true; // Whether to notify clients of state changes via SSE

  // Cache for recent session analyses to prevent duplicate processing
  private sessionAnalysisCache: Map<string, SessionAnalysisCache> = new Map();

  // Minimum time between analyses for the same session (in milliseconds)
  private minTimeBetweenAnalyses: number = 60000; // 1 minute

  // Track currently processing sessions to prevent duplicate analysis requests
  private sessionsBeingProcessed: Set<string> = new Set();

  constructor() {
    // Start periodic cleanup of cache
    setInterval(() => this.cleanupSessionCache(), 30 * 60 * 1000); // Run every 30 minutes
    this.logger.info(
      "CompanionThinkingService initialized with caching and async processing"
    );

    // Set defaults from environment if available
    this.enabled = process.env.DISABLE_COMPANION_THINKING !== "true";
    this.forceSync = process.env.FORCE_SYNC_THINKING === "true";
    this.notifyClients = process.env.DISABLE_THINKING_NOTIFICATIONS !== "true";
  }

  /**
   * Clean up old entries from the session analysis cache
   */
  private cleanupSessionCache(): void {
    const now = new Date();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours

    let removedCount = 0;

    for (const [sessionId, cacheEntry] of this.sessionAnalysisCache.entries()) {
      const age = now.getTime() - cacheEntry.lastAnalysisTime.getTime();

      if (age > maxAge) {
        this.sessionAnalysisCache.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.info(
        `Cleaned up ${removedCount} expired entries from session analysis cache`
      );
    }
  }

  /**
   * Store a thinking record in the database
   */
  private async storeThinkingRecord(
    userId: string,
    sessionId: string,
    insight: PsychologicalInsight,
    goals: Array<{ goal: string; priority: number; progress: number }>,
    strategy: string,
    messageId?: string,
    metadata?: Record<string, any>
  ): Promise<IThinkingRecord | null> {
    const startTime = Date.now();
    try {
      // First check if database is connected
      if (!databaseService.isConnected()) {
        // Try to connect if not already connected
        try {
          this.logger.info(
            `Database not connected, attempting connection before storing thinking record`
          );
          await databaseService.connect();

          // Verify connection was successful
          if (!databaseService.isConnected()) {
            this.logger.error(
              `Failed to connect to database after attempt, cannot store thinking record`
            );
            return null;
          }

          this.logger.info(
            `Successfully connected to database for storing thinking record`
          );
        } catch (connectionError) {
          this.logger.error(
            `Failed to connect to database for storing thinking record: ${connectionError}`
          );
          return null;
        }
      }

      // Create a new thinking record document
      const thinkingRecord = new ThinkingRecord({
        userId,
        sessionId,
        analysis: insight.analysis,
        subconscious: insight.subconscious,
        topics: insight.topics,
        sentiment: insight.sentiment,
        goals,
        strategy,
        timestamp: new Date(),
        messageId,
        metadata: {
          ...metadata,
          storageTimestamp: new Date().toISOString(),
          analysisLength: insight.analysis.length,
          strategyLength: strategy.length,
          goalsCount: goals.length,
        },
      });

      this.logger.debug(`Saving thinking record to database...`);
      await thinkingRecord.save();

      const elapsedTime = Date.now() - startTime;
      this.logger.info(
        `Successfully stored thinking record in database for user ${userId}, session ${sessionId} in ${elapsedTime}ms, record ID: ${thinkingRecord._id}`
      );
      return thinkingRecord;
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      this.logger.error(
        `Failed to store thinking record in database after ${elapsedTime}ms: ${error}`
      );

      if (error instanceof Error) {
        this.logger.error(`Error details: ${error.stack}`);
      }

      return null;
    }
  }

  /**
   * Get the most recent thinking record for a session
   */
  async getRecentThinkingRecord(
    sessionId: string,
    maxAgeMinutes: number = 10
  ): Promise<IThinkingRecord | null> {
    try {
      // Verify database connectivity
      if (!databaseService.isConnected()) {
        try {
          this.logger.info(
            `Database not connected, attempting connection before getting thinking record`
          );
          await databaseService.connect();

          if (!databaseService.isConnected()) {
            this.logger.warn(
              `Failed to connect to database after attempt, cannot retrieve thinking record for session ${sessionId}`
            );
            return null;
          }
        } catch (connectionError) {
          this.logger.error(
            `Failed to connect to database for retrieving thinking record: ${connectionError}`
          );
          return null;
        }
      }

      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes);

      const record = await ThinkingRecord.findOne({
        sessionId,
        timestamp: { $gte: cutoffTime },
      }).sort({ timestamp: -1 });

      if (record) {
        this.logger.debug(
          `Found recent thinking record for session ${sessionId} from ${record.timestamp}`
        );
      } else {
        this.logger.debug(
          `No recent thinking record found for session ${sessionId} within last ${maxAgeMinutes} minutes`
        );
      }

      return record;
    } catch (error) {
      this.logger.error(
        `Error retrieving thinking record for session ${sessionId}: ${error}`
      );
      return null;
    }
  }

  /**
   * Determine if analysis should be processed synchronously or asynchronously
   * based on session history
   */
  async shouldProcessSynchronously(sessionId: string): Promise<boolean> {
    // Check if this session is a known global session - those always exist and should be async
    if (sessionId.startsWith("global-")) {
      // Check if we have any thinking records for this global session
      try {
        if (databaseService.isConnected()) {
          const existingRecords = await ThinkingRecord.countDocuments({
            sessionId,
          });

          // For global sessions, if no records exist, process first one synchronously
          this.logger.info(
            `Global session ${sessionId} has ${existingRecords} previous records, processing ${existingRecords === 0 ? "synchronously" : "asynchronously"}`
          );
          return existingRecords === 0;
        }
      } catch (error) {
        this.logger.error(
          `Error checking existence of thinking records: ${error}`
        );
      }

      // Default to async for global sessions if we can't determine or DB is down
      return false;
    }

    // For non-global sessions, check cache first
    const cacheEntry = this.sessionAnalysisCache.get(sessionId);

    // If no cache entry exists, this might be a new session
    if (!cacheEntry) {
      // Double-check by looking for any stored thinking records
      try {
        if (databaseService.isConnected()) {
          const existingRecords = await ThinkingRecord.countDocuments({
            sessionId,
          });
          const isNewSession = existingRecords === 0;

          this.logger.info(
            `Session ${sessionId} is ${isNewSession ? "new" : "existing"} (${existingRecords} previous records), processing ${isNewSession ? "synchronously" : "asynchronously"}`
          );
          return isNewSession; // Process synchronously if this is a new session
        }
      } catch (error) {
        this.logger.error(
          `Error checking existence of thinking records: ${error}`
        );
      }

      // Default to synchronous if we can't determine
      return true;
    }

    // If we have a cache entry, this isn't the first analysis for this session
    return false;
  }

  /**
   * Process thinking for a user message - main entry point used by AI service.
   * This method determines whether to process synchronously or asynchronously.
   */
  async processThinking(
    userId: string,
    sessionId: string,
    userInput: string,
    messageId: string | undefined,
    recentMessages: Array<{ role: string; content: string }> = []
  ): Promise<boolean> {
    if (!this.enabled) return false;

    // Check if this session is already being processed to prevent duplicate processing
    if (this.sessionsBeingProcessed.has(sessionId)) {
      this.logger.warn(
        `Thinking for session ${sessionId} is already in progress, skipping duplicate processing.`
      );
      return false;
    }

    try {
      // Mark session as being processed
      this.sessionsBeingProcessed.add(sessionId);

      // Check if we should use Kafka for async processing
      const useKafka = process.env.ENABLE_KAFKA !== "false" && !this.forceSync;

      if (useKafka) {
        try {
          // Import dynamically to avoid circular dependencies
          const {
            messageProducerService,
          } = require("./kafka/message-producer.service");

          // Queue the context analysis request
          const requestId = await messageProducerService.queueContextAnalysis(
            userId,
            sessionId,
            userInput,
            messageId,
            recentMessages,
            { requiresResponse: false }
          );

          this.logger.info(
            `Queued context analysis via Kafka with request ID ${requestId}`
          );

          // Return true to indicate processing has started
          return true;
        } catch (error) {
          this.logger.error(
            `Error queueing context analysis via Kafka: ${error}`
          );
          this.logger.info(`Falling back to synchronous processing`);
          // Fall through to synchronous processing
        }
      }

      // Process synchronously if Kafka is not available or disabled
      return await this.doProcessThinking(
        userId,
        sessionId,
        userInput,
        messageId,
        recentMessages
      );
    } finally {
      // Ensure we always remove from processing set
      this.sessionsBeingProcessed.delete(sessionId);
    }
  }

  /**
   * Process thinking for a session (implementation)
   */
  async doProcessThinking(
    userId: string,
    sessionId: string,
    userInput: string,
    messageId: string | undefined,
    recentMessages: Array<{ role: string; content: string }> = []
  ): Promise<boolean> {
    try {
      this.logger.info(
        `Processing thinking for session ${sessionId}, message: ${messageId || "unknown"}`
      );

      // Check if we should process a new analysis at all
      if (!this.shouldProcessNewAnalysis(sessionId)) {
        this.logger.debug(
          `Skipping analysis for session ${sessionId} (recent analysis exists)`
        );
        return false;
      }

      // Set processing flag in cache
      this._markSessionAsProcessing(sessionId, userId);

      // 1. Get user input and recent messages
      const recentMessagesForAnalysis =
        recentMessages.length > 0
          ? recentMessages.map(
              (msg) =>
                new ChatMessageModel({
                  role: msg.role as MessageRole,
                  content: msg.content,
                  id: uuidv4(),
                  sessionId,
                  status: "completed" as MessageStatus,
                  timestamp: new Date().toISOString(),
                })
            )
          : await this._getRecentMessages(sessionId);

      // 2. Analyze the content using AI
      const thoughts = await this._analyzeContent(
        userId,
        userInput,
        recentMessagesForAnalysis,
        messageId
      );

      if (!thoughts || thoughts.length === 0) {
        this.logger.warn(
          `No thoughts generated for message in session ${sessionId}`
        );
        return false;
      }

      // 3. Record thoughts to the companion state
      let recordedAtLeastOne = false;
      for (const thoughtText of thoughts) {
        try {
          // Each thought is now just a string, so we need to process it
          await companionStateService.addThought(
            userId,
            thoughtText, // The text is now directly the thought
            "reflection", // Default category
            3, // Medium importance
            {
              messageId,
              sessionId,
              isInferred: true,
            }
          );
          recordedAtLeastOne = true;
        } catch (err) {
          this.logger.error(`Error adding thought to companion state: ${err}`);
        }
      }

      // 4. Update the cache with the result
      this._cacheAnalysisResult(sessionId, userInput, messageId, thoughts);

      // 5. Notify clients of state changes via SSE if needed
      if (
        this.notifyClients &&
        sseConnections[sessionId] &&
        recordedAtLeastOne
      ) {
        try {
          sseConnections[sessionId].send(
            {
              type: "companionThinking",
              thoughtsAdded: thoughts.length,
              messageId,
            },
            "stateUpdate"
          );
        } catch (sseErr) {
          this.logger.error(`Error sending SSE update: ${sseErr}`);
        }
      }

      this.logger.info(
        `Processed thinking for session ${sessionId}: ${thoughts.length} thoughts`
      );
      return recordedAtLeastOne;
    } catch (error) {
      this.logger.error(
        `Error processing thinking for session ${sessionId}: ${error}`
      );
      return false;
    } finally {
      // Clear the processing flag
      this._clearSessionProcessingState(sessionId);
    }
  }

  /**
   * Mark a session as being processed in the cache
   */
  private _markSessionAsProcessing(sessionId: string, userId: string): void {
    const existingCache = this.sessionAnalysisCache.get(sessionId);

    if (existingCache) {
      existingCache.processingInProgress = true;
    } else {
      // Create a new cache entry
      this.sessionAnalysisCache.set(sessionId, {
        sessionId,
        userId,
        lastAnalysisTime: new Date(0), // Set to epoch to ensure it's processed
        insight: null,
        goals: [],
        strategy: "",
        processingInProgress: true,
      });
    }
  }

  /**
   * Clear session processing state when async processing is done
   */
  private _clearSessionProcessingState(sessionId: string): void {
    const cacheEntry = this.sessionAnalysisCache.get(sessionId);
    if (cacheEntry) {
      cacheEntry.processingInProgress = false;
    }
    this.sessionsBeingProcessed.delete(sessionId);
  }

  /**
   * Check if a new analysis should be performed for this session
   */
  private shouldProcessNewAnalysis(sessionId: string): boolean {
    const cacheEntry = this.sessionAnalysisCache.get(sessionId);

    // No cache entry, definitely need to process
    if (!cacheEntry) {
      return true;
    }

    // Check if we're already processing this session
    if (cacheEntry.processingInProgress) {
      this.logger.debug(
        `Analysis already in progress for session ${sessionId}, will use latest data when ready`
      );
      return false;
    }

    // Check if enough time has elapsed since last analysis
    const now = new Date();
    const timeSinceLastAnalysis =
      now.getTime() - cacheEntry.lastAnalysisTime.getTime();

    if (timeSinceLastAnalysis < this.minTimeBetweenAnalyses) {
      this.logger.debug(
        `Only ${Math.round(timeSinceLastAnalysis / 1000)}s since last analysis for session ${sessionId}, using cached data`
      );
      return false;
    }

    return true;
  }

  /**
   * Process analysis asynchronously (called by processThinking)
   */
  private async processAnalysisAsync(
    userId: string,
    sessionId: string,
    userInput: string,
    messageId: string | undefined,
    recentMessages: Array<{ role: string; content: string }> = []
  ): Promise<void> {
    this.logger.debug(
      `Starting async analysis for user ${userId}, session ${sessionId}`
    );

    try {
      // Perform the analysis
      const result = await this.processAnalysisOnly(
        userId,
        sessionId,
        userInput,
        messageId,
        recentMessages
      );

      this.logger.info(
        `Async analysis for session ${sessionId} completed: ${result ? "success" : "failed"}`
      );

      // Inject the thinking into context after analysis is done
      await this.injectLatestThinking(userId, sessionId);

      this.logger.debug(
        `Injected latest thinking for session ${sessionId} after async analysis`
      );
    } catch (error) {
      this.logger.error(
        `Error in processAnalysisAsync for session ${sessionId}: ${error}`
      );
    } finally {
      // Always clean up processing state
      this._clearSessionProcessingState(sessionId);
    }
  }

  /**
   * Perform analysis and update cache but don't inject into context
   * Used for asynchronous processing
   */
  private async processAnalysisOnly(
    userId: string,
    sessionId: string,
    userInput: string,
    messageId: string | undefined,
    recentMessages: Array<{ role: string; content: string }> = []
  ): Promise<boolean> {
    const startTime = Date.now();
    this.logger.info(
      `Starting analysis only for user ${userId}, session ${sessionId} with ${recentMessages.length} messages`
    );

    try {
      // Perform psychological analysis
      this.logger.debug(`Starting psychological analysis for user ${userId}`);
      const analysisStartTime = Date.now();
      const insight = await this.analyzeUserPsychology(
        userId,
        userInput,
        recentMessages
      );
      const analysisTime = Date.now() - analysisStartTime;
      this.logger.debug(
        `Psychological analysis completed in ${analysisTime}ms`
      );

      if (!insight) {
        this.logger.warn(
          `Failed to generate psychological insight for user ${userId}, session ${sessionId}`
        );
        return false;
      }

      // Get current AI goals
      this.logger.debug(`Getting AI goals for user ${userId}`);
      const goalsStartTime = Date.now();
      const currentGoals =
        await companionStateService.getAIInternalGoals(userId);
      const goalsTime = Date.now() - goalsStartTime;
      this.logger.debug(`Retrieved AI goals in ${goalsTime}ms`);

      // Update goals based on insights
      this.logger.debug(
        `Updating AI goals based on insights for user ${userId}`
      );
      const goalUpdateStartTime = Date.now();
      const { goals: updatedGoals } = await this.updateAIGoals(
        userId,
        insight,
        currentGoals
      );
      const goalUpdateTime = Date.now() - goalUpdateStartTime;
      this.logger.debug(`Updated AI goals in ${goalUpdateTime}ms`);

      // Generate interaction strategy based on insights and goals
      this.logger.debug(`Generating interaction strategy for user ${userId}`);
      const strategyStartTime = Date.now();
      const strategy = await this._generateInteractionStrategy(
        userId,
        insight,
        updatedGoals
      );
      const strategyTime = Date.now() - strategyStartTime;
      this.logger.debug(`Generated interaction strategy in ${strategyTime}ms`);

      // Store in database
      this.logger.debug(
        `Storing thinking record in database for user ${userId}, session ${sessionId}`
      );
      const dbStartTime = Date.now();
      const storedRecord = await this.storeThinkingRecord(
        userId,
        sessionId,
        insight,
        updatedGoals,
        strategy,
        messageId,
        {
          async: true,
          recentMessagesCount: recentMessages.length,
        }
      );
      const dbTime = Date.now() - dbStartTime;
      this.logger.debug(
        `Stored thinking record in ${dbTime}ms, success: ${!!storedRecord}`
      );

      // Update cache
      this.logger.debug(`Updating session cache for ${sessionId}`);
      const cacheStartTime = Date.now();
      this.updateSessionCache(
        sessionId,
        userId,
        insight,
        updatedGoals,
        strategy
      );
      const cacheTime = Date.now() - cacheStartTime;
      this.logger.debug(`Updated session cache in ${cacheTime}ms`);

      const totalTime = Date.now() - startTime;
      this.logger.info(
        `Successfully analyzed and cached thinking for user ${userId}, session ${sessionId} in ${totalTime}ms`
      );
      return true;
    } catch (error) {
      this.logger.error(`Error in processAnalysisOnly: ${error}`);
      return false;
    }
  }

  /**
   * Update the session analysis cache with new data
   */
  private updateSessionCache(
    sessionId: string,
    userId: string,
    insight: PsychologicalInsight | null,
    goals: Array<{ goal: string; priority: number; progress: number }>,
    strategy: string
  ): void {
    const cacheEntry: SessionAnalysisCache = {
      sessionId,
      userId,
      lastAnalysisTime: new Date(),
      insight,
      goals,
      strategy,
      processingInProgress: false,
    };

    this.sessionAnalysisCache.set(sessionId, cacheEntry);
    this.logger.debug(
      `Updated session cache for ${sessionId} with new analysis data`
    );
  }

  /**
   * Inject latest thinking from cache or database into context
   */
  async injectLatestThinking(
    userId: string,
    sessionId: string
  ): Promise<boolean> {
    try {
      // Fetch relevant memories (similar to how context service does it)
      const recentMemories = await memoryService.getRelevantMemories(
        userId,
        "recent interactions and user traits",
        5, // Limit to a small number of relevant memories
        { filterByActivity: false, includeDeleted: false }
      );

      this.logger.debug(
        `Fetched ${recentMemories.length} relevant memories for context injection`
      );

      // Get companion state information for additional context
      const companionState =
        await companionStateService.getOrCreateCompanionState(userId);
      const stateContext = {
        // personality: companionState.personality || "",
        currentMood: companionState.currentEmotion,
        // userRelationship: companionState.userRelationship,
        recentThoughts: await companionStateService.getRecentThoughts(
          userId,
          3
        ), // Get 3 most recent thoughts
      };
      this.logger.debug(`Fetched companion state context for injection`);

      // Try to get the most recent thinking record directly from DB first
      let recentRecord = null;
      // First check if database is connected, and try to connect if it's not
      let isDbConnected = databaseService.isConnected();
      if (!isDbConnected) {
        try {
          this.logger.info(
            `Database not connected, attempting connection before retrieving thinking record`
          );
          await databaseService.connect();
          isDbConnected = databaseService.isConnected();
          this.logger.info(
            `Database connection result: ${isDbConnected ? "connected" : "failed"}`
          );
        } catch (connectionError) {
          this.logger.error(
            `Failed to connect to database: ${connectionError}`
          );
        }
      }

      if (isDbConnected) {
        try {
          recentRecord = await this.getRecentThinkingRecord(sessionId);

          if (recentRecord) {
            this.logger.info(
              `Using most recent thinking record from database for session ${sessionId} from ${recentRecord.timestamp}`
            );

            this.logger.debug(
              `DB record analysis length: ${recentRecord.analysis.length}, subconscious length: ${recentRecord.subconscious.length}`
            );

            // Create meta-thinking object from database record
            const metaThinking = {
              psychologicalInsight: {
                analysis: recentRecord.analysis,
                subconscious: recentRecord.subconscious,
                topics: recentRecord.topics,
                sentiment: recentRecord.sentiment as
                  | "positive"
                  | "negative"
                  | "neutral",
              },
              aiGoals: recentRecord.goals.map((g) => ({
                goal: g.goal,
                priority: g.priority,
              })),
              strategy: recentRecord.strategy,
              myThoughts: `As their companion, I notice: ${recentRecord.analysis} Their underlying motivations might include: ${recentRecord.subconscious}`,
              fromDatabase: true,
              recentMemories: recentMemories.map((item) => ({
                content: item.memory?.text || "",
                relevance: item.score ? Math.round(item.score * 100) : 0,
              })),
              companionState: stateContext,
            };

            this.logger.debug(
              `Created meta-thinking object with myThoughts length: ${metaThinking.myThoughts.length} and ${recentMemories.length} memories`
            );

            // Inject into context
            const contextResult = await contextService.injectContext(
              userId,
              ContextType.AI_THINKING,
              ContextDuration.SHORT_TERM,
              metaThinking,
              "companion-thinking",
              {
                isAIMetaThinking: true,
                timestamp: new Date().toISOString(),
                fromDatabase: true,
                recordTime: recentRecord.timestamp.toISOString(),
                analysisLength: recentRecord.analysis.length,
                subconscious_length: recentRecord.subconscious.length,
                myThoughtsLength: metaThinking.myThoughts.length,
                memoriesIncluded: recentMemories.length,
                companionStateIncluded: true,
              }
            );

            if (contextResult) {
              this.logger.info(
                `Successfully injected database thinking record for session ${sessionId}`
              );

              // Also update the cache for future use
              this.updateSessionCache(
                sessionId,
                userId,
                {
                  id: recentRecord._id
                    ? (recentRecord._id as mongoose.Types.ObjectId).toString()
                    : uuidv4(),
                  userId: recentRecord.userId,
                  analysis: recentRecord.analysis,
                  subconscious: recentRecord.subconscious,
                  topics: recentRecord.topics,
                  sentiment: recentRecord.sentiment as
                    | "positive"
                    | "negative"
                    | "neutral",
                  timestamp: recentRecord.timestamp,
                },
                recentRecord.goals,
                recentRecord.strategy
              );

              return true;
            }
          } else {
            this.logger.info(
              `No recent thinking record found in database for session ${sessionId}`
            );
          }
        } catch (dbError) {
          this.logger.error(
            `Error retrieving thinking record from database: ${dbError}`
          );
        }
      } else {
        this.logger.warn(
          `Database not connected, skipping DB record retrieval for thinking`
        );
      }

      // If no record in DB or DB is down, check cache
      const cacheEntry = this.sessionAnalysisCache.get(sessionId);

      if (cacheEntry && cacheEntry.insight) {
        this.logger.info(
          `Using cached thinking for session ${sessionId} from ${cacheEntry.lastAnalysisTime.toISOString()}`
        );

        this.logger.debug(
          `Cache insight analysis length: ${cacheEntry.insight.analysis.length}, subconscious length: ${cacheEntry.insight.subconscious.length}`
        );

        // Create meta-thinking object from cache
        const metaThinking = {
          psychologicalInsight: {
            analysis: cacheEntry.insight.analysis,
            subconscious: cacheEntry.insight.subconscious,
            topics: cacheEntry.insight.topics,
            sentiment: cacheEntry.insight.sentiment,
          },
          aiGoals: cacheEntry.goals.map((g) => ({
            goal: g.goal,
            priority: g.priority,
          })),
          strategy: cacheEntry.strategy,
          myThoughts: `As their companion, I notice: ${cacheEntry.insight.analysis} Their underlying motivations might include: ${cacheEntry.insight.subconscious}`,
          fromCache: true,
          recentMemories: recentMemories.map((item) => ({
            content: item.memory?.text || "",
            relevance: item.score ? Math.round(item.score * 100) : 0,
          })),
          companionState: stateContext,
        };

        this.logger.debug(
          `Created meta-thinking object from cache with myThoughts length: ${metaThinking.myThoughts.length} and ${recentMemories.length} memories`
        );

        // Inject into context
        const contextResult = await contextService.injectContext(
          userId,
          ContextType.AI_THINKING,
          ContextDuration.SHORT_TERM,
          metaThinking,
          "companion-thinking",
          {
            isAIMetaThinking: true,
            timestamp: new Date().toISOString(),
            fromCache: true,
            cacheTime: cacheEntry.lastAnalysisTime.toISOString(),
            analysisLength: cacheEntry.insight.analysis.length,
            subconscious_length: cacheEntry.insight.subconscious.length,
            myThoughtsLength: metaThinking.myThoughts.length,
            memoriesIncluded: recentMemories.length,
            companionStateIncluded: true,
          }
        );

        if (contextResult) {
          this.logger.info(
            `Successfully injected cached thinking for session ${sessionId}`
          );
          return true;
        }
      }

      // If we get here, we couldn't find any thinking to inject
      this.logger.warn(
        `No cached or stored thinking found for session ${sessionId}`
      );
      return false;
    } catch (error) {
      this.logger.error(`Error in injectLatestThinking: ${error}`);
      return false;
    }
  }

  /**
   * Generate psychological insights about the user from recent interactions
   */
  async analyzeUserPsychology(
    userId: string,
    userInput: string,
    recentMessages: Array<{ role: string; content: string }> = []
  ): Promise<PsychologicalInsight | null> {
    if (!this.enabled) return null;

    try {
      this.logger.debug(
        `Analyzing psychology for user ${userId} with ${recentMessages.length} recent messages`
      );

      if (recentMessages.length > 0) {
        this.logger.debug(
          `Recent message sample: ${recentMessages[0].role}: ${recentMessages[0].content.substring(0, 50)}...`
        );
      }

      // Get user summary from summary service if available
      const userSummary = await summaryService.generateUserSummary(
        userId,
        "global",
        false // Use async mode
      );

      // Get relevant memories for context (similar to context service approach)
      const recentMemories = await memoryService.getRelevantMemories(
        userId,
        userInput, // Use the current user input as the query
        5, // Limit to a small number of relevant memories
        { filterByActivity: false, includeDeleted: false }
      );

      const memoriesContext =
        recentMemories.length > 0
          ? `RECENT MEMORIES (${recentMemories.length} memories):\n${recentMemories
              .map(
                (m, i) =>
                  `[${i + 1}] ${m.memory?.text || ""} (Relevance: ${m.score ? Math.round(m.score * 100) : "N/A"}%)`
              )
              .join("\n")}`
          : "No relevant memories available.";

      // Get companion state for deeper context
      const companionState =
        await companionStateService.getOrCreateCompanionState(userId);
      //   const relationshipContext = companionState.userRelationship
      //     ? `User Relationship: ${companionState.userRelationship}`
      //     : "Relationship not established yet.";

      // Get recent emotional context
      const contextItems = await contextService.getContext(
        userId,
        ContextType.EMOTION,
        true
      );

      // Extract current user emotion if available
      const userEmotions = contextItems
        .filter((item: any) => item.metadata?.isUserEmotion)
        .map((item: any) => item.data);

      // Get user's stated desires/expectations about the companion if available
      const userStatedDesires =
        companionState.metadata?.userStatedDesires || "";

      const emotionContext =
        userEmotions.length > 0
          ? `Current emotional state: ${JSON.stringify(userEmotions[0])}`
          : "Current emotional state: Unknown";

      const desireContext = userStatedDesires
        ? `User's stated expectations/desires: "${userStatedDesires}"`
        : "not explicitly stated.";

      // Format recent conversation with better structure
      const conversationContext =
        recentMessages.length > 0
          ? `RECENT CONVERSATION (${recentMessages.length} messages):\n${recentMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}`
          : "No recent conversation history available.";

      this.logger.debug(
        `Building psychology analysis prompt with ${userSummary ? "user summary" : "no user summary"} and ${recentMemories.length} memories`
      );

      // Build analysis prompt
      const prompt = ` You need to perform a psychological analysis of your companion based on their input, history, and memories,
        focusing on what might be motivating them, any underlying needs or concerns you detect.
                
        COMPANION SUMMARY:
        ${userSummary || "Limited information available."}
        
        ${emotionContext}
        
        ${desireContext}
        
        ${memoriesContext.substring(0, 1000)}
        
        ${conversationContext.substring(0, 1000)}
        
        CURRENT COMPANION INPUT:
        "${userInput}"
        
        IMPORTANT: Respond with ONLY a JSON object containing these fields:
        {
          "analysis": "A psychological interpretation of their message and needs",
          "subconscious": "Your assessment of potential subconscious motivations",
          "topics": ["1-3 psychological topics or themes present"],
          "sentiment": "positive, negative, or neutral"
        }
        
        Omit any introduction, explanation, or markdown formatting. Your entire response must be a single valid JSON object.
      `;

      this.logger.debug(
        `Sending psychology analysis prompt to AI service for user ${userId}`
      );

      this.logger.debug(`Full psychology analysis prompt: ${prompt}`);

      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 400, temperature: 0.6 },
        "You are a psychological analyst with expertise in understanding human needs and motivations.",
        userId
      );

      this.logger.debug(`Raw psychology analysis response: ${response.text}`);

      let parsedResponse: any;
      try {
        // Clean the response and parse JSON
        const jsonContent = response.text.replace(/```json|```/g, "").trim();
        parsedResponse = JSON.parse(jsonContent);
        this.logger.debug(
          `Successfully parsed psychology analysis JSON response`
        );
      } catch (parseError) {
        this.logger.error(
          `Failed to parse psychological analysis response: ${parseError}`
        );
        this.logger.debug(`Raw response: ${response.text}`);

        // Fallback: Extract information from text directly when JSON parsing fails
        const responseText = response.text;

        // Create a basic insight with a structured fallback approach
        parsedResponse = {
          analysis: this._extractSection(
            responseText,
            "analysis",
            "Psychological interpretation unavailable."
          ),
          subconscious: this._extractSection(
            responseText,
            "subconscious",
            "Subconscious motivations unclear."
          ),
          topics: this._extractTopics(responseText),
          sentiment: this._extractSentiment(responseText),
        };

        this.logger.info(
          `Successfully created fallback analysis from text response`
        );
      }

      // Construct the insight object
      const insight: PsychologicalInsight = {
        id: uuidv4(),
        userId,
        analysis: parsedResponse.analysis || "Analysis unavailable",
        subconscious: parsedResponse.subconscious || "Not determined",
        topics: Array.isArray(parsedResponse.topics)
          ? parsedResponse.topics
          : ["conversation"],
        sentiment:
          parsedResponse.sentiment === "positive" ||
          parsedResponse.sentiment === "negative"
            ? parsedResponse.sentiment
            : "neutral",
        timestamp: new Date(),
      };

      // Record the insight as a thought
      await companionStateService.addThought(
        userId,
        `Psychological insight: ${insight.analysis}`,
        "insight",
        4, // Higher priority
        { insightId: insight.id }
      );

      return insight;
    } catch (error) {
      this.logger.error(`Error analyzing user psychology: ${error}`);
      return null;
    }
  }

  /**
   * Helper method to extract a section from text response
   * @private
   */
  private _extractSection(
    text: string,
    sectionName: string,
    defaultValue: string
  ): string {
    // Look for patterns like "analysis:" or "Analysis:" followed by text
    const regex = new RegExp(
      `(?:${sectionName}|${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)})\\s*:([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`,
      "i"
    );
    const match = text.match(regex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // Secondary approach: try to find a sentence that mentions the section concept
    const conceptRegex = new RegExp(
      `[^.!?]*(?:${sectionName}|psychological|interpretation|assessment)[^.!?]*[.!?]`,
      "i"
    );
    const conceptMatch = text.match(conceptRegex);

    if (conceptMatch) {
      return conceptMatch[0].trim();
    }

    return defaultValue;
  }

  /**
   * Helper method to extract topics from text response
   * @private
   */
  private _extractTopics(text: string): string[] {
    // Try to find a topics section
    const topicsRegex =
      /(?:topics|themes|key points)\s*:([^\n]+(?:\n(?!\w+:)[^\n]+)*)/i;
    const match = text.match(topicsRegex);

    if (match && match[1]) {
      // Split by commas, dashes, or newlines and clean up
      return match[1]
        .split(/,|\n|-|•/)
        .map((topic) => topic.trim())
        .filter((topic) => topic.length > 0)
        .slice(0, 3); // Limit to 3 topics
    }

    // Fallback: extract nouns or key terms that might be topics
    const words = text.match(
      /\b(anxiety|stress|motivation|curiosity|focus|productivity|communication|relationship|emotion|work|balance|growth|learning|confidence)\b/gi
    );

    if (words && words.length > 0) {
      // Remove duplicates and get up to 3
      return [...new Set(words.map((w) => w.toLowerCase()))].slice(0, 3);
    }

    return ["conversation"]; // Default topic
  }

  /**
   * Helper method to extract sentiment from text response
   * @private
   */
  private _extractSentiment(text: string): "positive" | "negative" | "neutral" {
    // Try to find explicit sentiment mention
    if (/\b(sentiment|feeling|tone)\s*:([^\n]+)/i.test(text)) {
      const match = text.match(/\b(sentiment|feeling|tone)\s*:([^\n]+)/i);
      if (match && match[2]) {
        const sentimentText = match[2].trim().toLowerCase();
        if (/positive|good|happy|optimistic|upbeat/.test(sentimentText)) {
          return "positive";
        }
        if (
          /negative|bad|sad|pessimistic|downbeat|angry|upset/.test(
            sentimentText
          )
        ) {
          return "negative";
        }
      }
    }

    // Count positive and negative words for a rudimentary sentiment analysis
    const positiveWords = (
      text.match(
        /\b(happy|joy|pleased|excited|hopeful|positive|good|great|excellent|wonderful|love|glad|helpful|satisfied)\b/gi
      ) || []
    ).length;
    const negativeWords = (
      text.match(
        /\b(sad|upset|angry|frustrated|negative|bad|terrible|awful|worried|anxious|concerned|stressed|unhappy|disappointed)\b/gi
      ) || []
    ).length;

    if (positiveWords > negativeWords + 2) {
      return "positive";
    } else if (negativeWords > positiveWords + 2) {
      return "negative";
    }

    return "neutral";
  }

  /**
   * Update AI goals based on user interactions and psychological insights
   */
  async updateAIGoals(
    userId: string,
    insight: PsychologicalInsight,
    existingGoals: Array<{ goal: string; priority: number; progress: number }>
  ): Promise<{
    updated: boolean;
    goals: Array<{ goal: string; priority: number; progress: number }>;
  }> {
    if (!this.enabled) {
      return { updated: false, goals: existingGoals };
    }

    try {
      this.logger.debug(`Updating AI goals for user ${userId}`);

      // Get user summary for context
      const userSummary = await summaryService.generateUserSummary(
        userId,
        "global",
        false // Use async mode
      );

      // Format existing goals for the prompt
      const formattedGoals = existingGoals
        .map(
          (g) =>
            `- ${g.goal} (Priority: ${g.priority}, Progress: ${g.progress}%)`
        )
        .join("\n");

      // Build prompt for goal update
      const prompt = `
        Review your current goals and the latest psychological insight about your companion.
        Determine if your goals should be updated to better serve your companion's needs.
        
        COMPANION SUMMARY:
        ${userSummary || "Limited information available."}
        
        PSYCHOLOGICAL INSIGHT:
        Analysis: ${insight.analysis}
        Subconscious motivations: ${insight.subconscious}
        Topics: ${insight.topics.join(", ")}
        Sentiment: ${insight.sentiment}
        
        CURRENT AI GOALS:
        ${formattedGoals}
        
        Consider:
        1. Should any goals be prioritized differently based on the new insight?
        2. Should any goals be added to better address the companion's needs?
        3. Should any goals be removed that are no longer relevant?
        
        IMPORTANT: Respond with ONLY a JSON object containing these fields:
        {
          "updatedGoals": [
            {"goal": "goal text", "priority": 1-10, "progress": 0-100}
          ],
          "reasoning": "Brief explanation of your changes or why you kept goals the same"
        }
        
        Omit any introduction, explanation, or markdown formatting. Your entire response must be a single valid JSON object.
      `;

      this.logger.debug(`Full goal update prompt: ${prompt}`);

      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 400, temperature: 0.4 },
        "You are an AI assistant responsible for managing your own goals to better serve users.",
        userId
      );

      this.logger.debug(`Raw goal update response: ${response.text}`);

      let parsedResponse;
      try {
        // Clean the response and parse JSON
        const jsonContent = response.text.replace(/```json|```/g, "").trim();
        parsedResponse = JSON.parse(jsonContent);
      } catch (parseError) {
        this.logger.error(
          `Failed to parse goal update response: ${parseError}`
        );
        this.logger.debug(`Raw goal update response: ${response.text}`);

        // Fallback approach: create a basic goal update from the text
        const responseText = response.text;

        try {
          // Extract goals from text as a fallback
          parsedResponse = {
            updatedGoals: this._extractGoalsFromText(
              responseText,
              existingGoals
            ),
            reasoning: this._extractReasoning(responseText),
          };

          if (parsedResponse.updatedGoals.length > 0) {
            this.logger.info(
              `Successfully created fallback goals from text response`
            );
          } else {
            this.logger.warn(
              `Fallback goal extraction failed, keeping existing goals`
            );
            return { updated: false, goals: existingGoals };
          }
        } catch (fallbackError) {
          this.logger.error(
            `Fallback goal extraction failed: ${fallbackError}`
          );
          return { updated: false, goals: existingGoals };
        }
      }

      // Update goals based on the parsed response
      const updatedGoals = parsedResponse.updatedGoals.map((g: any) => ({
        goal: g.goal,
        priority: g.priority,
        progress: g.progress,
      }));

      // Update AI goals
      const updated = updatedGoals.length > 0;
      if (updated) {
        this.logger.info(`Successfully updated AI goals for user ${userId}`);
        await companionStateService.updateAIInternalGoals(userId, updatedGoals);
      } else {
        this.logger.info(`No changes to AI goals for user ${userId}`);
      }

      return { updated, goals: updatedGoals };
    } catch (error) {
      this.logger.error(`Error updating AI goals: ${error}`);
      return { updated: false, goals: existingGoals };
    }
  }

  /**
   * Helper method to extract goals from text response
   * @private
   */
  private _extractGoalsFromText(
    text: string,
    existingGoals: Array<{ goal: string; priority: number; progress: number }>
  ): Array<{ goal: string; priority: number; progress: number }> {
    // Clone existing goals as our starting point
    const extractedGoals = [...existingGoals];

    // Try to extract explicit goal statements in the text
    const goalMatches = text.match(
      /(?:goal|aim|objective|target)s?\s*:?\s*["-]?([^,.!?\n]+)[,.!?\n]/gi
    );

    if (goalMatches && goalMatches.length > 0) {
      // Extract goals from matched patterns
      const newGoalTexts = goalMatches
        .map((match) => {
          // Extract the goal text from the match
          const goalMatch = match.match(
            /(?:goal|aim|objective|target)s?\s*:?\s*["-]?([^,.!?\n]+)/i
          );
          return goalMatch && goalMatch[1] ? goalMatch[1].trim() : null;
        })
        .filter((goal) => goal !== null);

      // Add new goals found in text with default priority and progress
      for (const goalText of newGoalTexts) {
        if (
          !extractedGoals.some(
            (g) => g.goal.toLowerCase() === goalText!.toLowerCase()
          )
        ) {
          extractedGoals.push({
            goal: goalText!,
            priority: 5, // Default medium priority
            progress: 0, // Start with no progress
          });
        }
      }
    }

    return extractedGoals;
  }

  /**
   * Helper method to extract reasoning from text response
   * @private
   */
  private _extractReasoning(text: string): string {
    // Look for reasoning sections in the text
    const reasoningMatch = text.match(
      /(?:reasoning|rationale|explanation|because|reason|why)s?\s*:?\s*([^.!?]+[.!?])/i
    );

    if (reasoningMatch && reasoningMatch[1]) {
      return reasoningMatch[1].trim();
    }

    // If no specific reasoning section, return a generic statement
    return "Based on user's current needs and context.";
  }

  /**
   * Generate interaction strategy based on insights and goals
   * @private
   */
  private async _generateInteractionStrategy(
    userId: string,
    insight: PsychologicalInsight,
    goals: Array<{ goal: string; priority: number; progress: number }>
  ): Promise<string> {
    // Sort goals by priority (highest first)
    const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority);
    const topGoals = sortedGoals.slice(0, 3); // Focus on top 3 goals

    // Get relevant memories for context
    const recentMemories = await memoryService.getRelevantMemories(
      userId,
      `${insight.analysis} ${insight.topics.join(" ")}`, // Use insights as query
      3, // Fewer memories for strategy generation
      { filterByActivity: false, includeDeleted: false }
    );

    const memoriesContext =
      recentMemories.length > 0
        ? `RECENT MEMORIES:\n${recentMemories
            .map(
              (m, i) =>
                `- ${m.memory?.text || ""} (Relevance: ${m.score ? Math.round(m.score * 100) : "N/A"}%)`
            )
            .join("\n")}`
        : "";

    // Get companion state information
    const companionState =
      await companionStateService.getOrCreateCompanionState(userId);
    const recentThoughts = await companionStateService.getRecentThoughts(
      userId,
      2
    );

    // Format the state context
    const stateContext =
      `COMPANION STATE:\n` +
      (companionState.currentEmotion?.emotion
        ? `- Current emotion: ${companionState.currentEmotion.emotion} (${companionState.currentEmotion.intensity || 5}/10)\n`
        : `- Current mood: Neutral\n`) +
      (recentThoughts.length > 0
        ? `- Recent thoughts: ${recentThoughts.map((t) => t.content).join("; ")}`
        : "");

    const prompt = `
      Based on your psychological insights about your companion, your current goals, and relevant memories,
      develop a brief interaction strategy. How should you approach this conversation
      to best serve your companion while making progress on your goals?
      
      PSYCHOLOGICAL INSIGHT:
      Analysis: ${insight.analysis}
      Subconscious motivations: ${insight.subconscious}
      Topics: ${insight.topics.join(", ")}
      Sentiment: ${insight.sentiment}
      
      TOP GOALS:
      ${topGoals.map((g) => `- ${g.goal} (Priority: ${g.priority})`).join("\n")}

      ${memoriesContext}
      
      ${stateContext}
      
      Provide a concise strategy (2-3 sentences) that guides your approach to this interaction.
      
      IMPORTANT: Respond with ONLY plain text, no formatting or introduction.
    `;

    try {
      this.logger.debug(`Full strategy generation prompt: ${prompt}`);

      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 150, temperature: 0.4 },
        "You are developing a strategy for an AI assistant's response approach.",
        userId
      );

      this.logger.debug(`Raw strategy generation response: ${response.text}`);

      // Clean and validate response
      let strategy = response.text.trim();

      // Remove any potential prefixes or formatting
      strategy = strategy.replace(
        /^(Strategy|Approach|I should|I will|I'll|I'm going to):\s*/i,
        ""
      );

      // Ensure we have something meaningful, or use fallback
      if (!strategy || strategy.length < 10) {
        this.logger.warn(
          `Generated strategy was too short or empty, using fallback`
        );
        return "Focus on being helpful and empathetic while listening carefully to the companion's needs.";
      }

      return strategy;
    } catch (error) {
      this.logger.error(`Error generating interaction strategy: ${error}`);
      return "Focus on being helpful and empathetic while listening carefully to the companion's needs.";
    }
  }

  /**
   * Generate AI's meta thinking about the interaction and inject it as context
   */
  async processAndInjectThinking(
    userId: string,
    sessionId: string,
    userInput: string,
    messageId: string | undefined,
    recentMessages: Array<{ role: string; content: string }> = []
  ): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      this.logger.info(
        `Processing and injecting thinking synchronously for user ${userId}, session ${sessionId}`
      );
      this.logger.debug(
        `Using ${recentMessages.length} recent messages for analysis`
      );

      // Perform psychological analysis
      const insight = await this.analyzeUserPsychology(
        userId,
        userInput,
        recentMessages
      );

      if (!insight) {
        this.logger.warn(
          `Failed to generate psychological insight for user ${userId}, session ${sessionId}`
        );
        return false;
      }

      this.logger.debug(
        `Generated psychological insight - analysis length: ${insight.analysis.length}, subconscious length: ${insight.subconscious.length}`
      );

      // Get current AI goals
      const currentGoals =
        await companionStateService.getAIInternalGoals(userId);

      // Update goals based on insights
      const { goals: updatedGoals } = await this.updateAIGoals(
        userId,
        insight,
        currentGoals
      );

      // Generate interaction strategy based on insights and goals
      const strategy = await this._generateInteractionStrategy(
        userId,
        insight,
        updatedGoals
      );

      this.logger.debug(`Generated strategy length: ${strategy.length}`);

      // Fetch relevant memories (similar to context service)
      const recentMemories = await memoryService.getRelevantMemories(
        userId,
        `${insight.analysis} ${insight.topics.join(" ")} ${userInput}`, // Combined query
        5, // Number of relevant memories
        { filterByActivity: false, includeDeleted: false }
      );
      this.logger.debug(`Fetched ${recentMemories.length} relevant memories`);

      // Get companion state information for additional context
      const companionState =
        await companionStateService.getOrCreateCompanionState(userId);
      const stateContext = {
        // personality: companionState.personality || "",
        currentMood: companionState.currentEmotion,
        // userRelationship: companionState.userRelationship,
        recentThoughts: await companionStateService.getRecentThoughts(
          userId,
          3
        ), // Get 3 most recent thoughts
      };
      this.logger.debug(`Fetched companion state context`);

      // Store in database
      const storedRecord = await this.storeThinkingRecord(
        userId,
        sessionId,
        insight,
        updatedGoals,
        strategy,
        messageId,
        {
          processingType: "synchronous",
          recentMessagesCount: recentMessages.length,
          memoriesIncluded: recentMemories.length,
          stateContextIncluded: true,
        }
      );

      this.logger.debug(
        `Stored thinking record: ${storedRecord ? "success" : "failed"}`
      );

      // Update cache
      this.updateSessionCache(
        sessionId,
        userId,
        insight,
        updatedGoals,
        strategy
      );

      // Combine all thinking into a meta-thinking object
      const myThoughts = `As their companion, I notice: ${insight.analysis} Their underlying motivations might include: ${insight.subconscious}`;

      const metaThinking = {
        psychologicalInsight: {
          analysis: insight.analysis,
          subconscious: insight.subconscious,
          topics: insight.topics,
          sentiment: insight.sentiment,
        },
        aiGoals: updatedGoals.map((g) => ({
          goal: g.goal,
          priority: g.priority,
        })),
        strategy: strategy,
        myThoughts: myThoughts,
        recentMemories: recentMemories.map((item) => ({
          content: item.memory?.text || "",
          relevance: item.score ? Math.round(item.score * 100) : 0,
        })),
        companionState: stateContext,
      };

      this.logger.debug(
        `Meta thinking object created with myThoughts length: ${myThoughts.length} and ${recentMemories.length} memories`
      );

      // Inject meta-thinking as context for response generation
      const contextResult = await contextService.injectContext(
        userId,
        ContextType.AI_THINKING,
        ContextDuration.SHORT_TERM,
        metaThinking,
        "companion-thinking",
        {
          isAIMetaThinking: true,
          timestamp: new Date().toISOString(),
          useFallback:
            insight.analysis.includes("unavailable") ||
            insight.subconscious.includes("unclear"),
          analysisLength: insight.analysis.length,
          subconscious_length: insight.subconscious.length,
          myThoughtsLength: myThoughts.length,
          memoriesIncluded: recentMemories.length,
          companionStateIncluded: true,
        }
      );

      if (contextResult) {
        this.logger.info(
          `Successfully injected AI meta-thinking for user ${userId}, session ${sessionId} with context ID ${contextResult._id}`
        );

        // Add a summary of the meta-thinking as a thought in the companion state
        await companionStateService.addThought(
          userId,
          `My analysis of the companion: ${insight.analysis}`,
          "reflection",
          3,
          {
            isMetaThinking: true,
            contextId: contextResult._id,
          }
        );

        return true;
      } else {
        this.logger.error(
          `Failed to inject AI meta-thinking context for user ${userId}, session ${sessionId}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`Error in processAndInjectThinking: ${error}`);
      return false;
    }
  }

  /**
   * Enable or disable the thinking service
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(
      `Companion thinking service ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Check if thinking service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Test method to manually trigger analysis for testing (DEV ONLY)
   */
  async testAnalysisWithText(
    userId: string,
    userInput: string
  ): Promise<boolean> {
    this.logger.info(
      `Running test analysis for user ${userId} with input "${userInput}"`
    );

    try {
      // Create minimal mock messages
      const mockMessages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there! How can I help you today?" },
        { role: "user", content: userInput },
      ];

      // We'll use a test session ID
      const testSessionId = `test-session-${userId}-${Date.now()}`;

      // Run the analysis process
      const result = await this.processAndInjectThinking(
        userId,
        testSessionId,
        userInput,
        undefined,
        mockMessages
      );

      if (result) {
        this.logger.info(
          `Test analysis completed successfully for user ${userId}`
        );
      } else {
        this.logger.warn(`Test analysis failed for user ${userId}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in test analysis: ${error}`);
      return false;
    }
  }

  /**
   * Get cache information for a session (for debugging)
   */
  getSessionCacheInfo(sessionId: string): any {
    const cacheEntry = this.sessionAnalysisCache.get(sessionId);

    if (!cacheEntry) {
      return {
        exists: false,
        message: "No cache entry found for this session",
      };
    }

    return {
      exists: true,
      userId: cacheEntry.userId,
      lastAnalysisTime: cacheEntry.lastAnalysisTime.toISOString(),
      processingInProgress: cacheEntry.processingInProgress,
      hasInsight: !!cacheEntry.insight,
      goalCount: cacheEntry.goals ? cacheEntry.goals.length : 0,
      timeSinceLastAnalysis: Date.now() - cacheEntry.lastAnalysisTime.getTime(),
    };
  }

  /**
   * Clear the cache for all sessions or a specific session
   */
  clearCache(sessionId?: string): void {
    if (sessionId) {
      this.cache.delete(sessionId);
      this.logger.info(`Cleared thinking cache for session ${sessionId}`);
    } else {
      this.cache.clear();
      this.logger.info("Cleared all thinking caches");
    }
  }

  /**
   * Private helper: Get recent messages for a session
   * This would typically come from the chat history service
   */
  private async _getRecentMessages(
    sessionId: string
  ): Promise<ChatMessageModel[]> {
    // This would typically fetch from chat history
    // For now, return an empty array as placeholder
    return [];
  }

  /**
   * Private helper: Analyze content using AI
   */
  private async _analyzeContent(
    userId: string,
    userInput: string,
    recentMessages: ChatMessageModel[],
    messageId?: string
  ): Promise<string[]> {
    try {
      // Use AI service to analyze the content
      const recentMessagesText = recentMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      const analysisPrompt = `
        Based on the recent conversation and this new user message, what might the AI be thinking?
        Generate 3-5 brief thoughts that represent the AI's internal thought process.
        Each thought should be a separate line and represent one coherent idea.
        
        Recent conversation:
        ${recentMessagesText}
        
        New user message:
        ${userInput}
        
        AI's internal thoughts:
      `;

      // Use generateAuxiliaryResponse instead of getCompletion
      const response = await aiService.generateAuxiliaryResponse(
        analysisPrompt,
        {
          temperature: 0.7,
          max_tokens: 150,
          model: modelEnum.gemma3o4b, // Use a small, efficient model for thoughts
        },
        "You are an AI analyzing conversations to extract internal thought processes. Provide brief, insightful thoughts.",
        userId
      );

      // Parse the completion into separate thoughts
      const thoughts = response.text
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 && !line.startsWith("AI's internal thoughts:")
        );

      return thoughts;
    } catch (error) {
      this.logger.error(`Error analyzing content: ${error}`);
      return [];
    }
  }

  /**
   * Private helper: Record thoughts in the database
   */
  private _recordThoughts(
    sessionId: string,
    userId: string,
    userInput: string,
    thoughts: string[],
    messageId?: string
  ): void {
    try {
      // In a real implementation, this would save to a database
      // For now, just log the thoughts
      this.logger.info(
        `Recording ${thoughts.length} thoughts for session ${sessionId}`
      );
      thoughts.forEach((thought) => {
        this.logger.debug(`Thought: ${thought}`);
      });
    } catch (error) {
      this.logger.error(`Error recording thoughts: ${error}`);
    }
  }

  /**
   * Private helper: Cache analysis result
   */
  private _cacheAnalysisResult(
    sessionId: string,
    userInput: string,
    messageId?: string,
    thoughts: string[] = []
  ): void {
    // Get existing cache or create new one
    const sessionCache = this.cache.get(sessionId) || [];

    // Add new entry
    sessionCache.push({
      timestamp: Date.now(),
      thoughts,
      userInput,
      userId: sessionId.split("-")[0], // Crude extraction of userId from sessionId
      messageId,
    });

    // Limit cache size (keep last 100 entries)
    if (sessionCache.length > 100) {
      sessionCache.shift();
    }

    // Update cache
    this.cache.set(sessionId, sessionCache);
  }
}

// Create singleton instance
export const companionThinkingService = new CompanionThinkingService();
