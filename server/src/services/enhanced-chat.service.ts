import { v4 as uuidv4 } from "uuid";
import {
  ChatSession,
  ChatMessage,
  ChatMessageModel,
  MessageRole,
  MessageStatus,
  ChatConfig,
  ChatSessionModel,
} from "../models/chat.model";
import { aiService } from "./ai.service";
import { contextService } from "./context.service";
import { memoryService } from "./memory.service";
import { chatSessionManager } from "./chat-session.service";
import { sessionService } from "./session.service";
import { ISession } from "../models/session.model";
import { loggerFactory } from "../utils/logger.service";
import { companionStateService } from "./companion-state.service";
import { CompanionEmotion } from "../models/companion-state.model";
import MessageModel from "../models/message.model";
import { activityService } from "./activity.service";
import { IActivity } from "../models/activity.model";
import { Activity } from "../models/activity.model";
import { IMessage } from "../models/message.model";
import { modelEnum } from "../constants/models";
import { actionManager } from "./action-manager.service";
import { actionLogService } from "./action-log.service";
import { summaryService } from "./summary.service";
import {
  messageProducerService,
  MessageSource,
} from "./kafka/message-producer.service";
import { MemoryType, MemoryCategory } from "../models/memory.model";

export type ThoughtCategory =
  | "observation"
  | "reflection"
  | "plan"
  | "question"
  | "insight";

const logger = loggerFactory.getLogger("EnhancedChatService");

// Constants for activity-related features
const IRRELEVANT_THRESHOLD = 3; // Number of consecutive irrelevant messages to prompt for continuation
const ACTION_CONFIDENCE_THRESHOLD = 0.6; // Threshold for auto-executing actions

/**
 * Enhanced chat service that integrates with memory and provides personalized responses
 */
class EnhancedChatService {
  // Whether to use Kafka for asynchronous message processing
  private _useKafka: boolean = true;

  constructor() {
    // Read environment variable to determine if Kafka should be used
    this._useKafka = process.env.ENABLE_KAFKA !== "false";
    logger.info(
      `EnhancedChatService initialized with useKafka=${this._useKafka}`
    );
  }

  /**
   * Sets whether to use Kafka for message processing
   */
  setUseKafka(useKafka: boolean): void {
    this._useKafka = useKafka;
    logger.info(`EnhancedChatService useKafka set to ${useKafka}`);
  }

  /**
   * Public entry point: Handles user message, manages session, generates response.
   * When Kafka is enabled, this will queue the message for async processing.
   * When Kafka is disabled, this will process the message synchronously.
   */
  async handleMessage(
    userId: string,
    messageText: string,
    sessionId?: string,
    clientMessageId?: string,
    config?: ChatConfig
  ): Promise<ChatMessage> {
    logger.info(
      `Handling message for user ${userId}, session ID: ${sessionId || "None provided (will use global)"}`
    );

    // 1. Ensure Session Exists
    const { persistentSession, finalSessionId, chatSession } =
      await this._ensureSession(userId, sessionId);

    if (!persistentSession || !chatSession) {
      // Error handled within _ensureSession, but double-check
      throw new Error(
        `Failed to establish session ${finalSessionId || sessionId || "global"} for user ${userId}.`
      );
    }

    // Check if Kafka is enabled for chat messages
    // This respects both global ENABLE_KAFKA and chat-specific KAFKA_CHAT_MESSAGES settings
    const useKafka =
      this._useKafka && messageProducerService.isFlowEnabled("chat_messages");

    // If Kafka is disabled or we're in fallback mode, process synchronously
    if (!useKafka) {
      logger.info(
        `Using synchronous processing for message (Kafka chat messages: ${useKafka ? "enabled" : "disabled"})`
      );
      return this._processSynchronously(
        userId,
        messageText,
        finalSessionId,
        clientMessageId,
        config,
        persistentSession,
        chatSession
      );
    }

    // Otherwise, create a placeholder message to return immediately
    // The real processing will happen asynchronously via Kafka
    const placeholderMessage = new ChatMessageModel({
      id: clientMessageId || uuidv4(),
      sessionId: finalSessionId,
      role: MessageRole.ASSISTANT,
      content: "", // Empty content for placeholder
      status: MessageStatus.PROCESSING, // Show it's still processing
      timestamp: new Date().toISOString(),
      metadata: {
        isPlaceholder: true,
        processingAsync: true,
      },
    });

    // Queue the message for async processing
    try {
      const requestId = await messageProducerService.queueChatMessage(
        userId,
        messageText,
        finalSessionId,
        MessageSource.OTHER, // Generic source, specific sources should be set by the caller
        clientMessageId,
        config
      );

      logger.info(
        `Message queued with requestId ${requestId} for async processing`
      );
      // Add requestId to the placeholder message metadata
      placeholderMessage.metadata = {
        ...placeholderMessage.metadata,
        requestId,
      };

      return placeholderMessage;
    } catch (error) {
      logger.error(`Failed to queue message for async processing: ${error}`);
      logger.info(`Falling back to synchronous processing`);

      // If queueing fails, fall back to synchronous processing
      return this._processSynchronously(
        userId,
        messageText,
        finalSessionId,
        clientMessageId,
        config,
        persistentSession,
        chatSession
      );
    }
  }

  /**
   * Process a text message from Kafka consumer
   * Similar to _processSynchronously but designed for use by message consumer
   */
  async processTextMessage(
    userId: string,
    sessionId: string,
    messageText: string,
    clientMessageId?: string,
    config?: ChatConfig
  ): Promise<{
    userMessage: ChatMessageModel;
    assistantMessage: ChatMessageModel;
    messageId?: string;
    aiResponse?: string;
  }> {
    logger.info(
      `Processing message from consumer for user ${userId}, session ID: ${sessionId}`
    );

    // 1. Ensure Session Exists
    const { persistentSession, finalSessionId, chatSession } =
      await this._ensureSession(userId, sessionId);

    if (!persistentSession || !chatSession) {
      throw new Error(
        `Failed to establish session ${finalSessionId || sessionId || "global"} for user ${userId}.`
      );
    }

    // 2. Check for and potentially handle Activity Command
    const commandResult = await this._handleActivityCommand(
      userId,
      finalSessionId,
      messageText,
      clientMessageId
    );

    if (commandResult.handled) {
      return {
        userMessage: commandResult.userMessage!,
        assistantMessage: commandResult.responseMessage!,
        messageId: commandResult.responseMessage!.id,
        aiResponse: commandResult.responseMessage!.content,
      };
    }

    // Update activeActivity based on command result
    let activeActivity = commandResult.currentActivity;

    // 3. Process Non-Command Message
    const { userMessage, assistantMessage } =
      await this._processNonCommandMessage(
        userId,
        finalSessionId,
        messageText,
        clientMessageId,
        activeActivity,
        persistentSession,
        chatSession
      );

    // Post-processing
    await this._updateCompanionState(assistantMessage, userId);

    // Generate title if needed
    if (
      !persistentSession.metadata?.title &&
      chatSession.chatHistory.length >= 2
    ) {
      const messagesContent = chatSession.chatHistory
        .filter(
          (msg) =>
            msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT
        )
        .map((msg) => msg.content);

      this._generateSessionTitleIfRequired(
        messagesContent,
        finalSessionId,
        userId
      );
    }

    return {
      userMessage,
      assistantMessage,
      messageId: assistantMessage.id,
      aiResponse: assistantMessage.content,
    };
  }

  /**
   * Process a message synchronously (used as fallback when Kafka is unavailable)
   * Contains the original handleMessage logic
   */
  private async _processSynchronously(
    userId: string,
    messageText: string,
    sessionId: string,
    clientMessageId?: string,
    config?: ChatConfig,
    persistentSession?: ISession | null,
    chatSession?: ChatSession | null
  ): Promise<ChatMessage> {
    logger.info(
      `Processing message synchronously for user ${userId}, session ID: ${sessionId}`
    );

    // If session info wasn't provided, ensure it exists
    if (!persistentSession || !chatSession) {
      const sessionResult = await this._ensureSession(userId, sessionId);
      persistentSession = sessionResult.persistentSession;
      sessionId = sessionResult.finalSessionId;
      chatSession = sessionResult.chatSession;

      if (!persistentSession || !chatSession) {
        throw new Error(
          `Failed to establish session ${sessionId} for user ${userId}.`
        );
      }
    }

    // 2. Check for and potentially handle Activity Command
    const commandResult = await this._handleActivityCommand(
      userId,
      sessionId,
      messageText,
      clientMessageId
    );
    if (commandResult.handled) {
      return commandResult.responseMessage!; // Return the command response
    }
    // Update activeActivity based on command result (e.g., if /end was used)
    let activeActivity = commandResult.currentActivity;

    // 3. Process Non-Command Message (including potential activity message)
    const { userMessage, assistantMessage } =
      await this._processNonCommandMessage(
        userId,
        sessionId,
        messageText,
        clientMessageId,
        activeActivity, // Pass potentially updated activity
        persistentSession,
        chatSession
      );

    // --- Post-processing ---
    // Update companion state based on the final assistant message
    await this._updateCompanionState(assistantMessage, userId);

    // Generate title if needed
    if (
      !persistentSession.metadata?.title &&
      chatSession.chatHistory.length >= 2 // Ensure history is populated
    ) {
      const messagesContent = chatSession.chatHistory
        .filter(
          (msg) =>
            msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT
        )
        .map((msg) => msg.content);

      this._generateSessionTitleIfRequired(messagesContent, sessionId, userId);
    }

    return assistantMessage;
  }

  // --- Private Helper Methods ---

  /**
   * Ensures a persistent session exists (DB) and loads/initializes
   * the corresponding session in the ChatSessionManager (Memory).
   * Also checks for active activity on load.
   */
  private async _ensureSession(
    userId: string,
    sessionId?: string
  ): Promise<{
    persistentSession: ISession | null;
    finalSessionId: string;
    chatSession: ChatSession | null;
    initialActivity: IActivity | null;
  }> {
    let persistentSession: ISession | null = null;
    let finalSessionId = sessionId;
    let initialActivity: IActivity | null = null;

    // 1. Resolve Persistent Session (DB)
    if (finalSessionId) {
      persistentSession = await sessionService.getSession(finalSessionId);
      if (persistentSession && persistentSession.userId !== userId) {
        logger.warn(
          `Session ${finalSessionId} requested by user ${userId}, but belongs to user ${persistentSession.userId}. Falling back to global.`
        );
        persistentSession = null;
        finalSessionId = undefined; // Force fallback to global
      } else if (persistentSession) {
        logger.debug(`Found existing persistent session ${finalSessionId}`);
        await sessionService.updateSessionActivity(finalSessionId);
      } else {
        logger.warn(
          `Session ${finalSessionId} provided but not found. Falling back to global.`
        );
        finalSessionId = undefined; // Force fallback to global
      }
    }

    // 2. Fallback to Global Session if needed
    if (!persistentSession) {
      const globalSessionId = sessionService.getGlobalSessionId(userId);
      logger.debug(
        `Using global session ${globalSessionId} for user ${userId}`
      );
      persistentSession = await sessionService.ensureGlobalSession(userId);
      finalSessionId = persistentSession._id;
    }

    if (!persistentSession || !finalSessionId) {
      logger.error(`Failed to get or create a session for user ${userId}.`);
      // Consider throwing an error here or returning nulls carefully
      return {
        persistentSession: null,
        finalSessionId: "",
        chatSession: null,
        initialActivity: null,
      };
    }

    // 3. Initialize/Load In-Memory Session (ChatSessionManager)
    let chatSession = chatSessionManager.getSession(finalSessionId);
    if (!chatSession) {
      logger.warn(
        `Session ${finalSessionId} not found in ChatSessionManager, initializing.`
      );
      chatSessionManager.initializeSession(finalSessionId, userId, {
        title: persistentSession.metadata?.title,
      });
      await this._loadHistoryFromDB(finalSessionId, userId, false); // Load history AFTER initializing, exclude deleted messages
      chatSession = chatSessionManager.getSession(finalSessionId);

      if (!chatSession) {
        logger.error(
          `FATAL: Failed to initialize session ${finalSessionId} in ChatSessionManager even after attempt.`
        );
        // This indicates a deeper issue
        return {
          persistentSession,
          finalSessionId,
          chatSession: null,
          initialActivity: null,
        };
      }

      // Update title if missing in memory but present in DB
      if (persistentSession.metadata?.title && !chatSession.title) {
        chatSessionManager.updateSessionTitle(
          finalSessionId,
          persistentSession.metadata.title
        );
      }

      // Check for active activity in DB on initial load ONLY
      initialActivity = await activityService.getActiveActivity(
        userId,
        finalSessionId
      );
      if (initialActivity) {
        logger.info(
          `[Activity Resumed] Found active activity ${initialActivity._id} (${initialActivity.type}) for session ${finalSessionId} on initial load.`
        );
      }
    } else {
      logger.debug(
        `Found existing session ${finalSessionId} in ChatSessionManager.`
      );
      // If session already existed in manager, check activity state again
      // (Handles cases where server restarted but session was kept in memory somehow, or ensures consistency)
      initialActivity = await activityService.getActiveActivity(
        userId,
        finalSessionId
      );
      if (initialActivity) {
        logger.info(
          `[Activity Check] Confirmed active activity ${initialActivity._id} (${initialActivity.type}) for existing session ${finalSessionId}.`
        );
      } else {
        logger.info(
          `[Activity Check] No active activity found for existing session ${finalSessionId}.`
        );
      }
    }

    return { persistentSession, finalSessionId, chatSession, initialActivity };
  }

  /**
   * Processes the message as an activity command.
   * Returns { handled: true, responseMessage, currentActivity } if it was a command,
   * otherwise { handled: false, currentActivity }.
   */
  private async _handleActivityCommand(
    userId: string,
    sessionId: string,
    messageText: string,
    clientMessageId?: string
  ): Promise<{
    handled: boolean;
    responseMessage?: ChatMessageModel;
    currentActivity: IActivity | null;
    userMessage: ChatMessageModel | null;
  }> {
    const activityCommandResult = await activityService.processActivityCommand(
      userId,
      sessionId,
      messageText,
      clientMessageId
    );

    let currentActivity: IActivity | null = null;
    let userMessage: ChatMessageModel | null = null;

    if (activityCommandResult.handled) {
      logger.info(`Message identified as activity command: ${messageText}`);

      // Add user command message to history
      userMessage = new ChatMessageModel({
        id: clientMessageId || uuidv4(),
        sessionId: sessionId,
        role: MessageRole.USER,
        content: messageText,
        status: MessageStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        metadata: {
          activityId: activityCommandResult.activityId,
          isActivityCommand: true,
        },
      });
      chatSessionManager.addMessage(sessionId, userMessage);
      this._saveMessageToDB(userMessage, userId); // Save async

      // Create and add assistant response message
      const assistantMessage = new ChatMessageModel({
        id: uuidv4(),
        sessionId: sessionId,
        role: MessageRole.ASSISTANT,
        content:
          activityCommandResult.response || "Activity command processed.",
        status: MessageStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        metadata: {
          activityId: activityCommandResult.activityId,
          isActivityResponse: true,
          systemGenerated: true, // Indicates it's not from the main AI
        },
      });
      chatSessionManager.addMessage(sessionId, assistantMessage);
      this._saveMessageToDB(assistantMessage, userId); // Save async

      // Update currentActivity based on the command's effect
      if (activityCommandResult.activity?.isActive) {
        currentActivity = activityCommandResult.activity;
        logger.debug(`Activity ${currentActivity._id} is now active.`);
      } else if (activityCommandResult.activityId) {
        // If an activity ended, ensure currentActivity is null
        const endedActivity = await Activity.findById(
          activityCommandResult.activityId
        );
        if (endedActivity && !endedActivity.isActive) {
          logger.debug(`Activity ${endedActivity._id} was ended by command.`);
          currentActivity = null;

          // Activity has ended - reload session history to show only non-activity messages
          logger.debug(
            `Reloading session history after activity end to filter out activity messages`
          );

          // First clear the existing messages from the chat manager
          chatSessionManager.clearSessionHistory(sessionId);

          // Reload history with only non-activity messages
          await this._loadHistoryFromDB(sessionId, userId, false);

          // We've already added the command messages above, so they're still in the history
        } else {
          // Should not happen if command result is correct, but handle defensively
          currentActivity = await activityService.getActiveActivity(
            userId,
            sessionId
          );
        }
      }

      return {
        handled: true,
        responseMessage: assistantMessage,
        currentActivity,
        userMessage,
      };
    } else {
      // If not handled as a command, get the currently active activity
      currentActivity = await activityService.getActiveActivity(
        userId,
        sessionId
      );
      return {
        handled: false,
        responseMessage: undefined,
        currentActivity,
        userMessage: null,
      };
    }
  }

  /**
   * Checks if an activity continuation prompt is needed and sends it.
   * Returns the prompt message if sent, otherwise null.
   */
  private async _handleActivityContinuation(
    userId: string,
    sessionId: string,
    activeActivity: IActivity,
    activityProcessResult: { shouldPromptContinuation: boolean }
  ): Promise<ChatMessage | null> {
    if (activityProcessResult?.shouldPromptContinuation) {
      const continuationPrompt =
        activityService.getContinuationPrompt(activeActivity);

      // Update the last prompt time in the DB *before* sending the message
      if (activeActivity.engagement) {
        activeActivity.engagement.lastPromptTime = new Date();
        try {
          await activeActivity.save(); // Use await here
        } catch (saveError) {
          logger.error(
            `Failed to save activity ${activeActivity._id} after updating prompt time:`,
            saveError instanceof Error ? saveError : String(saveError)
          );
          // Decide how to handle this - potentially proceed without saving?
        }
      }

      const continuationMessage = new ChatMessageModel({
        id: uuidv4(),
        sessionId: sessionId,
        role: MessageRole.ASSISTANT,
        content: continuationPrompt,
        status: MessageStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        metadata: {
          activityId: activeActivity._id,
          isActivityContinuationPrompt: true,
          activityType: activeActivity.type,
          activityName: activeActivity.name,
        },
      });

      chatSessionManager.addMessage(sessionId, continuationMessage);
      this._saveMessageToDB(continuationMessage, userId); // Save async
      // We might want to update companion state here too?
      // await this._updateCompanionState(continuationMessage, userId);
      return continuationMessage;
    }
    return null; // No continuation prompt sent
  }

  /**
   * Handles processing a message that is NOT an activity command.
   * This includes adding the user message, potentially processing it within an activity,
   * checking for continuation prompts, and generating the AI response.
   */
  private async _processNonCommandMessage(
    userId: string,
    sessionId: string,
    messageText: string,
    clientMessageId: string | undefined,
    initialActivity: IActivity | null, // Activity state *before* processing this message
    persistentSession: ISession, // Pass persistent session for title check
    chatSession: ChatSession // Pass chat session for title check
  ): Promise<{
    userMessage: ChatMessageModel;
    assistantMessage: ChatMessageModel;
  }> {
    // Check if this message ID already exists in the session to prevent duplicate processing
    if (
      clientMessageId &&
      chatSession.chatHistory.some((msg) => msg.id === clientMessageId)
    ) {
      logger.warn(
        `Message with ID ${clientMessageId} already exists in session ${sessionId}. Preventing duplicate processing.`
      );

      // Find the existing message and its response
      const existingUserMsg = chatSession.chatHistory.find(
        (msg) => msg.id === clientMessageId
      );

      // Look for an assistant message that has this message ID in its metadata.userMessageId
      const existingAssistantMsg = chatSession.chatHistory.find(
        (msg) =>
          msg.role === MessageRole.ASSISTANT &&
          msg.metadata?.userMessageId === clientMessageId
      );

      if (existingUserMsg && existingAssistantMsg) {
        logger.info(`Returning existing message pair instead of reprocessing.`);
        return {
          userMessage: existingUserMsg as ChatMessageModel,
          assistantMessage: existingAssistantMsg as ChatMessageModel,
        };
      }
    }

    // 1. Create and Store User Message
    const userMessage = new ChatMessageModel({
      id: clientMessageId || uuidv4(),
      sessionId: sessionId,
      role: MessageRole.USER,
      content: messageText,
      status: MessageStatus.COMPLETED, // Assume user message is always complete
      timestamp: new Date().toISOString(),
      metadata: {}, // Initialize metadata
    });

    let activityProcessResult: {
      isRelevant: boolean;
      shouldPromptContinuation: boolean;
      activity: IActivity | null; // Activity state *after* processing this message
    } | null = null;
    let currentActivity = initialActivity; // Start with the activity state passed in

    // 2. Process within Activity Context (if active)
    if (currentActivity) {
      logger.debug(
        `Processing message within active activity ${currentActivity._id}`
      );
      userMessage.metadata = {
        ...userMessage.metadata,
        activityId: currentActivity._id,
        activityType: currentActivity.type,
        activityName: currentActivity.name,
      };

      activityProcessResult = await activityService.processActivityMessage(
        currentActivity._id,
        userMessage.id, // Pass user message ID
        messageText // Pass message content
      );
      // Update currentActivity with the result from processing the message
      currentActivity = activityProcessResult.activity;

      // If processing failed (activity became inactive/deleted), log it
      if (!currentActivity) {
        logger.warn(
          `Active activity ${userMessage.metadata.activityId} became inactive or was deleted during message processing.`
        );
      } else {
        logger.debug(
          `Activity ${currentActivity._id} state potentially updated after message processing.`
        );
      }
    }

    // Log the message ID so it can be tracked through the system
    logger.info(
      `Created user message with ID ${userMessage.id} in session ${sessionId}`
    );

    // Add the message to the session
    chatSessionManager.addMessage(sessionId, userMessage);
    logger.debug(
      `Added user message to session manager, current history length: ${chatSessionManager.getSession(sessionId)?.chatHistory.length}`
    );
    this._saveMessageToDB(userMessage, userId); // Save async

    // 3. Check for Activity Continuation Prompt
    if (currentActivity && activityProcessResult) {
      const continuationMessage = await this._handleActivityContinuation(
        userId,
        sessionId,
        currentActivity,
        activityProcessResult
      );
      if (continuationMessage) {
        // If continuation prompt was sent, it becomes the assistant's response for this turn
        return { userMessage, assistantMessage: continuationMessage };
      }
    }

    // 4. Generate AI Response (if no continuation prompt was sent)
    const assistantMessagePlaceholder = new ChatMessageModel({
      id: uuidv4(),
      sessionId: sessionId,
      role: MessageRole.ASSISTANT,
      content: "",
      status: MessageStatus.PROCESSING,
      timestamp: new Date().toISOString(),
    });
    logger.debug(
      `Created assistant placeholder ${assistantMessagePlaceholder.id} for session ${sessionId}`
    );

    try {
      const aiResult = await aiService.processUserMessage(
        userId,
        sessionId,
        messageText,
        userMessage.id,
        currentActivity // Pass the potentially updated activity state
      );

      logger.info(
        `AI processing complete for session ${sessionId}. Returning assistant message ${aiResult.assistantMessage.id}`
      );
      const finalAssistantMessage = aiResult.assistantMessage;

      // Add activity metadata to assistant message if applicable AND activity is still active
      if (currentActivity) {
        finalAssistantMessage.metadata = {
          ...finalAssistantMessage.metadata,
          activityId: currentActivity._id,
          activityType: currentActivity.type,
          activityName: currentActivity.name,
        };

        // Associate assistant message with activity (without reprocessing engagement)
        await activityService.addMessageToActivity(
          currentActivity._id,
          finalAssistantMessage.id
        );

        // Update activity state based on conversation (potentially with AI help)
        // Pass both user and assistant messages for context
        await activityService.updateActivityState(
          currentActivity._id,
          undefined, // No explicit state data here
          undefined, // No explicit metadata update here
          userMessage.content,
          finalAssistantMessage.content
        );
        logger.debug(
          `Updated activity ${currentActivity._id} state after AI response.`
        );
      }

      // 5. Check for action triggers in AI response
      const actionResult =
        await actionManager.checkAndExecuteActionsFromMessage(
          userId,
          sessionId,
          finalAssistantMessage.id,
          finalAssistantMessage.content,
          ACTION_CONFIDENCE_THRESHOLD
        );

      // If action was executed, include result in message metadata
      if (actionResult.executed) {
        finalAssistantMessage.metadata = {
          ...finalAssistantMessage.metadata,
          actionExecuted: true,
          actionId: actionResult.actionId,
          actionName: actionResult.actionName,
          actionSuccess: !actionResult.error,
          actionMessage: actionResult.error || actionResult.result?.message,
        };

        logger.info(
          `Action ${actionResult.actionName} was executed and added to message metadata`
        );
      }

      // --- Add to manager and save AFTER potential metadata updates ---
      chatSessionManager.addMessage(sessionId, finalAssistantMessage);
      logger.debug(
        `Added assistant message ${finalAssistantMessage.id} to manager.`
      );
      this._saveMessageToDB(finalAssistantMessage, userId); // Save async

      return { userMessage, assistantMessage: finalAssistantMessage };
    } catch (error) {
      logger.error(
        `Error during AI processing pipeline for session ${sessionId}:`,
        error instanceof Error ? error : String(error)
      );
      // Update placeholder with error info
      assistantMessagePlaceholder.status = MessageStatus.ERROR;
      assistantMessagePlaceholder.content = `Sorry, I encountered an error: ${(error as Error).message}`;
      assistantMessagePlaceholder.metadata = {
        ...assistantMessagePlaceholder.metadata,
        error: true,
        errorMessage: (error as Error).message,
      };
      assistantMessagePlaceholder.timestamp = new Date().toISOString(); // Update timestamp

      // --- Add error message to manager and save ---
      chatSessionManager.addMessage(sessionId, assistantMessagePlaceholder); // Add the error placeholder
      logger.debug(
        `Added assistant error placeholder ${assistantMessagePlaceholder.id} to manager.`
      );
      this._saveMessageToDB(assistantMessagePlaceholder, userId); // Save the error placeholder

      // Return the error message as the assistant response
      return { userMessage, assistantMessage: assistantMessagePlaceholder };
    }
  }

  /**
   * Handle updating game state based on messages - COULD BE MOVED TO ActivityService
   */
  private async _handleGameStateUpdate(
    userId: string,
    sessionId: string,
    activityId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      // Get the current activity
      const activity = await activityService.getActiveActivity(
        userId,
        sessionId
      );
      if (!activity || activity._id !== activityId) {
        return;
      }

      // For tic-tac-toe, look for moves in the messages
      if (activity.metadata?.gameType === "tictactoe") {
        const board = activity.state.data.board;
        const currentPlayer = activity.state.data.currentPlayer;
        const moves = activity.state.data.moves;
        let winner = activity.state.data.winner;

        // Check if the AI response indicates a move (e.g., "I place an O in the top right corner")
        const aiMoveMatch = assistantMessage.match(
          /(?:I(?:'ll)?\s+(?:place|put|mark|choose))\s+(?:an?\s+)?O\s+(?:in|at)\s+(?:the\s+)?(top|middle|bottom)(?:\s+)(left|middle|right)/i
        );

        if (aiMoveMatch && currentPlayer === "O" && !winner) {
          const row = aiMoveMatch[1].toLowerCase();
          const col = aiMoveMatch[2].toLowerCase();

          let rowIndex = row === "top" ? 0 : row === "middle" ? 1 : 2;
          let colIndex = col === "left" ? 0 : col === "middle" ? 1 : 2;

          // Update the board if the cell is empty
          if (board[rowIndex][colIndex] === null) {
            board[rowIndex][colIndex] = "O";

            // Check for winner or draw
            winner = this._checkTicTacToeWinner(board);

            // Update activity state
            await activityService.updateActivityState(activityId, {
              board,
              currentPlayer: "X", // Switch to user
              moves: moves + 1,
              winner,
            });
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Error updating game state for activity ${activityId}:`,
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Check if there's a winner in tic-tac-toe - COULD BE MOVED TO ActivityService
   */
  private _checkTicTacToeWinner(board: (string | null)[][]): string | null {
    // Check rows
    for (let i = 0; i < 3; i++) {
      if (
        board[i][0] &&
        board[i][0] === board[i][1] &&
        board[i][0] === board[i][2]
      ) {
        return board[i][0];
      }
    }

    // Check columns
    for (let i = 0; i < 3; i++) {
      if (
        board[0][i] &&
        board[0][i] === board[1][i] &&
        board[0][i] === board[2][i]
      ) {
        return board[0][i];
      }
    }

    // Check diagonals
    if (
      board[0][0] &&
      board[0][0] === board[1][1] &&
      board[0][0] === board[2][2]
    ) {
      return board[0][0];
    }

    if (
      board[0][2] &&
      board[0][2] === board[1][1] &&
      board[0][2] === board[2][0]
    ) {
      return board[0][2];
    }

    // Check for draw
    let isDraw = true;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[i][j] === null) {
          isDraw = false;
          break;
        }
      }
      if (!isDraw) break;
    }

    return isDraw ? "draw" : null;
  }

  /**
   * Updates companion state based on the assistant's message.
   */
  private async _updateCompanionState(
    finalAssistantMessage: ChatMessageModel,
    userId: string
  ) {
    // --- Lightweight Companion State Update ---
    try {
      const aiResponseContent = String(finalAssistantMessage).toLowerCase();
      let inferredEmotion = CompanionEmotion.THOUGHTFUL; // Default

      if (
        aiResponseContent.includes("sorry") ||
        aiResponseContent.includes("unable to") ||
        aiResponseContent.includes("i can't")
      ) {
        inferredEmotion = CompanionEmotion.CONCERNED;
      } else if (
        aiResponseContent.includes("i understand") ||
        aiResponseContent.includes("that makes sense")
      ) {
        inferredEmotion = CompanionEmotion.EMPATHETIC;
      } else if (
        aiResponseContent.includes("great") ||
        aiResponseContent.includes("excellent") ||
        aiResponseContent.includes("wonderful")
      ) {
        inferredEmotion = CompanionEmotion.HAPPY;
      } else if (
        aiResponseContent.includes("interesting") ||
        aiResponseContent.includes("let me think") ||
        aiResponseContent.includes("curious")
      ) {
        inferredEmotion = CompanionEmotion.CURIOUS;
      } else if (
        aiResponseContent.includes("sure") ||
        aiResponseContent.includes("certainly") ||
        aiResponseContent.includes("i can help")
      ) {
        inferredEmotion = CompanionEmotion.DETERMINED;
      }

      // Update emotion and add a thought (don't necessarily need to await if we don't need the result immediately)
      // Using await for now for simplicity in sequential execution and error catching
      await companionStateService.updateEmotion(userId, inferredEmotion);
      await companionStateService.addThought(
        userId,
        "just talked to user",
        "reflection", // category
        2 // priority
      );
      logger.debug(
        `Updated companion state for user ${userId} after AI response.`
      );
    } catch (stateUpdateError) {
      logger.warn(
        `[EnhancedChatService] Failed to update companion state for user ${userId} after AI response: ${stateUpdateError}`
      );
      // Do not re-throw, just log the warning.
    }
    // --- End Companion State Update ---
  }

  /**
   * Loads message history from the database into the ChatSessionManager.
   * @param includeDeleted Whether to include messages marked as deleted (defaults to false)
   */
  private async _loadHistoryFromDB(
    sessionId: string,
    userId: string,
    includeDeleted: boolean = false
  ): Promise<void> {
    try {
      // Clear any existing in-memory history first to avoid duplicates
      const cleared = chatSessionManager.clearSessionHistory(sessionId);
      if (cleared) {
        logger.debug(
          `Cleared existing in-memory history for session ${sessionId} before loading from DB.`
        );
      } else {
        // This might happen if the session was somehow removed between initializeSession and here, log a warning.
        logger.warn(
          `Session ${sessionId} not found in manager when trying to clear history before DB load.`
        );
        // We can still proceed to load into a potentially new session object if initializeSession created it.
      }

      // Check if there's an active activity for this session
      const activeActivity = await activityService.getActiveActivity(
        userId,
        sessionId
      );

      logger.debug(
        `Loading history from DB for session ${sessionId} for user ${userId}${
          activeActivity ? ` with active activity ${activeActivity._id}` : ""
        }${includeDeleted ? " (including deleted messages)" : ""}`
      );

      // Build query based on activity context
      let queryConditions: any = { sessionId };

      if (activeActivity) {
        // If in an activity session, show only messages related to that activity
        logger.debug(`Filtering messages for activity ${activeActivity._id}`);
        queryConditions["metadata.activityId"] = activeActivity._id;
      } else {
        // If in a normal session, exclude ALL activity-related messages
        logger.debug(
          `Excluding ALL activity-related messages from normal session`
        );
        queryConditions["metadata.activityId"] = { $exists: false };
      }

      // Only filter out deleted messages if includeDeleted is false
      if (!includeDeleted) {
        queryConditions.isDeleted = { $ne: true };
      }

      // Query for the last 20 messages for this session, with activity filtering
      const messagesFromDB = await MessageModel.find(queryConditions)
        .sort({ timestamp: -1 }) // Sort DESCENDING to get newest first
        .limit(20) // Limit to the last 20 messages
        .lean() // Use lean for performance
        .exec();

      // Add logging to verify fetched messages
      if (messagesFromDB && messagesFromDB.length > 0) {
        const fetchedTimestamps = messagesFromDB
          .map((m) => new Date(m.timestamp).toISOString())
          .join(", ");
        logger.debug(
          `[_loadHistoryFromDB] Fetched ${messagesFromDB.length} messages (newest first initially): Timestamps [${fetchedTimestamps}]`
        );
      } else {
        logger.debug(
          `[_loadHistoryFromDB] No messages found in DB for session ${sessionId}${
            activeActivity
              ? ` and activity ${activeActivity._id}`
              : " (normal session)"
          }.`
        );
      }

      if (messagesFromDB && messagesFromDB.length > 0) {
        logger.info(
          `Found ${messagesFromDB.length} messages in DB for session ${sessionId}${
            activeActivity
              ? ` and activity ${activeActivity._id}`
              : " (normal session)"
          }. Adding to manager.`
        );
        // *** FIX: Reverse the array so oldest messages in the batch are added first ***
        const messagesInChronologicalOrder = messagesFromDB.reverse();

        // Add messages to the session manager in the correct chronological order
        for (const msgData of messagesInChronologicalOrder) {
          // Reconstruct the ChatMessageModel from the lean object if necessary
          // Assuming the structure is compatible or can be mapped
          const chatMessage = new ChatMessageModel({
            ...msgData,
            id: msgData._id?.toString() || uuidv4(), // Ensure id is a string
            // Explicitly cast the role from DB string to MessageRole enum
            role: msgData.role as MessageRole,
            timestamp:
              msgData.timestamp?.toISOString() || new Date().toISOString(), // Ensure timestamp is string
            // Map other fields if necessary, ensure role, content, status exist
          });
          chatSessionManager.addMessage(sessionId, chatMessage);
        }
        logger.debug(
          `Finished loading ${messagesFromDB.length} messages into session ${sessionId}`
        );
      } else {
        logger.debug(`No history found in DB for session ${sessionId}.`);
      }
    } catch (error) {
      logger.error(
        `[EnhancedChatService] Error loading history from DB for session ${sessionId}:`,
        error instanceof Error ? error : String(error)
      );
      // Decide if you want to throw or just log
    }
  }

  /**
   * Saves a message to the database asynchronously and creates a memory entry for user messages.
   */
  private async _saveMessageToDB(message: ChatMessageModel, userId: string) {
    try {
      logger.debug(`Saving message ${message.id} to DB`);

      // Create executedActions array if actions were found in metadata
      const executedActions = message.metadata?.actionExecuted
        ? [
            {
              actionId: message.metadata.actionId,
              success: message.metadata.actionSuccess,
              result: message.metadata.actionMessage,
              error: message.metadata.actionSuccess
                ? undefined
                : message.metadata.actionMessage,
            },
          ]
        : undefined;

      // Create the message document
      await MessageModel.create({
        _id: message.id,
        userId,
        sessionId: message.sessionId,
        role: message.role,
        content: message.content,
        status: message.status,
        timestamp: new Date(message.timestamp),
        metadata: message.metadata ? { ...message.metadata } : undefined,
        executedActions,
      });

      // For user messages, also create a memory entry
      if (
        message.role === MessageRole.USER &&
        message.status === MessageStatus.COMPLETED
      ) {
        try {
          logger.debug(`Creating memory entry for user message ${message.id}`);

          // Store the actual message content in memory
          const memoryImportance = message.content.includes("?") ? 4 : 3; // Higher importance for questions

          await memoryService.addMemory(
            userId,
            message.content,
            MemoryType.MEDIUM_TERM, // Store user messages for medium-term reference
            "user-message", // Source
            {
              messageId: message.id,
              sessionId: message.sessionId,
              timestamp: message.timestamp,
              isUserMessage: true,
            },
            memoryImportance, // Medium importance
            MemoryCategory.CONVERSATION as MemoryCategory // Conversation category
          );
          logger.debug(`Created memory entry for message ${message.id}`);
        } catch (memoryError) {
          logger.error(
            `Error creating memory for message ${message.id}:`,
            memoryError instanceof Error ? memoryError : String(memoryError)
          );
        }
      }
    } catch (err) {
      logger.error(
        `Error creating message document for ${message.id}:`,
        err instanceof Error ? err : String(err)
      );
    }
  }

  /**
   * Generates a suggested interaction prompt.
   */
  async generateSuggestion(userId: string): Promise<string> {
    logger.debug(`Generating suggestion for user ${userId}`);
    const memories = await memoryService.getUserMemories(userId);
    if (memories.length === 0) {
      logger.debug(
        `No memories found for user ${userId}, cannot generate suggestion.`
      );
      return "";
    }

    const context = await contextService.generateContext(true, true);

    const relevantMemories = await memoryService.getRelevantMemories(
      userId,
      context,
      5
    );
    if (relevantMemories.length === 0) {
      logger.debug(
        `No relevant memories found for current context, cannot generate suggestion for user ${userId}.`
      );
      return "";
    }

    const memoryContext = relevantMemories.map((m) => m.memory.text).join("\n");

    const prompt = `
      Based on the current context and what you know about the user, generate a helpful,
      non-intrusive suggestion they might appreciate. This could be a productivity tip,
      activity suggestion, or something relevant to their interests.
      Keep it brief (1-2 sentences) and conversational. Avoid generic suggestions.
      
      Current context:
      ${context}
      
      User information:
      ${memoryContext}
      
      Suggestion:
    `;

    try {
      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 150, temperature: 0.7 },
        "You are an AI assistant providing helpful suggestions.",
        userId
      );
      const suggestion = response.text.trim();
      return suggestion &&
        suggestion !== "[Error generating auxiliary response]"
        ? suggestion
        : "";
    } catch (error) {
      logger.error(
        `Error generating suggestion for user ${userId}:`,
        error instanceof Error ? error : String(error)
      );
      return "";
    }
  }

  /**
   * Analyzes the conversation history of a session.
   */
  async analyzeConversation(sessionId: string): Promise<Record<string, any>> {
    logger.debug(`Analyzing conversation for session ${sessionId}`);
    const session = chatSessionManager.getSession(sessionId);
    if (!session) {
      logger.warn(
        `Cannot analyze conversation: Session ${sessionId} not found in ChatSessionManager.`
      );
      throw new Error(`Chat session ${sessionId} not found for analysis`);
    }

    if (session.chatHistory.length < 3) {
      logger.debug(`Not enough messages in session ${sessionId} to analyze.`);
      return {
        topics: [],
        sentiment: "neutral",
        insights: [],
      };
    }

    const conversationText = session.chatHistory
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n");

    const prompt = `
      Analyze this conversation and extract:
      1. Main topics discussed (up to 3)
      2. Overall sentiment (positive, negative, or neutral)
      3. Key insights or action items (up to 3)
      
      Format the response as JSON with keys "topics", "sentiment", and "insights".
      Example: {"topics": ["topic1", "topic2"], "sentiment": "positive", "insights": ["insight1"]}
      
      Conversation:
      ${conversationText}
    `;

    try {
      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 250, temperature: 0.3 },
        "You are an AI assistant analyzing chat conversations and outputting JSON.",
        session.userId
      );
      const analysisText = response.text.trim();

      if (analysisText === "[Error generating auxiliary response]") {
        throw new Error("AI failed to generate analysis.");
      }

      try {
        const cleanedJson = analysisText.replace(/```json\n?|\n?```/g, "");
        const analysisJson = JSON.parse(cleanedJson);
        if (
          analysisJson &&
          typeof analysisJson === "object" &&
          Array.isArray(analysisJson.topics) &&
          typeof analysisJson.sentiment === "string" &&
          Array.isArray(analysisJson.insights)
        ) {
          return analysisJson;
        } else {
          logger.warn(
            `Generated analysis for session ${sessionId} is not valid JSON or lacks expected keys. Content: ${analysisText}`
          );
          throw new Error("Invalid JSON structure in analysis response.");
        }
      } catch (parseError) {
        logger.error(
          `Error parsing analysis JSON for session ${sessionId}. Raw text: ${analysisText}`,
          parseError instanceof Error ? parseError : String(parseError)
        );
        return {
          topics: ["Conversation Analysis Failed"],
          sentiment: "unknown",
          insights: [analysisText.split("\n")[0]],
        };
      }
    } catch (error) {
      logger.error(
        `Error analyzing conversation for session ${sessionId}:`,
        error instanceof Error ? error : String(error)
      );
      return {
        topics: [],
        sentiment: "unknown",
        insights: [],
      };
    }
  }

  /**
   * Generates a personalized greeting for the user.
   */
  async getPersonalizedGreeting(userId: string): Promise<string> {
    logger.debug(`Generating personalized greeting for user ${userId}`);
    const userSummary = await summaryService.generateUserSummary(
      userId,
      "global",
      false // Use async mode
    );

    const timeData = await contextService.getTimeContext(userId);
    const timeOfDay = timeData.timeOfDay;

    const prompt = `
      Create a personalized greeting for a user. It's currently ${timeOfDay}.
      Make the greeting warm, friendly, and personalized based on what you know about them.
      Keep it brief (1-2 sentences).
      
      What I know about the user:
      ${userSummary || "Nothing specific yet."}
      
      Personalized greeting:
    `;

    try {
      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        { model: modelEnum.gemma3o4b, max_tokens: 100, temperature: 0.8 },
        "You are a friendly assistant creating a personalized greeting.",
        userId
      );
      const greeting = response.text.trim().replace("“", "").replace("”", "");
      return greeting && greeting !== "[Error generating auxiliary response]"
        ? greeting
        : `Good ${timeOfDay}! How can I help you today?`;
    } catch (error) {
      logger.error(
        `Error generating personalized greeting for user ${userId}:`,
        error instanceof Error ? error : String(error)
      );
      return `Good ${timeOfDay}! How can I help you today?`;
    }
  }

  /**
   * Generates and saves a session title if one doesn't exist.
   */
  private async _generateSessionTitleIfRequired(
    messagesContent: string[],
    finalSessionId: string,
    userId: string
  ) {
    try {
      const title = await aiService
        .generateAuxiliaryResponse(
          `Generate a concise (3-5 word) title for the following chat exchange:\n\n${messagesContent.slice(-6).join("\n---\n")}`,
          { model: modelEnum.gemma3o4b, max_tokens: 20 },
          "You are an expert at summarizing conversations into short titles.",
          userId
        )
        .then((res) => res.text.replace(/["']/g, "").trim());

      if (
        title &&
        title !== "[Error generating auxiliary response]" &&
        !title.toLowerCase().includes("no title")
      ) {
        logger.info(`Generated title "${title}" for session ${finalSessionId}`);
        await sessionService.updateSessionMetadata(finalSessionId, {
          title: title,
        });
        chatSessionManager.updateSessionTitle(finalSessionId, title);
      } else {
        logger.warn(
          `Could not generate a valid title for session ${finalSessionId}. Generated: "${title}"`
        );
      }
    } catch (titleError) {
      logger.error(
        `Error generating title for session ${finalSessionId}:`,
        titleError instanceof Error ? titleError : String(titleError)
      );
    }
  }

  /**
   * Public method to reload a session's history with option to include deleted messages
   * Useful for admin interfaces or when a user wants to view deleted messages
   */
  async reloadSessionHistory(
    sessionId: string,
    userId: string,
    includeDeleted: boolean = false
  ): Promise<boolean> {
    try {
      logger.info(
        `Reloading history for session ${sessionId} with includeDeleted=${includeDeleted}`
      );
      await this._loadHistoryFromDB(sessionId, userId, includeDeleted);
      return true;
    } catch (error) {
      logger.error(
        `Error reloading session history for ${sessionId}:`,
        error instanceof Error ? error : String(error)
      );
      return false;
    }
  }
}

export const enhancedChatService = new EnhancedChatService();
