import { v4 as uuidv4 } from "uuid";
import Activity, {
  ActivityType,
  IActivity,
  IActivityState,
  IRoleplayState,
  IGameState,
  IBrainstormState,
  IRoleplayEventLogEntry,
} from "../models/activity.model";
import { ContextService } from "./context.service";
import { ContextType } from "../interfaces/context-type.enum";
import { ContextDuration } from "../interfaces/context-duration.enum";
import { ActivityContext } from "../interfaces/context.interface";
import { loggerFactory } from "../utils/logger.service";
import { companionStateService } from "./companion-state.service";
import { activityFactoryService } from "./activity-factory.service";
import { aiService } from "./ai.service"; // Import AI service
import { log } from "console";
import MessageModel, { IMessage } from "../models/message.model"; // Correct import
import { memoryService, MemoryCategory, MemoryType } from "./memory.service";
import { chatSessionManager } from "../services/chat-session.service";
import { modelEnum } from "../constants/models";
import { sseConnections } from "../controllers/chat.controller";
import mongoose from "mongoose";

const logger = loggerFactory.getLogger("ActivityService");
// Get instance of context service
const contextService = new ContextService();

// Constants for activity management
const IRRELEVANT_THRESHOLD = 3; // Number of consecutive irrelevant messages to prompt for continuation
const RELEVANCE_SCORE_THRESHOLD = 0.3; // Minimum score to consider a message relevant
const MAX_RELEVANCE_HISTORY = 5; // Number of recent relevance scores to track
const ENABLE_AI_ACTIVITY_STATE_UPDATE = true; // Feature flag for AI state updates

/**
 * Service for managing user activities like roleplays, games, etc.
 */
class ActivityService {
  /**
   * Start a new activity for a user in a session
   */
  async startActivity(
    userId: string,
    sessionId: string,
    activityType: ActivityType,
    activityName: string,
    initialState: any = {},
    metadata: Record<string, any> = {}
  ): Promise<IActivity> {
    // Ensure activityType is never null or undefined
    if (!activityType) {
      logger.warn(
        `Received null/undefined activity type in startActivity. Defaulting to ROLEPLAY.`
      );
      activityType = ActivityType.ROLEPLAY;
    }

    logger.info(
      `Starting activity ${activityType} (${activityName}) for user ${userId} in session ${sessionId}`
    );

    // End any active activities for this session first
    await this.endActiveActivities(userId, sessionId);

    // Clear the in-memory chat history for this session to prepare for activity-specific views
    // This doesn't delete messages from DB, just affects what's shown in client
    const cleared = chatSessionManager.clearSessionHistory(sessionId);
    logger.debug(
      `${cleared ? "Cleared" : "Failed to clear"} chat history for session ${sessionId} when starting activity ${activityType}`
    );

    // Create initial state from factory
    const createdState = activityFactoryService.createInitialState(
      activityType,
      activityName,
      "", // No input text here, since we have the activity type & explicit initialState
      initialState
    );

    // Create the activity document
    const activity = new Activity({
      _id: new mongoose.Types.ObjectId().toString(),
      userId,
      sessionId,
      type: activityType,
      name: activityName,
      startTime: new Date(),
      isActive: true,
      state: {
        type: activityType, // Ensure state type matches activity type
        data: createdState,
      },
      messageIds: [],
      contextIds: [],
      goal: initialState.goal || "",
      userGoal: initialState.userGoal || "",
      assistantGoal: initialState.assistantGoal || "",
      metadata: {
        ...metadata,
        createdAt: new Date(),
      },
    });

    await activity.save();
    logger.debug(`Activity ${activity._id} created successfully`);

    // Create activity context
    const activityContext: ActivityContext = {
      activityId: activity._id,
      activityType: activity.type as ActivityType,
      activityName: activity.name,
      state: activity.state,
      startedAt: activity.startTime,
      parameters: metadata,
    };

    // Inject the activity context
    const contextResult = await contextService.injectContext(
      userId,
      ContextType.ACTIVITY,
      ContextDuration.MEDIUM_TERM,
      activityContext,
      "activity-service",
      { sessionId }
    );

    // Add the context ID to the activity
    activity.contextIds.push(contextResult.id);
    await activity.save();

    // Update companion state with the activity
    try {
      await companionStateService.addThought(
        userId,
        `Started ${activityType} activity: ${activityName}`,
        "observation",
        4,
        { activityId: activity._id }
      );
    } catch (error) {
      logger.warn(
        `Failed to update companion state for activity ${activity._id}:`,
        error
      );
    }

    return activity;
  }

  /**
   * End an activity by ID
   */
  async endActivity(activityId: string): Promise<IActivity | null> {
    logger.info(`Ending activity ${activityId}`);

    const activity = await Activity.findById(activityId);
    if (!activity) {
      logger.warn(`Activity ${activityId} not found`);
      return null;
    }

    activity.isActive = false;
    activity.endTime = new Date();
    await activity.save();

    // Deactivate the activity context
    for (const contextId of activity.contextIds) {
      try {
        await contextService.deactivateContext(contextId);
      } catch (error) {
        logger.warn(
          `Failed to deactivate context ${contextId} for activity ${activityId}:`,
          error
        );
      }
    }

    // Update companion state
    try {
      await companionStateService.addThought(
        activity.userId,
        `Ended ${activity.type} activity: ${activity.name}`,
        "observation",
        3,
        { activityId: activity._id }
      );
    } catch (error) {
      logger.warn(
        `Failed to update companion state for activity end ${activityId}:`,
        error
      );
    }

    // Notify client via SSE that the activity has ended
    try {
      if (sseConnections[activity.sessionId]) {
        sseConnections[activity.sessionId].send(
          {
            activityId: activity._id,
            isActive: false,
            type: activity.type,
            name: activity.name,
            endTime: activity.endTime,
          },
          "activityUpdate"
        );
        logger.info(
          `Sent activityUpdate SSE event for ended activity ${activityId}`
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to send activityUpdate SSE event for activity ${activityId}:`,
        error
      );
    }

    // Trigger background summarization (don't await)
    this._summarizeAndRecordActivity(activity)
      .then(() =>
        logger.info(
          `Background summarization initiated for activity ${activityId}`
        )
      )
      .catch((err) =>
        logger.error(
          `Background summarization failed to initiate for activity ${activityId}:`,
          err
        )
      );

    return activity;
  }

  /**
   * End all active activities for a user in a session
   */
  async endActiveActivities(userId: string, sessionId: string): Promise<void> {
    logger.debug(
      `Ending all active activities for user ${userId} in session ${sessionId}`
    );

    const activeActivities = await Activity.find({
      userId,
      sessionId,
      isActive: true,
    });

    for (const activity of activeActivities) {
      await this.endActivity(activity._id);
    }
  }

  /**
   * Get the current active activity for a user in a session
   */
  async getActiveActivity(
    userId: string,
    sessionId: string
  ): Promise<IActivity | null> {
    return Activity.findOne({
      userId,
      sessionId,
      isActive: true,
    });
  }

  /**
   * Update the state of an activity, potentially using AI assistance.
   */
  async updateActivityState(
    activityId: string,
    stateUpdateData?: Partial<IActivityState["data"]> & {
      // Allow passing specific top-level goal updates
      userGoal?: string;
      assistantGoal?: string;
    },
    metadata?: Record<string, any>,
    userMessage?: string,
    assistantMessage?: string
  ): Promise<IActivity | null> {
    logger.debug(`Updating state for activity ${activityId}`);

    const activity = await Activity.findById(activityId);
    if (!activity || !activity.isActive) {
      logger.warn(`Activity ${activityId} not found or not active`);
      return null;
    }

    // Separate explicit data updates from potential goal updates
    const explicitDataUpdates = stateUpdateData ? { ...stateUpdateData } : {};
    delete explicitDataUpdates.userGoal; // Remove top-level goals from data updates
    delete explicitDataUpdates.assistantGoal;
    let needsStateMarkModified = false; // Flag to mark state as modified

    // AI-Assisted State Update (Optional)
    if (
      ENABLE_AI_ACTIVITY_STATE_UPDATE &&
      userMessage &&
      assistantMessage &&
      activity.type === ActivityType.ROLEPLAY // Extendable to other types later
    ) {
      try {
        const aiUpdates = await this._getAIStateUpdates(
          activity,
          userMessage,
          assistantMessage
        );

        // Apply AI-derived state data updates
        if (Object.keys(aiUpdates.dataUpdates).length > 0) {
          Object.assign(activity.state.data, aiUpdates.dataUpdates);
          // Don't necessarily mark modified here, let the specific helper do it if needed
          // needsStateMarkModified = true;
        }

        // Apply AI-derived new events
        if (
          aiUpdates.newEvents &&
          aiUpdates.newEvents.length > 0 &&
          activity.type === ActivityType.ROLEPLAY
        ) {
          // We pass newEvents directly to the specific update function
          this._updateRoleplayState(
            activity,
            aiUpdates.dataUpdates as any,
            aiUpdates.newEvents
          );
          needsStateMarkModified = true; // Events modified state
        }

        // Apply potential AI-derived goal updates
        if (aiUpdates.userGoal !== undefined) {
          activity.userGoal =
            typeof aiUpdates.userGoal === "string"
              ? aiUpdates.userGoal
              : undefined;
        }
        if (aiUpdates.assistantGoal !== undefined) {
          activity.assistantGoal =
            typeof aiUpdates.assistantGoal === "string"
              ? aiUpdates.assistantGoal
              : undefined;
        }

        logger.debug("Applied AI state updates:", aiUpdates);
      } catch (error) {
        logger.error(
          `Error applying AI state updates for ${activityId}:`,
          error
        );
      }
    }

    // Apply explicit state data updates (overwriting AI updates if conflicts exist)
    if (Object.keys(explicitDataUpdates).length > 0) {
      logger.debug(
        "Applying explicit state data updates:",
        explicitDataUpdates
      );
      // Use specific update functions based on type for better validation/logic
      if (activity.type === ActivityType.ROLEPLAY) {
        // Pass only explicit data updates here; newEvents (if any) were handled with AI updates
        // Only call if there are explicit data updates to apply
        if (Object.keys(explicitDataUpdates).length > 0) {
          this._updateRoleplayState(activity, explicitDataUpdates as any, null);
          needsStateMarkModified = true; // Explicit updates modified state
        }
      } else if (activity.type === ActivityType.GAME) {
        if (Object.keys(explicitDataUpdates).length > 0) {
          this._updateGameState(activity, explicitDataUpdates as any);
          needsStateMarkModified = true;
        }
      } else if (activity.type === ActivityType.BRAINSTORM) {
        if (Object.keys(explicitDataUpdates).length > 0) {
          this._updateBrainstormState(activity, explicitDataUpdates as any);
          needsStateMarkModified = true;
        }
      } else {
        // Generic update for CUSTOM or other types
        if (Object.keys(explicitDataUpdates).length > 0) {
          Object.assign(activity.state.data, explicitDataUpdates);
          needsStateMarkModified = true;
        }
      }
    }

    // Apply explicit top-level goal updates
    let goalsUpdated = false;
    if (
      stateUpdateData?.userGoal !== undefined &&
      activity.userGoal !== stateUpdateData.userGoal
    ) {
      activity.userGoal = stateUpdateData.userGoal;
      goalsUpdated = true;
      logger.debug(`Updated userGoal for activity ${activityId}`);
    }
    if (
      stateUpdateData?.assistantGoal !== undefined &&
      activity.assistantGoal !== stateUpdateData.assistantGoal
    ) {
      activity.assistantGoal = stateUpdateData.assistantGoal;
      goalsUpdated = true;
      logger.debug(`Updated assistantGoal for activity ${activityId}`);
    }

    // Update metadata if provided
    if (metadata) {
      activity.metadata = { ...(activity.metadata || {}), ...metadata };
      activity.markModified("metadata"); // Mark mixed type as modified
      logger.debug(`Updated metadata for activity ${activityId}`);
    }

    // Mark state as modified if necessary before saving
    if (needsStateMarkModified) {
      activity.markModified("state");
      logger.debug(`Marked state as modified for activity ${activityId}`);
    }

    // Save the activity if state or goals were modified
    if (needsStateMarkModified || goalsUpdated || metadata) {
      await activity.save();
      logger.info(`Activity ${activityId} state/goals/metadata saved.`);

      // Update the context in the context service as well
      await this._updateActivityContext(activity);
    } else {
      logger.debug(
        `No state/goal/metadata changes detected for activity ${activityId}, skipping save.`
      );
    }

    return activity;
  }

  /**
   * Helper to update the context document associated with an activity.
   */
  private async _updateActivityContext(activity: IActivity): Promise<void> {
    if (!activity.contextIds || activity.contextIds.length === 0) {
      logger.warn(`No context IDs found for activity ${activity._id}`);
      return;
    }

    const activityContextData: ActivityContext = {
      activityId: activity._id,
      activityType: activity.type as ActivityType,
      activityName: activity.name,
      state: activity.state,
      startedAt: activity.startTime,
      parameters: activity.metadata,
    };

    try {
      // Update the first context ID associated with the activity
      await contextService.updateContext(activity.contextIds[0], {
        data: activityContextData,
      });
    } catch (error) {
      logger.warn(
        `Failed to update context for activity ${activity._id}:`,
        error
      );
    }
  }

  /**
   * Update roleplay-specific state.
   */
  private _updateRoleplayState(
    activity: IActivity,
    stateUpdates: Partial<IRoleplayState>,
    newEvents: string[] | null
  ): void {
    if (!activity || activity.type !== ActivityType.ROLEPLAY) return;

    const currentState = activity.state.data as IRoleplayState;

    // Update top-level fields (scenario, setting, location, scene, mood, plot)
    if (stateUpdates.scenario !== undefined)
      currentState.scenario = stateUpdates.scenario;
    if (stateUpdates.setting !== undefined)
      currentState.setting = stateUpdates.setting;
    if (stateUpdates.currentLocation !== undefined)
      currentState.currentLocation = stateUpdates.currentLocation;
    if (stateUpdates.currentScene !== undefined)
      currentState.currentScene = stateUpdates.currentScene;
    if (stateUpdates.mood !== undefined) currentState.mood = stateUpdates.mood;
    if (stateUpdates.plot !== undefined) currentState.plot = stateUpdates.plot;

    // Update characters array
    if (stateUpdates.characters && Array.isArray(stateUpdates.characters)) {
      stateUpdates.characters.forEach((updateChar) => {
        if (!updateChar.name) return; // Skip updates without a name
        const existingCharIndex = currentState.characters.findIndex(
          (c) => c.name === updateChar.name
        );
        if (existingCharIndex > -1) {
          // Update existing character fields if provided in the update
          const existingChar = currentState.characters[existingCharIndex];
          if (updateChar.description !== undefined)
            existingChar.description = updateChar.description;
          if (updateChar.personality !== undefined)
            existingChar.personality = updateChar.personality;
          if (updateChar.background !== undefined)
            existingChar.background = updateChar.background;
          if (updateChar.appearance !== undefined)
            existingChar.appearance = updateChar.appearance;
          if (updateChar.motivation !== undefined)
            existingChar.motivation = updateChar.motivation;
          if (updateChar.goal !== undefined)
            existingChar.goal = updateChar.goal;
          if (updateChar.role !== undefined)
            existingChar.role = updateChar.role;
          if (updateChar.status !== undefined)
            existingChar.status = updateChar.status;
          if (updateChar.mood !== undefined)
            existingChar.mood = updateChar.mood;
          logger.debug(`Updated character: ${updateChar.name}`);
        } else {
          // Option 1: Add the new character if it doesn't exist
          // currentState.characters.push(updateChar as any); // Add as new
          // logger.debug(`Added new character: ${updateChar.name}`);
          // Option 2: Log a warning if strict updates are preferred
          logger.warn(
            `Character "${updateChar.name}" not found in current state for update.`
          );
        }
      });
    }

    // Append new events to both logs
    if (newEvents && Array.isArray(newEvents) && newEvents.length > 0) {
      const currentMood = currentState.mood; // Get mood at the time of these events
      const timestamp = new Date();

      // Add to full event log
      const logEntries: IRoleplayEventLogEntry[] = newEvents.map(
        (eventText: string) => ({
          event: eventText,
          mood: currentMood,
          timestamp: timestamp,
        })
      );
      currentState.eventLog = [...(currentState.eventLog || []), ...logEntries];

      // Add event text to recent events window (e.g., last 20 for context)
      currentState.recentEvents = [
        ...(currentState.recentEvents || []),
        ...newEvents,
      ].slice(-20);
      logger.debug(`Added ${newEvents.length} event(s) to logs.`);
    }

    // Update items and locations (simple merge for now)
    if (stateUpdates.items) {
      currentState.items = {
        ...(currentState.items || {}),
        ...stateUpdates.items,
      };
    }
    if (stateUpdates.locations) {
      currentState.locations = {
        ...(currentState.locations || {}),
        ...stateUpdates.locations,
      };
    }

    // No need to call markModified here, it's handled in the calling function
  }

  /**
   * Update game-specific state.
   */
  private _updateGameState(
    activity: IActivity,
    stateData: Partial<IGameState>
  ): void {
    const currentState = activity.state.data as IGameState;

    // Generic merge for most game fields
    const updatedState = { ...currentState, ...stateData };

    // Handle potential nested objects like 'score' if needed
    if (stateData.score && currentState.score) {
      updatedState.score = { ...currentState.score, ...stateData.score };
    } else {
      updatedState.score = stateData.score || currentState.score;
    }

    // Specific logic if needed (e.g., tic-tac-toe board update)
    if (currentState.gameType === "tictactoe" && stateData.board) {
      updatedState.board = stateData.board;
    }

    activity.state.data = updatedState;
  }

  /**
   * Update brainstorm-specific state.
   */
  private _updateBrainstormState(
    activity: IActivity,
    stateData: Partial<IBrainstormState>
  ): void {
    const currentState = activity.state.data as IBrainstormState;

    // Update simple fields
    if (stateData.topic) currentState.topic = stateData.topic;
    if (stateData.phase) currentState.phase = stateData.phase;
    if (stateData.goal) currentState.goal = stateData.goal;

    // Handle arrays: Append new unique items
    if (stateData.ideas) {
      currentState.ideas = [
        ...(currentState.ideas || []),
        ...stateData.ideas.filter(
          (newIdea) =>
            !currentState.ideas?.some((oldIdea) => oldIdea.id === newIdea.id)
        ),
      ];
    }
    if (stateData.categories) {
      currentState.categories = [
        ...(currentState.categories || []),
        ...stateData.categories.filter(
          (cat) => !currentState.categories?.includes(cat)
        ),
      ];
    }
    if (stateData.constraints) {
      currentState.constraints = [
        ...(currentState.constraints || []),
        ...stateData.constraints.filter(
          (con) => !currentState.constraints?.includes(con)
        ),
      ];
    }

    activity.state.data = currentState;
  }

  /**
   * Use AI to suggest state updates based on recent messages.
   */
  private async _getAIStateUpdates(
    activity: IActivity,
    userMessage: string,
    assistantMessage: string
  ): Promise<{
    dataUpdates: Partial<IActivityState["data"]>;
    newEvents?: string[] | null;
    userGoal?: string | null;
    assistantGoal?: string | null;
  }> {
    if (activity.type !== ActivityType.ROLEPLAY) {
      logger.warn(
        `AI state update requested for non-roleplay activity type: ${activity.type}`
      );
      return { dataUpdates: {} };
    }

    // 1. Get recent message history relevant to the activity
    const historyText = await this._getRecentMessageHistory(activity);

    // 2. Extract relevant information from the latest messages
    const userMessageContent = userMessage.trim();
    const assistantMessageContent = assistantMessage.trim();

    // 3. Construct the prompt for AI
    const prompt = `
Analyze the following conversation snippet from a roleplay activity.
Identify changes or confirmations for the following state fields based *only* on the LATEST user and assistant messages:
-- currentScene: (A brief description of the current immediate setting or focus of the scene)
-- mood: (The overall mood of the scene: e.g., tense, humorous, romantic, mysterious)
-- currentLocation: (The specific place within the broader setting, if mentioned or changed)
+- userGoal: (The user's stated or implied goal for the activity, if changed/clarified)
+- assistantGoal: (The assistant's stated or implied goal for the activity, if changed/clarified)
+- newEvents: (List strings describing significant events/actions that just happened, max 3)
- characterUpdates: (List any changes to character status or mood. Format as: { "name": "...", "status": "...", "mood": "..." })
-- keyEvents: (List any significant plot points or actions that occurred in the latest exchange, max 3)
+
+Conversation History (Oldest to Newest):
+${historyText}
+
+Latest User Message:
+${userMessageContent || "[Not provided]"}
+
+Latest Assistant Message:
+${assistantMessageContent || "[Not provided]"}
+
+Output ONLY JSON in the following format, using null if no update detected for a field. For characterUpdates, provide an array of objects. For newEvents, provide an array of strings.
 {
    dataUpdates: {
        currentScene: ${activity.state.data.currentScene ? `"${activity.state.data.currentScene}"` : "null"},
        mood: ${activity.state.data.mood ? `"${activity.state.data.mood}"` : "null"},
        currentLocation: ${activity.state.data.currentLocation ? `"${activity.state.data.currentLocation}"` : "null"},
        userGoal: ${activity.userGoal ? `"${activity.userGoal}"` : "null"},
        assistantGoal: ${activity.assistantGoal ? `"${activity.assistantGoal}"` : "null"}
    },
    characterUpdates: [],
    newEvents: []
}
`;

    let responseText = "[No response from AI]"; // Declare outside try block
    try {
      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, temperature: 0.3, max_tokens: 300 }, // Use a small, focused model
        "You are an AI assistant analyzing conversation for state changes. Output ONLY valid JSON.",
        activity.userId
      );

      responseText = response.text.trim().replace(/```json\n?|\n?```/g, "");
      if (responseText && responseText !== "{}") {
        try {
          // Sanitize the JSON response before parsing
          const sanitizedJson = this._sanitizeJsonResponse(responseText);
          const parsedUpdates = JSON.parse(sanitizedJson);

          // Initialize the return structure
          const result: {
            dataUpdates: Partial<IActivityState["data"]>;
            newEvents?: string[] | null;
            userGoal?: string | null;
            assistantGoal?: string | null;
          } = { dataUpdates: {}, newEvents: null };

          // Extract top-level state data updates (excluding goals)
          if (parsedUpdates.dataUpdates) {
            if (parsedUpdates.dataUpdates.currentScene !== undefined)
              result.dataUpdates.currentScene =
                parsedUpdates.dataUpdates.currentScene;
            if (parsedUpdates.dataUpdates.mood !== undefined)
              result.dataUpdates.mood = parsedUpdates.dataUpdates.mood;
            if (parsedUpdates.dataUpdates.currentLocation !== undefined)
              result.dataUpdates.currentLocation =
                parsedUpdates.dataUpdates.currentLocation;
            // Do NOT extract goals here, they are handled separately below
          }

          // Extract character updates
          if (
            parsedUpdates.characterUpdates &&
            Array.isArray(parsedUpdates.characterUpdates)
          ) {
            // We structure this to be compatible with how _updateRoleplayState expects it
            result.dataUpdates.characters = parsedUpdates.characterUpdates.map(
              (charUpdate: any) => ({
                name: charUpdate.name,
                status:
                  charUpdate.status !== undefined
                    ? charUpdate.status
                    : undefined,
                mood:
                  charUpdate.mood !== undefined ? charUpdate.mood : undefined,
                goal:
                  charUpdate.goal !== undefined ? charUpdate.goal : undefined,
              })
            );
          }

          // Extract new events
          if (
            parsedUpdates.newEvents &&
            Array.isArray(parsedUpdates.newEvents)
          ) {
            result.newEvents = parsedUpdates.newEvents;
          }

          // Extract top-level goals (userGoal, assistantGoal)
          // Check if the field exists in the AI response *and* is different from null
          if (parsedUpdates.userGoal !== undefined)
            result.userGoal = parsedUpdates.userGoal;
          if (parsedUpdates.assistantGoal !== undefined)
            result.assistantGoal = parsedUpdates.assistantGoal;

          logger.debug("Parsed AI state updates:", result);
          return result;
        } catch (parseError) {
          logger.error(
            `Error parsing JSON response for activity ${activity._id}: ${parseError}`,
            { responseText }
          );
          return { dataUpdates: {} }; // Return empty object on JSON parse error
        }
      } else {
        logger.debug("AI returned no state updates.");
        return { dataUpdates: {} }; // Return empty if no updates
      }
    } catch (error) {
      logger.error(
        `Error parsing AI state updates for activity ${activity._id}: ${error}`,
        { prompt, responseText } // Include context in error log
      );
      return { dataUpdates: {} }; // Return empty object on error
    }
  }

  /**
   * Sanitizes JSON response from AI to handle common formatting issues
   * @param jsonStr The JSON string to sanitize
   * @returns A valid JSON string
   */
  private _sanitizeJsonResponse(jsonStr: string): string {
    try {
      // First, try direct parsing - if it works, just return the original
      JSON.parse(jsonStr);
      return jsonStr;
    } catch (e) {
      // Only attempt fixing if direct parsing fails
      logger.debug("Attempting to sanitize malformed JSON response");

      // Remove any leading/trailing text that's not part of the JSON
      let cleanJson = jsonStr.trim();

      // Find the first { and last }
      const firstBrace = cleanJson.indexOf("{");
      const lastBrace = cleanJson.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }

      // Fix unquoted property names (convert property: value to "property": value)
      cleanJson = cleanJson.replace(
        /([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g,
        '$1"$2"$3'
      );

      // Remove trailing commas before closing brackets
      cleanJson = cleanJson.replace(/,(\s*[}\]])/g, "$1");

      // Log the sanitized JSON for debugging
      logger.debug("Sanitized JSON:", {
        original: jsonStr,
        sanitized: cleanJson,
      });

      // Attempt to parse again to validate
      try {
        JSON.parse(cleanJson);
        return cleanJson;
      } catch (err) {
        // If still fails, log and return an empty valid JSON object
        logger.error("JSON sanitization failed:", err);
        return "{}";
      }
    }
  }

  /**
   * Fetches the text content of the last few messages associated with an activity.
   */
  private async _getRecentMessageHistory(
    activity: IActivity,
    limit: number = 10,
    includeDeleted: boolean = false
  ): Promise<string> {
    if (!activity.messageIds || activity.messageIds.length === 0) {
      return "No recent messages available for this activity.";
    }

    // Get the last 'limit' message IDs
    const recentMessageIds = activity.messageIds.slice(-limit);

    try {
      // Build query
      const query: any = {
        _id: { $in: recentMessageIds },
      };

      // Only include non-deleted messages if includeDeleted is false
      if (!includeDeleted) {
        query.isDeleted = { $ne: true };
      }

      // Fetch messages from DB based on IDs
      const messages = await MessageModel.find(query)
        .sort({ timestamp: 1 }) // Sort oldest to newest
        .select("role content timestamp isDeleted") // Select only necessary fields
        .lean();

      if (!messages || messages.length === 0) {
        return "Could not retrieve recent messages.";
      }

      // Format messages into a string
      return messages
        .map(
          (
            msg: Pick<IMessage, "role" | "content" | "timestamp" | "isDeleted">
          ) => {
            const prefix = msg.isDeleted ? "[DELETED] " : "";
            return `${prefix}${msg.role.toUpperCase()} (${new Date(msg.timestamp).toLocaleTimeString()}): ${msg.content}`;
          }
        )
        .join("\n---\n");
    } catch (error) {
      logger.error(
        `Error fetching message history for activity ${activity._id}:`,
        error
      );
      return "Error retrieving message history.";
    }
  }

  /**
   * Process a user message in the context of an activity
   * Updates engagement tracking and determines if message is relevant
   */
  async processActivityMessage(
    activityId: string,
    messageId: string,
    messageText: string
  ): Promise<{
    isRelevant: boolean;
    shouldPromptContinuation: boolean;
    activity: IActivity | null; // Can return null if activity not found
  }> {
    const activity = await Activity.findById(activityId);
    if (!activity || !activity.isActive) {
      return {
        isRelevant: false,
        shouldPromptContinuation: false,
        activity: null, // Return null if activity not found or inactive
      };
    }

    // Associate message with activity
    if (!activity.messageIds.includes(messageId)) {
      activity.messageIds.push(messageId);
    }

    // Calculate message relevance to the activity
    const relevanceScore = activityFactoryService.calculateMessageRelevance(
      activity.type as ActivityType,
      activity.state.data,
      messageText
    );

    // Update engagement tracking
    if (!activity.engagement) {
      activity.engagement = {
        messageCount: 0,
        relevanceScores: [],
        consecutiveIrrelevantMessages: 0,
        userParticipationScore: 5,
      };
    }

    activity.engagement.messageCount++;

    // Track the relevance score
    activity.engagement.relevanceScores.push(relevanceScore);
    if (activity.engagement.relevanceScores.length > MAX_RELEVANCE_HISTORY) {
      activity.engagement.relevanceScores.shift(); // Remove oldest score
    }

    // Update consecutive irrelevant messages count
    if (relevanceScore < RELEVANCE_SCORE_THRESHOLD) {
      activity.engagement.consecutiveIrrelevantMessages++;
    } else {
      activity.engagement.consecutiveIrrelevantMessages = 0;
      activity.engagement.lastRelevantMessageId = messageId;
      activity.engagement.lastRelevantMessageTime = new Date();
    }

    // Determine if we should prompt for continuation
    const shouldPromptContinuation =
      activity.engagement.consecutiveIrrelevantMessages >=
        IRRELEVANT_THRESHOLD &&
      (!activity.engagement.lastPromptTime ||
        new Date().getTime() - activity.engagement.lastPromptTime.getTime() >
          5 * 60 * 1000); // Only prompt every 5 minutes

    // Reset prompt time if we are prompting
    // Note: The actual *sending* of the prompt is handled in EnhancedChatService
    if (shouldPromptContinuation) {
      // We don't set lastPromptTime here anymore,
      // it's set in EnhancedChatService *after* the prompt is actually sent.
    }

    await activity.save();

    return {
      isRelevant: relevanceScore >= RELEVANCE_SCORE_THRESHOLD,
      shouldPromptContinuation,
      activity, // Return the potentially updated activity object
    };
  }

  /**
   * Associate a message with an activity (now primarily handled by processActivityMessage)
   */
  async addMessageToActivity(
    activityId: string,
    messageId: string,
    messageText?: string // messageText is optional here, prefer processActivityMessage
  ): Promise<IActivity | null> {
    logger.debug(`Adding message ${messageId} to activity ${activityId}`);

    // If messageText is provided, use the processing method for engagement tracking
    if (messageText) {
      const result = await this.processActivityMessage(
        activityId,
        messageId,
        messageText
      );
      return result.activity;
    }

    // Fallback for just linking the ID without processing (less ideal)
    const activity = await Activity.findById(activityId);
    if (!activity || !activity.isActive) {
      logger.warn(
        `Activity ${activityId} not found or inactive when adding message`
      );
      return null;
    }

    if (!activity.messageIds.includes(messageId)) {
      activity.messageIds.push(messageId);
      await activity.save();
    }

    return activity;
  }

  /**
   * Gets all activities for a user
   */
  async getUserActivities(
    userId: string,
    options: {
      sessionId?: string;
      type?: ActivityType;
      isActive?: boolean;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<IActivity[]> {
    const query: any = { userId };

    if (options.sessionId) query.sessionId = options.sessionId;
    if (options.type) query.type = options.type;
    if (options.isActive !== undefined) query.isActive = options.isActive;

    const activities = await Activity.find(query)
      .sort({ startTime: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20)
      .exec();

    return activities;
  }

  /**
   * Gets a continuation prompt for an activity when relevance drops
   */
  getContinuationPrompt(activity: IActivity): string {
    if (!activity) return "Would you like to continue our conversation?";

    switch (activity.type) {
      case ActivityType.ROLEPLAY:
        const state = activity.state.data as IRoleplayState;
        return `I notice we've drifted a bit from our ${activity.name} roleplay. Would you like to continue with the scenario "${state.scenario}"? We were in the middle of ${state.currentScene || "the scene"}.`;

      case ActivityType.GAME:
        const gameState = activity.state.data as IGameState;
        if (gameState.gameType === "tictactoe") {
          return `We're still playing our Tic-Tac-Toe game. It's ${gameState.currentPlayer}'s turn. Would you like to continue?`;
        }
        return `We're in the middle of our ${activity.name} game. Would you like to continue playing?`;

      case ActivityType.BRAINSTORM:
        const brainstormState = activity.state.data as IBrainstormState;
        return `We were brainstorming about "${brainstormState.topic}". We have ${brainstormState.ideas?.length || 0} ideas so far. Would you like to continue?`;

      default:
        return `Would you like to continue with the ${activity.name} activity we started?`;
    }
  }

  /**
   * Process an activity command (start, end, update)
   * This is the main entry point for handling activity commands from chat
   */
  async processActivityCommand(
    userId: string,
    sessionId: string,
    commandText: string,
    messageId?: string
  ): Promise<{
    handled: boolean;
    activityId?: string;
    activity?: IActivity | null;
    response?: string;
  }> {
    logger.info(
      `checking for activity command from user ${userId}: ${commandText}`
    );
    const lowerCommandText = commandText.toLowerCase().trim();

    // Check if command is for starting an activity
    const isStartCommand =
      /^\/(start|begin|roleplay|rp|game|brainstorm|ideate|startactivity)/i.test(
        lowerCommandText
      ) ||
      /^(start|begin|let's play|let's start|play a game|start roleplay|start brainstorming)/i.test(
        lowerCommandText
      );

    logger.info(
      `isStartCommand: ${isStartCommand} for lowerCommandText: ${lowerCommandText}`
    );

    if (isStartCommand) {
      let activityType: ActivityType | null = null;
      let activityName = "Activity";
      let initialParams: Record<string, any> = {};

      // Specific command parsing
      const roleplayMatch =
        lowerCommandText.match(/^\/(roleplay|rp)(?:\s+(.+))?$/i) ||
        lowerCommandText.match(
          /^(start|begin)\s+(?:a\s+)?(roleplay|roleplaying)(?:\s+(.+))?$/i
        );
      const gameMatch =
        lowerCommandText.match(/^\/game(?:\s+(.+))?$/i) ||
        lowerCommandText.match(
          /^(start|play|begin)\s+(?:a\s+)?game(?:\s+of\s+)?(?:\s+(.+))?$/i
        );
      const brainstormMatch =
        lowerCommandText.match(/^\/(brainstorm|ideate)(?:\s+(.+))?$/i) ||
        lowerCommandText.match(
          /^(start|begin)\s+(?:a\s+)?(brainstorm|brainstorming|ideation)(?:\s+about\s+)?(?:\s+(.+))?$/i
        );
      const genericStartMatch = lowerCommandText.match(
        /^\/(start|begin|startactivity)(?:\s+(roleplay|game|brainstorm(?:ing)?))?(?:\s+(.+))?$/i
      );

      if (roleplayMatch) {
        activityType = ActivityType.ROLEPLAY;
        activityName =
          roleplayMatch[2] || roleplayMatch[3] || "Roleplay Session";
        initialParams = activityFactoryService.parseActivityParameters(
          activityType,
          commandText
        );
      } else if (gameMatch) {
        activityType = ActivityType.GAME;
        activityName = gameMatch[1] || gameMatch[2] || "Game Session";
        initialParams = activityFactoryService.parseActivityParameters(
          activityType,
          commandText
        );
      } else if (brainstormMatch) {
        activityType = ActivityType.BRAINSTORM;
        activityName =
          brainstormMatch[2] || brainstormMatch[3] || "Brainstorm Topic";
        initialParams = activityFactoryService.parseActivityParameters(
          activityType,
          commandText
        );
        if (!initialParams.topic) initialParams.topic = activityName;
      } else if (genericStartMatch) {
        let activityType: ActivityType | null = null;
        const typeHint = genericStartMatch[2]?.toLowerCase() || "";
        const activityName = genericStartMatch[3] || "";

        if (typeHint === "roleplay") activityType = ActivityType.ROLEPLAY;
        else if (typeHint === "game") activityType = ActivityType.GAME;
        else if (typeHint === "brainstorm" || typeHint === "brainstorming")
          activityType = ActivityType.BRAINSTORM;
        else {
          // Try to infer activity type from the activity name if type hint is not provided
          const lowerActivityName = activityName.toLowerCase();
          if (
            lowerActivityName.includes("roleplay") ||
            lowerActivityName.includes("rp") ||
            lowerActivityName.includes("role play")
          )
            activityType = ActivityType.ROLEPLAY;
          else if (
            lowerActivityName.includes("game") ||
            lowerActivityName.includes("play")
          )
            activityType = ActivityType.GAME;
          else if (
            lowerActivityName.includes("brainstorm") ||
            lowerActivityName.includes("brainstorming") ||
            lowerActivityName.includes("ideate") ||
            lowerActivityName.includes("ideas")
          )
            activityType = ActivityType.BRAINSTORM;
          else if (genericStartMatch[1]?.toLowerCase() === "startactivity") {
            // Default to brainstorming when /startactivity is used without type specification
            activityType = ActivityType.BRAINSTORM;
            logger.info(
              `Defaulting to BRAINSTORM activity for /startactivity command`
            );
          }
        }

        // If we still couldn't determine the activity type, default to ROLEPLAY
        if (!activityType) {
          activityType = ActivityType.ROLEPLAY;
          logger.info(
            `Unable to determine activity type from command, defaulting to ROLEPLAY`
          );
        }

        initialParams = activityFactoryService.parseActivityParameters(
          activityType,
          commandText
        );
      } else {
        // Natural language without explicit command - needs inference (future task)
        // Check if name suggests a type
        if (activityName.toLowerCase().includes("roleplay"))
          activityType = ActivityType.ROLEPLAY;
        else if (
          activityName.toLowerCase().includes("game") ||
          activityName.toLowerCase().includes("tic tac toe")
        )
          activityType = ActivityType.GAME;
        else if (activityName.toLowerCase().includes("brainstorm"))
          activityType = ActivityType.BRAINSTORM;

        if (!activityType) {
          return {
            handled: false,
            response:
              "Could not determine the activity type. Try /start roleplay, /start game, or /start brainstorm.",
          };
        }
        initialParams = activityFactoryService.parseActivityParameters(
          activityType,
          commandText
        );
      }

      console.log(
        "Starting activity",
        activityType,
        activityName,
        initialParams
      );

      // Ensure activityType is never null or undefined before starting the activity
      if (!activityType) {
        activityType = ActivityType.ROLEPLAY; // Default to ROLEPLAY as fallback
        logger.warn(
          `Activity type was null/undefined before starting activity. Defaulting to ROLEPLAY.`
        );
      }

      // Start the determined activity
      const activity = await this.startActivity(
        userId,
        sessionId,
        activityType,
        activityName ||
          (activityType === ActivityType.BRAINSTORM
            ? "Brainstorming Session"
            : activityType === ActivityType.ROLEPLAY
              ? "Roleplay Session"
              : "Game Session"),
        initialParams,
        { initialCommand: commandText }
      );

      if (messageId) {
        await this.addMessageToActivity(activity._id, messageId, commandText);
      }

      return {
        handled: true,
        activityId: activity._id,
        activity,
        response: `Starting ${activity.type}: ${activity.name}${activity.goal ? ` (Goal: ${activity.goal})` : ""}`,
      };
    }

    // --- End Commands ---
    const endActivityMatch =
      // Regex 1: Matches /command OR /command anything_else (doesn't care what follows)
      lowerCommandText.match(/^\/(end|stop|exit|quit|endactivity)\b/i) ||
      // Regex 2: Matches command OR command the/current activity/type
      lowerCommandText.match(
        /^(end|stop|exit|quit)\b(?:\s+(?:the|current)?\s*(?:activity|roleplay|game|brainstorm))?\s*$/i
      );

    if (endActivityMatch) {
      console.log(
        `[ActivityService][processActivityCommand] endActivityMatch: ${endActivityMatch}`
      );
      const currentActivity = await this.getActiveActivity(userId, sessionId);

      if (!currentActivity) {
        return {
          handled: true,
          response: "There's no active activity to end.",
        };
      }

      const endedActivity = await this.endActivity(currentActivity._id);

      if (messageId) {
        await this.addMessageToActivity(
          currentActivity._id,
          messageId,
          commandText
        );
      }

      return {
        handled: true,
        activityId: currentActivity._id,
        activity: endedActivity,
        response: `Ended ${currentActivity.type} activity: ${currentActivity.name}`,
      };
    }

    // --- Continuation Confirmation ---
    const continuationMatch =
      lowerCommandText.match(/^\/(continue|resume|stay)$/i) ||
      lowerCommandText.match(
        /^(yes|continue|resume|stay|keep going)(?:\s+with\s+(?:the\s+)?(?:activity|roleplay|game|brainstorm))?$/i
      );

    if (continuationMatch) {
      const currentActivity = await this.getActiveActivity(userId, sessionId);

      if (!currentActivity) {
        return {
          handled: false, // Not really an activity command if there's no activity
        };
      }

      // Reset the consecutive irrelevant messages counter
      if (currentActivity.engagement) {
        currentActivity.engagement.consecutiveIrrelevantMessages = 0;
        currentActivity.engagement.lastPromptTime = new Date(); // Mark confirmation time
        await currentActivity.save();
      }

      if (messageId) {
        await this.addMessageToActivity(
          currentActivity._id,
          messageId,
          commandText
        );
      }

      return {
        handled: true,
        activityId: currentActivity._id,
        activity: currentActivity,
        response: `Continuing ${currentActivity.type} activity: ${currentActivity.name}`,
      };
    }

    // If we get here, no activity command was recognized
    return { handled: false };
  }

  /**
   * Asynchronously summarizes an ended activity and saves it to memory.
   * Updates the activity document with the summary memory ID.
   */
  private async _summarizeAndRecordActivity(
    activity: IActivity | null
  ): Promise<void> {
    if (!activity) {
      logger.warn(
        "[_summarizeAndRecordActivity] Received null activity, cannot summarize."
      );
      return;
    }

    const activityId = activity._id;
    logger.info(
      `[_summarizeAndRecordActivity] Starting summarization for ended activity: ${activityId}`
    );

    try {
      // 1. Construct context for summarization using eventLog
      let summaryContext = `Activity Type: ${activity.type}\nActivity Name: ${activity.name}\n`;
      if (activity.goal) summaryContext += `Overall Goal: ${activity.goal}\n`;
      if (activity.userGoal)
        summaryContext += `User Goal: ${activity.userGoal}\n`;
      if (activity.assistantGoal)
        summaryContext += `Assistant Goal: ${activity.assistantGoal}\n`;

      // Include relevant state details
      if (activity.type === ActivityType.ROLEPLAY) {
        const rpState = activity.state.data as IRoleplayState;
        summaryContext += `Scenario: ${rpState.scenario}\n`;
        // Add characters, final scene, key events etc.
        if (rpState.characters?.length > 0) {
          summaryContext += `Characters: ${rpState.characters.map((c) => c.name).join(", ")}\n`;
        }
        if (rpState.currentScene)
          summaryContext += `Ended in Scene: ${rpState.currentScene}\n`;

        // Use the full event log for summary context
        if (rpState.eventLog && rpState.eventLog.length > 0) {
          // Maybe summarize the log if it's very long before sending to AI
          const eventLogSummary = rpState.eventLog
            .slice(-30) // Limit context size for summary prompt
            .map(
              (e) =>
                `- ${e.event} (${e.mood || "neutral"} mood, ${e.timestamp.toLocaleTimeString()})`
            )
            .join("\n");
          summaryContext += `Event Log Highlights:\n${eventLogSummary}\n`;
        } else {
          summaryContext += `Event Log: No events recorded.\n`;
        }
      } else if (activity.type === ActivityType.GAME) {
        const gameState = activity.state.data as IGameState;
        summaryContext += `Game Type: ${gameState.gameType}\n`;
        if (gameState.winner)
          summaryContext += `Outcome: ${gameState.winner === "draw" ? "Draw" : `${gameState.winner} won`}\n`;
        if (gameState.score)
          summaryContext += `Final Score: ${JSON.stringify(gameState.score)}\n`;
      } else if (activity.type === ActivityType.BRAINSTORM) {
        const bsState = activity.state.data as IBrainstormState;
        summaryContext += `Topic: ${bsState.topic}\n`;
        summaryContext += `Final Ideas Count: ${bsState.ideas?.length || 0}\n`;
        summaryContext += `Final Phase: ${bsState.phase}\n`;
      }

      // Add message history summary (optional, could be heavy)
      // const historySummary = await this._getRecentMessageHistory(activity, 10); // Get last 10 messages
      // summaryContext += `\nMessage Summary:\n${historySummary}`;

      // 2. Construct AI Prompt
      const prompt = `Based on the following context of a completed activity, generate a concise summary (max 6 lines) highlighting the key events, outcome, or achievements.
\n+Activity Context:\n---\n+${summaryContext}\n---\n+
Concise Activity Summary (max 6 lines):`;

      // 3. Generate Summary via AI
      logger.debug(
        `[_summarizeAndRecordActivity] Generating summary for ${activityId}...`
      );
      const summaryResponse = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 300, temperature: 0.5 },
        "You are an AI assistant summarizing completed activities.",
        activity.userId
      );

      const summaryText = summaryResponse.text.trim();

      if (
        !summaryText ||
        summaryText === "[Error generating auxiliary response]"
      ) {
        logger.warn(
          `[_summarizeAndRecordActivity] AI failed to generate summary for activity ${activityId}.`
        );
        return;
      }

      logger.info(
        `[_summarizeAndRecordActivity] Generated summary for ${activityId}: ${summaryText.substring(0, 100)}...`
      );

      // 4. Save Summary to Memory
      const memory = await memoryService.addMemory(
        activity.userId,
        `Summary of '${activity.name}' (${activity.type}): ${summaryText}`,
        MemoryType.PERMANENT, // Keep summaries long-term
        "activity-summary-service",
        {
          activityId: activityId,
          activityType: activity.type,
          activityName: activity.name,
          originalGoal: activity.goal,
          userGoal: activity.userGoal,
          assistantGoal: activity.assistantGoal,
          endTime: activity.endTime?.toISOString(),
        },
        8, // High importance for activity summaries
        MemoryCategory.CUSTOM // Or define ACTIVITY_SUMMARY category
      );

      // 5. Update Activity with Memory ID
      if (memory?._id) {
        await Activity.findByIdAndUpdate(activityId, {
          $set: { summaryMemoryId: memory._id },
        });
        logger.info(
          `[_summarizeAndRecordActivity] Linked summary memory ${memory._id} to activity ${activityId}`
        );
      } else {
        logger.warn(
          `[_summarizeAndRecordActivity] Failed to save summary memory for activity ${activityId}`
        );
      }
    } catch (error) {
      logger.error(
        `[_summarizeAndRecordActivity] Error during summarization for activity ${activityId}:`,
        error
      );
    }
  }
}

// Export a singleton instance
export const activityService = new ActivityService();
