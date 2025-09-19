import { loggerFactory } from "../utils/logger.service";
import { databaseService } from "../config/mongodb";
import { v4 as uuidv4 } from "uuid";
import { aiService } from "./ai.service";
import { memoryService, MemorySearchResult } from "./memory.service";
import { modelEnum } from "../constants/models";
import UserSummary, { IUserSummary } from "../models/summary.model";

/**
 * Cache entry for session summary
 */
interface SessionSummaryCache {
  userId: string;
  sessionId: string;
  lastSummaryTime: Date;
  summary: string;
  memoryCount: number;
  processingInProgress: boolean;
}

/**
 * Service for managing user summaries
 */
class SummaryService {
  private logger = loggerFactory.getLogger("SummaryService");
  private enabled: boolean = true;

  // Cache for recent session summaries
  private sessionSummaryCache: Map<string, SessionSummaryCache> = new Map();

  // Minimum time between summaries for the same session (in milliseconds)
  private minTimeBetweenSummaries: number = 5 * 60 * 1000; // 5 minutes

  // Track currently processing sessions to prevent duplicate requests
  private sessionsBeingProcessed: Set<string> = new Set();

  constructor() {
    // Start periodic cleanup of cache
    setInterval(() => this.cleanupSessionCache(), 30 * 60 * 1000); // Run every 30 minutes
    this.logger.info(
      "SummaryService initialized with caching and async processing"
    );
  }

  /**
   * Clean up old entries from the session summary cache
   */
  private cleanupSessionCache(): void {
    const now = new Date();
    const maxAge = 6 * 60 * 60 * 1000; // 6 hours

    let removedCount = 0;

    for (const [cacheKey, cacheEntry] of this.sessionSummaryCache.entries()) {
      const age = now.getTime() - cacheEntry.lastSummaryTime.getTime();

      if (age > maxAge) {
        this.sessionSummaryCache.delete(cacheKey);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.info(
        `Cleaned up ${removedCount} expired entries from session summary cache`
      );
    }
  }

  /**
   * Generate a cache key for a user-session combination
   */
  private getCacheKey(userId: string, sessionId: string): string {
    return `${userId}-${sessionId}`;
  }

  /**
   * Store a summary record in the database
   */
  private async storeSummaryRecord(
    userId: string,
    sessionId: string,
    summary: string,
    memoryCount: number,
    metadata?: Record<string, any>
  ): Promise<IUserSummary | null> {
    try {
      if (!databaseService.isConnected()) {
        this.logger.warn(
          `Database not connected, skipping summary record storage for user ${userId}, session ${sessionId}`
        );
        return null;
      }

      const summaryRecord = new UserSummary({
        userId,
        sessionId,
        timestamp: new Date(),
        summary,
        memoryCount,
        isActive: true,
        metadata,
      });

      await summaryRecord.save();
      this.logger.info(
        `Stored summary record in database for user ${userId}, session ${sessionId}`
      );
      return summaryRecord;
    } catch (error) {
      this.logger.error(`Failed to store summary record in database: ${error}`);
      return null;
    }
  }

  /**
   * Get the most recent summary record for a session
   */
  async getRecentSummaryRecord(
    userId: string,
    sessionId: string,
    maxAgeMinutes: number = 30
  ): Promise<IUserSummary | null> {
    try {
      if (!databaseService.isConnected()) {
        this.logger.warn(
          `Database not connected, cannot retrieve summary record for session ${sessionId}`
        );
        return null;
      }

      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes);

      const record = await UserSummary.findOne({
        userId,
        sessionId,
        timestamp: { $gte: cutoffTime },
        isActive: true,
      }).sort({ timestamp: -1 });

      if (record) {
        this.logger.debug(
          `Found recent summary record for session ${sessionId} from ${record.timestamp}`
        );
      } else {
        this.logger.debug(
          `No recent summary record found for user ${userId}, session ${sessionId} within last ${maxAgeMinutes} minutes`
        );
      }

      return record;
    } catch (error) {
      this.logger.error(
        `Error retrieving summary record for session ${sessionId}: ${error}`
      );
      return null;
    }
  }

  /**
   * Check if we should generate a new summary
   */
  private shouldGenerateNewSummary(userId: string, sessionId: string): boolean {
    const cacheKey = this.getCacheKey(userId, sessionId);
    const cachedSummary = this.sessionSummaryCache.get(cacheKey);

    // If no cached summary, we should generate one
    if (!cachedSummary) {
      return true;
    }

    // Check if enough time has passed since the last summary
    const now = new Date();
    const timeSinceLastSummary =
      now.getTime() - cachedSummary.lastSummaryTime.getTime();

    // Generate new summary if the minimum time has passed
    return timeSinceLastSummary >= this.minTimeBetweenSummaries;
  }

  /**
   * Update the session summary cache
   */
  private updateSummaryCache(
    userId: string,
    sessionId: string,
    summary: string,
    memoryCount: number
  ): void {
    const cacheKey = this.getCacheKey(userId, sessionId);
    this.sessionSummaryCache.set(cacheKey, {
      userId,
      sessionId,
      lastSummaryTime: new Date(),
      summary,
      memoryCount,
      processingInProgress: false,
    });
  }

  /**
   * Process summary generation - core implementation that does the actual work
   * Made public to be called directly from the Kafka consumer
   */
  async processSummaryGeneration(
    userId: string,
    sessionId: string,
    query?: string
  ): Promise<string> {
    const cacheKey = this.getCacheKey(userId, sessionId);

    try {
      this.logger.info(
        `Generating summary for user ${userId}, session ${sessionId}`
      );

      // Get relevant memories for the user/session
      const memoryLimit = 50;
      const relevantMemories = await memoryService.getRelevantMemories(
        userId,
        query ||
          "user profile personality traits interests recent interactions",
        memoryLimit,
        {
          includeDeleted: false,
          // Using session ID as a query filter, not as a property name
          // This will be handled inside the getRelevantMemories method logic
          metadata: { sessionId },
        }
      );

      if (!relevantMemories || relevantMemories.length === 0) {
        const emptySummary =
          "Not enough information available about this user yet.";
        this.updateSummaryCache(userId, sessionId, emptySummary, 0);
        return emptySummary;
      }

      const memoryLines = relevantMemories.map((item: MemorySearchResult) => {
        const memoryText = item?.memory?.text;
        const score = item?.score;
        return `- ${memoryText.trim()} (Relevance: ${score ? Math.round(score * 100) : "N/A"}%)`;
      });

      // Generate an AI summary of the memories
      const summaryPrompt = `
        I need a comprehensive yet concise user profile summary based on the following memories and information.
        Generate a summary that captures who this person is, their interests, behaviors, patterns, and relevant 
        background information.
        
        MEMORIES:
        ${memoryLines.join("\n")}
        
        Format your response as a concise paragraph (200-300 words) that clearly outlines:
        1. Key personal characteristics and traits
        2. Interests and preferences 
        3. Goals or aspirations (if mentioned, or implied)
        4. Relevant background or history
        
        USER SUMMARY:`;

      const summaryResponse = await aiService.generateAuxiliaryResponse(
        summaryPrompt,
        {
          model: modelEnum.gemma3o4b,
          max_tokens: 350,
          temperature: 0.4,
        },
        "You are an expert psychologist and profile writer.",
        userId
      );

      const generatedSummary = summaryResponse.text.trim();

      if (
        !generatedSummary ||
        generatedSummary === "[Error generating auxiliary response]"
      ) {
        this.logger.error(
          `Failed to generate summary for user ${userId}, session ${sessionId}`
        );
        return "Error generating user summary.";
      }

      // Store in database and update cache
      await this.storeSummaryRecord(
        userId,
        sessionId,
        generatedSummary,
        memoryLines.length,
        { generationMethod: "ai" }
      );

      this.updateSummaryCache(
        userId,
        sessionId,
        generatedSummary,
        memoryLines.length
      );

      this.logger.info(
        `Successfully generated summary for user ${userId}, session ${sessionId}`
      );
      return generatedSummary;
    } catch (error) {
      this.logger.error(`Error generating summary: ${error}`);
      return "Error generating user summary.";
    } finally {
      // Always remove from processing set in finally block
      this.sessionsBeingProcessed.delete(cacheKey);
    }
  }

  /**
   * Generate summary and perform caching
   * This can be called synchronously (first time) or asynchronously (subsequent times)
   */
  async generateUserSummary(
    userId: string,
    sessionId: string,
    synchronous: boolean = false
  ): Promise<string> {
    if (!this.enabled) {
      return "Summary service is disabled.";
    }

    const cacheKey = this.getCacheKey(userId, sessionId);

    // Check if this session is being processed already
    if (this.sessionsBeingProcessed.has(cacheKey)) {
      this.logger.debug(
        `Summary generation already in progress for session ${sessionId}, returning placeholder`
      );
      return "Summary being generated...";
    }

    // Check the cache first
    const cachedSummary = this.sessionSummaryCache.get(cacheKey);
    if (cachedSummary && !this.shouldGenerateNewSummary(userId, sessionId)) {
      this.logger.info(
        `Using cached summary for session ${sessionId} from ${cachedSummary.lastSummaryTime}`
      );
      return cachedSummary.summary;
    }

    // Check if we should use Kafka for async processing
    const useKafka = process.env.ENABLE_KAFKA !== "false" && !synchronous;

    if (useKafka) {
      try {
        // Import dynamically to avoid circular dependencies
        const {
          messageProducerService,
        } = require("./kafka/message-producer.service");

        // Queue the summary generation
        const requestId = await messageProducerService.queueSummarization(
          userId,
          sessionId,
          false,
          "recent interactions and user traits",
          { requiresResponse: false }
        );

        this.logger.info(
          `Queued summary generation via Kafka with request ID ${requestId}`
        );

        // Mark as being processed to prevent duplicates
        this.sessionsBeingProcessed.add(cacheKey);

        // For global sessions, check if we have a DB record first
        if (sessionId === "global" || sessionId.startsWith("global-")) {
          const dbSummary = await this.getRecentSummaryRecord(
            userId,
            sessionId
          );
          if (dbSummary) {
            // We have an existing summary, update cache and return it
            this.updateSummaryCache(
              userId,
              sessionId,
              dbSummary.summary,
              dbSummary.memoryCount
            );
            return dbSummary.summary;
          }
        }

        return "Summary being generated...";
      } catch (error) {
        this.logger.error(
          `Error queueing summary generation via Kafka: ${error}`
        );
        this.logger.info(`Falling back to direct processing`);
        // Fall through to synchronous processing
      }
    }

    // Check the database for a recent summary if not in cache
    if (!cachedSummary) {
      const dbSummary = await this.getRecentSummaryRecord(userId, sessionId);
      if (dbSummary) {
        this.updateSummaryCache(
          userId,
          sessionId,
          dbSummary.summary,
          dbSummary.memoryCount
        );
        this.logger.info(
          `Using database summary for user ${userId}, session ${sessionId}`
        );
        return dbSummary.summary;
      }
    }

    // If we need to generate a new summary
    if (synchronous) {
      return await this.processSummaryGeneration(userId, sessionId);
    } else {
      // Mark as processing and start async
      this.sessionsBeingProcessed.add(cacheKey);

      // Update cache with a processing placeholder if nothing exists
      if (!this.sessionSummaryCache.has(cacheKey)) {
        this.sessionSummaryCache.set(cacheKey, {
          userId,
          sessionId,
          lastSummaryTime: new Date(),
          summary: "Summary being generated...",
          memoryCount: 0,
          processingInProgress: true,
        });
      }

      // Start async processing
      this.processSummaryGeneration(userId, sessionId)
        .then(() => {
          this.sessionsBeingProcessed.delete(cacheKey);
        })
        .catch((error) => {
          this.logger.error(`Error in async summary generation: ${error}`);
          this.sessionsBeingProcessed.delete(cacheKey);
        });

      // Return current summary or placeholder
      return cachedSummary
        ? cachedSummary.summary
        : "Summary being generated...";
    }
  }

  /**
   * Enable or disable the summary service
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`Summary service ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if the summary service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets memories most relevant to the current session conversation
   */
  async getSessionMemories(
    userId: string,
    sessionId: string,
    query?: string,
    limit: number = 5
  ): Promise<Array<Record<string, any>>> {
    if (!this.enabled) {
      this.logger.debug(
        "Summary service is disabled, skipping memory retrieval"
      );
      return [];
    }

    this.logger.info(
      `Getting session memories for user ${userId}, session ${sessionId}`
    );

    try {
      const relevantMemories = await memoryService.getRelevantMemories(
        userId,
        query || "Recent session conversation",
        limit,
        {
          // Using sessionId as part of the filter parameters
          // NOT as metadata which is unsupported
          activeActivityId: sessionId,
          filterByActivity: false, // We're not filtering by activity, using other means
          includeDeleted: false,
        }
      );

      this.logger.info(
        `Found ${relevantMemories.length} memories for session ${sessionId}`
      );
      return relevantMemories;
    } catch (error) {
      this.logger.error(
        `Error getting session memories for ${sessionId}: ${error}`
      );
      return [];
    }
  }
}

// Create a singleton instance
export const summaryService = new SummaryService();
export default summaryService;
