import { memoryService } from "../memory.service";
import { sessionService } from "../session.service";
import { telegramBotService } from "./telegram-bot.service";
import { enhancedChatService } from "../enhanced-chat.service";
import { loggerFactory } from "../../utils/logger.service";
import { serendipityService } from "../serendipity.service";
import { v4 as uuidv4 } from "uuid";
import {
  ChatMessageModel,
  MessageRole,
  MessageStatus,
} from "../../models/chat.model";
import { Session } from "../../models/session.model";

const logger = loggerFactory.getLogger("TelegramSchedulerService");

// Interface for storing last message tracking
interface UserMessageTracking {
  lastMessageTimestamp: Date;
  lastScheduledMessageTimestamp: Date | null;
  telegramUserId: number;
}

class TelegramSchedulerService {
  private userMessagingStatus: Map<string, UserMessageTracking> = new Map();
  private MIN_MESSAGE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours minimum between scheduled messages
  private isRunning = false;
  private scheduledJobInterval: NodeJS.Timeout | null = null;

  /**
   * Start the scheduler service
   */
  public start(): void {
    if (this.isRunning) {
      logger.info("Telegram scheduler is already running");
      return;
    }

    logger.info("Starting Telegram scheduler service");
    this.isRunning = true;

    // Run the scheduled task every 30 minutes
    this.scheduledJobInterval = setInterval(
      () => {
        this.checkAndSendScheduledMessages();
      },
      30 * 60 * 1000
    );

    // Run it once immediately
    this.checkAndSendScheduledMessages();
  }

  /**
   * Stop the scheduler service
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.info("Telegram scheduler is not running");
      return;
    }

    logger.info("Stopping Telegram scheduler service");
    this.isRunning = false;

    if (this.scheduledJobInterval) {
      clearInterval(this.scheduledJobInterval);
      this.scheduledJobInterval = null;
    }
  }

  /**
   * Update user's message tracking
   */
  public trackUserMessage(userId: string, telegramUserId: number): void {
    const userTracking = this.userMessagingStatus.get(userId) || {
      lastMessageTimestamp: new Date(),
      lastScheduledMessageTimestamp: null,
      telegramUserId,
    };

    userTracking.lastMessageTimestamp = new Date();
    this.userMessagingStatus.set(userId, userTracking);
    logger.debug(`Updated message tracking for user ${userId}`);
  }

  /**
   * Check all telegram users and send messages if appropriate
   */
  public async checkAndSendScheduledMessages(): Promise<void> {
    try {
      logger.info("Running scheduled message check for Telegram users");

      // Fetch all sessions with userId starting with telegram_
      const telegramSessions = await this.fetchTelegramSessions();
      logger.info(`Found ${telegramSessions.length} Telegram sessions`);

      for (const session of telegramSessions) {
        await this.processUserForScheduledMessage(session);
      }
    } catch (error) {
      logger.error("Error in scheduled message task:", error);
    }
  }

  /**
   * Check if a specific user should receive a message and send if appropriate
   */
  public async sendScheduledMessageToUser(userId: string): Promise<boolean> {
    try {
      if (!userId.startsWith("telegram_")) {
        logger.warn(
          `User ID ${userId} is not a Telegram user ID. Must start with 'telegram_'`
        );
        return false;
      }

      // Extract the Telegram user ID from the format telegram_123456789
      const telegramUserId = parseInt(userId.substring(9), 10);
      if (isNaN(telegramUserId)) {
        logger.warn(`Invalid Telegram user ID format: ${userId}`);
        return false;
      }

      // Fetch the user's global session
      const globalSessionId = sessionService.getGlobalSessionId(userId);
      const session = await sessionService.getSession(globalSessionId);

      if (!session) {
        logger.warn(`Global session not found for user ${userId}`);
        return false;
      }

      // Process the user for scheduled message
      const result = await this.processUserForScheduledMessage(session, true);
      return result;
    } catch (error) {
      logger.error(`Error sending scheduled message to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Process a single user for scheduled messaging
   */
  private async processUserForScheduledMessage(
    session: Session,
    forceSend: boolean = false
  ): Promise<boolean> {
    const userId = session.userId;
    if (!userId.startsWith("telegram_")) {
      logger.debug(`Skipping non-Telegram user ${userId}`);
      return false;
    }

    // Extract the Telegram user ID from the format telegram_123456789
    const telegramUserId = parseInt(userId.substring(9), 10);
    if (isNaN(telegramUserId)) {
      logger.warn(`Invalid Telegram user ID format: ${userId}`);
      return false;
    }

    // Get or initialize user tracking
    let userTracking = this.userMessagingStatus.get(userId);
    if (!userTracking) {
      userTracking = {
        lastMessageTimestamp: session.lastActivity || new Date(),
        lastScheduledMessageTimestamp: null,
        telegramUserId,
      };
      this.userMessagingStatus.set(userId, userTracking);
    }

    // Update the Telegram user ID in case it wasn't set before
    userTracking.telegramUserId = telegramUserId;

    // Check if enough time has passed since the last message
    const now = new Date();
    const timeSinceLastMessage =
      now.getTime() - userTracking.lastMessageTimestamp.getTime();
    const timeSinceLastScheduledMessage =
      userTracking.lastScheduledMessageTimestamp
        ? now.getTime() - userTracking.lastScheduledMessageTimestamp.getTime()
        : Infinity;

    if (
      !forceSend &&
      (timeSinceLastMessage < this.MIN_MESSAGE_INTERVAL_MS ||
        timeSinceLastScheduledMessage < this.MIN_MESSAGE_INTERVAL_MS)
    ) {
      logger.debug(`Not sending scheduled message to ${userId}: Too soon`);
      return false;
    }

    // Get user memories and context for better personalization
    const memories = await memoryService.getUserMemories(userId, 5);

    // Get serendipity suggestions for potential topics
    const suggestions = await serendipityService.getSuggestions(userId, {
      onlyUnseen: true,
      limit: 3,
    });

    // Generate a message using the AI service
    const sessionId = sessionService.getGlobalSessionId(userId);
    const messageId = uuidv4();

    // Create a system message that explains this is a scheduled message
    const systemPrompt = `
You are about to send a scheduled message to a user who hasn't been active for a while.
This message should be engaging, personalized, and relevant to the user's interests and memories.
It should encourage them to respond and continue the conversation.

Current time: ${now.toLocaleString()}
Time since last user message: ${Math.floor(timeSinceLastMessage / (60 * 60 * 1000))} hours

Here are some of the user's recent memories:
${memories.map((m) => `- ${m.content}`).join("\n")}

Consider these topics that might interest the user:
${suggestions.map((s) => `- ${s.content}`).join("\n")}

Write a brief, friendly message to re-engage the user. Make it feel spontaneous rather than scheduled.
Keep it under 100 words. Be conversational and ask an open-ended question.
`;

    // Create a system message
    const systemMessage = new ChatMessageModel({
      id: uuidv4(),
      sessionId,
      role: MessageRole.SYSTEM,
      content: systemPrompt,
      timestamp: new Date().toISOString(),
      status: MessageStatus.COMPLETED,
    });

    try {
      // Generate the AI response
      const aiResponse = await enhancedChatService.handleMessage(
        userId,
        systemPrompt,
        sessionId,
        messageId,
        { isSystemPrompt: true, isScheduledMessage: true }
      );

      // Send the message to the user via Telegram
      const success = await telegramBotService.sendMessage(
        telegramUserId,
        aiResponse.content
      );

      if (success) {
        // Update tracking
        userTracking.lastScheduledMessageTimestamp = now;
        this.userMessagingStatus.set(userId, userTracking);

        logger.info(
          `Successfully sent scheduled message to Telegram user ${telegramUserId}`
        );
        return true;
      } else {
        logger.warn(
          `Failed to send scheduled message to Telegram user ${telegramUserId}`
        );
        return false;
      }
    } catch (error) {
      logger.error(
        `Error generating or sending scheduled message to ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Fetch all sessions associated with Telegram users
   */
  private async fetchTelegramSessions(): Promise<Session[]> {
    try {
      // Using regex for MongoDB: find all sessions where userId starts with "telegram_"
      const sessions =
        await sessionService.searchSessionsByUserIdPattern("^telegram_");
      return sessions;
    } catch (error) {
      logger.error("Error fetching Telegram sessions:", error);
      return [];
    }
  }
}

// Create singleton instance
export const telegramSchedulerService = new TelegramSchedulerService();
