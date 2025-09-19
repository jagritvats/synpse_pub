import { Bot, Context, session, SessionFlavor } from "grammy";
import { memoryService, MemoryType } from "../memory.service";
import { chatSessionManager } from "../chat-session.service";
import { enhancedChatService } from "../enhanced-chat.service";
import { v4 as uuidv4 } from "uuid";
import { loggerFactory } from "../../utils/logger.service";
import { sessionService } from "../session.service";
import {
  ChatMessageModel,
  MessageRole,
  MessageStatus,
} from "../../models/chat.model";
import { telegramSchedulerService } from "./telegram-scheduler.service";
import { userService } from "../user.service";
import MessageModel from "../../models/message.model";
import { activityService } from "../activity.service";
import {
  messageProducerService,
  MessageSource,
} from "../kafka/message-producer.service";

const logger = loggerFactory.getLogger("TelegramBotService");

/**
 * Interface for session data
 */
interface SessionData {
  userId?: string;
  username?: string;
  activeConversation: boolean;
  lastInteractionTime: number;
  sessionId?: string;
}

/**
 * Extended context with session data
 */
type BotContext = Context & SessionFlavor<SessionData>;

/**
 * Telegram Bot Service using Grammy
 */
class TelegramBotService {
  private bot?: Bot<BotContext>;
  private isRunning: boolean = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.error(
        "TELEGRAM_BOT_TOKEN environment variable is not set. Bot will not initialize."
      );
      return;
    }

    this.bot = new Bot<BotContext>(token);

    // Set up session middleware
    this.bot.use(
      session({
        initial: (): SessionData => ({
          activeConversation: false,
          lastInteractionTime: Date.now(),
        }),
      })
    );

    // Set up command handlers
    this.setupCommandHandlers();

    // Set up message handlers
    this.setupMessageHandlers();
  }

  /**
   * Start the bot
   */
  public start(): void {
    if (this.isRunning) {
      console.log("Telegram bot is already running");
      return;
    }

    if (!this.bot) {
      console.error("Could not start Telegram bot: Bot not initialized");
      return;
    }

    try {
      this.bot.start();
      this.isRunning = true;
      console.log("Telegram bot started successfully");
    } catch (error) {
      console.error("Error starting Telegram bot:", error);
    }
  }

  /**
   * Stop the bot
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.info("Telegram bot is not running");
      return;
    }
    // Add check for bot initialization
    if (!this.bot) {
      logger.error("Cannot stop bot: Bot is not initialized.");
      return;
    }

    try {
      this.bot.stop();
      this.isRunning = false;
      logger.info("Telegram bot stopped successfully");
    } catch (error) {
      logger.error("Error stopping Telegram bot:", error);
    }
  }

  /**
   * Set up command handlers
   */
  private setupCommandHandlers(): void {
    if (!this.bot) return;
    // Start command - begins a conversation
    this.bot.command("start", async (ctx) => {
      try {
        const username =
          ctx.from?.username?.toLowerCase() || `telegram_${ctx.from?.id}`;
        const telegramUserId = ctx.from?.id?.toString();
        const displayName =
          ctx.from?.first_name || ctx.from?.username || "User";

        if (!telegramUserId) {
          await ctx.reply("Unable to identify user.");
          return;
        }

        const userId = ctx.session.userId || `telegram_${telegramUserId}`;
        if (!ctx.session.userId) ctx.session.userId = userId;

        // --- User registration logic ---
        let user = await userService.findUserByUsername(username);
        let generatedPassword = undefined;
        if (!user) {
          generatedPassword = uuidv4();
          user = await userService.createUser({
            username,
            email: `telegram_${telegramUserId}@telegram.local`,
            password: generatedPassword,
            name: displayName,
          });
        }

        // Get the global session ID - this is where the conversation starts
        const globalSessionId = sessionService.getGlobalSessionId(userId);
        // Ensure the persistent session exists
        await sessionService.ensureGlobalSession(userId);
        // Ensure the session is initialized in the memory manager
        if (!chatSessionManager.getSession(globalSessionId)) {
          chatSessionManager.initializeSession(globalSessionId, userId);
        }

        ctx.session = {
          userId,
          username,
          activeConversation: true,
          lastInteractionTime: Date.now(),
          sessionId: globalSessionId, // Explicitly set to global session ID
        };
        logger.info(
          `User ${userId} (${username}) started conversation, using global session ${globalSessionId}.`
        );

        // Get personalized greeting
        const greetingText =
          await enhancedChatService.getPersonalizedGreeting(userId);

        // Create and add the greeting message to the chat session history
        const greetingMessage = new ChatMessageModel({
          id: uuidv4(),
          sessionId: globalSessionId,
          role: MessageRole.ASSISTANT,
          content: greetingText,
          status: MessageStatus.COMPLETED,
          timestamp: new Date().toISOString(),
        });
        chatSessionManager.addMessage(globalSessionId, greetingMessage);
        // Also save this greeting to DB (similar to how EnhancedChatService saves messages)
        this._saveMessageToDB(greetingMessage, userId);

        // Send greeting to user
        await ctx.reply(greetingText);

        // If user was just created, send credentials
        if (generatedPassword) {
          await ctx.reply(
            this.escapeMarkdownV2(
              `✅ Your Synapse account has been created!\n\nUsername: ${username}\nPassword: ${generatedPassword}\n\nPlease save these credentials. You can use them to log in on the web app.`
            ),
            { parse_mode: "MarkdownV2" }
          );
        }
      } catch (error) {
        logger.error("Error handling /start command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your command."
        );
      }
    });

    // Help command - shows available commands
    this.bot.command("help", async (ctx) => {
      try {
        const helpMessage = `
Available commands:
/start - Start a conversation with me
/help - Show this help message
/clear - (Deprecated: Use /newsession) Clear conversation history
/remember - Store the last message as a memory
/memories - Show your recent memories
/newsession - Start a new conversation session
        `;

        await ctx.reply(helpMessage);
      } catch (error) {
        logger.error("Error handling /help command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your command."
        );
      }
    });

    // Clear command - Deprecated, suggest /newsession
    this.bot.command("clear", async (ctx) => {
      await ctx.reply(
        "The /clear command is deprecated. Please use /newsession to start fresh.\nNote: Your previous chat history is still saved."
      );
      // We don't clear history here anymore, as it's managed elsewhere.
      // We could potentially end the current session in sessionService if needed.
      logger.info(`User ${ctx.session.userId} used deprecated /clear command.`);
    });

    // New session command - Clears the specific sessionId in the bot context
    this.bot.command("newsession", async (ctx) => {
      try {
        const userId = ctx.session.userId;
        if (!userId) {
          await ctx.reply("Please /start a conversation first.");
          return;
        }
        logger.info(`User ${userId} requested a new session.`);
        // Clear the specific session ID, subsequent messages will use the global session
        ctx.session.sessionId = undefined;
        ctx.session.lastInteractionTime = Date.now();

        await ctx.reply(
          "Okay, any new messages will now be part of your main conversation history (using the global session)."
        );
        // Note: We could also explicitly create a *new* persistent session via sessionService
        // and store its ID in ctx.session.sessionId if we wanted separate, new sessions.
        // For now, this command just resets to using the global session.
      } catch (error) {
        logger.error("Error handling /newsession command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while starting a new session context."
        );
      }
    });

    // Remember command - Needs adjustment to get last message from managed history
    this.bot.command("remember", async (ctx) => {
      if (!this.bot) return;
      try {
        const userId = ctx.session.userId;
        const currentSessionId = ctx.session.sessionId;
        if (!userId) {
          await ctx.reply("Please /start a conversation first.");
          return;
        }

        const globalSessionId = sessionService.getGlobalSessionId(userId);
        const chatSession = chatSessionManager.getSession(globalSessionId);
        const lastUserMessage = chatSession?.chatHistory
          ?.filter((msg) => msg.role === "user" && msg.status === "completed")
          .pop(); // Get the most recent completed user message

        if (!lastUserMessage || !lastUserMessage.content) {
          await ctx.reply(
            "I couldn't find a recent message from you to remember."
          );
          return;
        }

        logger.info(
          `User ${userId} requested to remember: "${lastUserMessage.content.substring(0, 30)}..."`
        );

        // Store the message content as a memory
        await memoryService.addMemory(
          userId,
          lastUserMessage.content,
          MemoryType.MEDIUM_TERM,
          "telegram-remember-command",
          {
            telegramUserId: ctx.from?.id.toString(),
            username: ctx.session.username,
            sourceSessionId: currentSessionId || globalSessionId,
            sourceMessageId: lastUserMessage.id,
          }
        );

        await ctx.reply("Okay, I've saved that to your memories.");
      } catch (error) {
        logger.error("Error handling /remember command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while saving your memory."
        );
      }
    });

    // Memories command - Updated to use memory.text instead of memory.content
    this.bot.command("memories", async (ctx) => {
      if (!this.bot) return;
      try {
        const userId = ctx.session.userId;
        if (!userId) {
          await ctx.reply("Please /start a conversation first.");
          return;
        }

        const memories = await memoryService.getUserMemories(userId);

        if (memories.length === 0) {
          await ctx.reply("You don't have any memories yet.");
          return;
        }

        const recentMemories = memories.slice(-5).reverse(); // Show 5 most recent
        let response = "Your recent memories:\n";

        recentMemories.forEach((memory, index) => {
          response += `\n🔹 ${memory.text}`; // Use text field instead of content
        });

        await ctx.reply(response);
      } catch (error) {
        logger.error("Error handling /memories command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while retrieving your memories."
        );
      }
    });
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    if (!this.bot) return;
    // Handle text messages
    this.bot.on("message:text", async (ctx) => {
      try {
        // --- Auto-start session and register user if needed ---
        if (!ctx.session.activeConversation || !ctx.session.userId) {
          // Simulate /start logic
          const username =
            ctx.from?.username?.toLowerCase() || `telegram_${ctx.from?.id}`;
          const telegramUserId = ctx.from?.id?.toString();
          const displayName =
            ctx.from?.first_name || ctx.from?.username || "User";
          if (!telegramUserId) {
            await ctx.reply("Unable to identify user.");
            return;
          }
          const userId = `telegram_${telegramUserId}`;
          let user = await userService.findUserByUsername(username);
          let generatedPassword = undefined;
          if (!user) {
            generatedPassword = uuidv4();
            user = await userService.createUser({
              username,
              email: `telegram_${telegramUserId}@telegram.local`,
              password: generatedPassword,
              name: displayName,
            });
          }
          const globalSessionId = sessionService.getGlobalSessionId(userId);
          await sessionService.ensureGlobalSession(userId);
          if (!chatSessionManager.getSession(globalSessionId)) {
            chatSessionManager.initializeSession(globalSessionId, userId);
          }
          ctx.session = {
            userId,
            username,
            activeConversation: true,
            lastInteractionTime: Date.now(),
            sessionId: globalSessionId,
          };
          logger.info(
            `[AUTO-START] User ${userId} (${username}) started conversation, using global session ${globalSessionId}.`
          );
          if (generatedPassword) {
            await ctx.reply(
              this.escapeMarkdownV2(
                `✅ Your Synapse account has been created!\n\nUsername: ${username}\nPassword: ${generatedPassword}\n\nPlease save these credentials. You can use them to log in on the web app.`
              ),
              { parse_mode: "MarkdownV2" }
            );
          }
        }

        // --- Load recent conversation history for context (like chat controller/EnhancedChatService) ---
        if (ctx.session.sessionId) {
          await this._loadHistoryFromDB(
            ctx.session.sessionId,
            ctx.session.userId || "",
            false
          );
        }

        // Ensure conversation is active (set by /start)
        if (!ctx.session.activeConversation || !ctx.session.userId) {
          await ctx.reply("Please use /start to begin a conversation.");
          return;
        }

        const userMessageText = ctx.message.text;
        const userId = ctx.session.userId;
        const telegramUserId = ctx.from?.id;
        // Use the sessionId stored in the grammy session if available
        const currentSessionId = ctx.session.sessionId;
        const clientMessageId = uuidv4(); // Generate ID for this specific message

        logger.info(
          `Received message from user ${userId} in session context ${currentSessionId || "global"}`
        );

        // Track this message for the scheduler service
        if (telegramUserId) {
          // Update last message timestamp and track message for scheduling
          telegramSchedulerService.trackUserMessage(userId, telegramUserId);

          // Also update the session activity time
          sessionService
            .updateSessionActivity(
              currentSessionId || sessionService.getGlobalSessionId(userId)
            )
            .then((updated) => {
              if (updated) {
                logger.debug(
                  `Updated session activity time for ${currentSessionId || "global"}`
                );
              }
            })
            .catch((error) => {
              logger.warn(
                `Failed to update session activity time: ${error.message}`
              );
            });
        }

        // Indicate typing
        await ctx.api.sendChatAction(ctx.chat.id, "typing");

        try {
          // Add the user message to the chat session
          // This ensures the message appears in the history
          const sessionIdToUse =
            currentSessionId || sessionService.getGlobalSessionId(userId);

          chatSessionManager.addMessage(sessionIdToUse, {
            id: clientMessageId,
            sessionId: sessionIdToUse,
            role: MessageRole.USER,
            content: userMessageText,
            status: MessageStatus.PROCESSING,
            timestamp: new Date().toISOString(),
          });

          // Save message to DB
          const messageDoc = new MessageModel({
            _id: clientMessageId,
            userId: userId,
            sessionId: sessionIdToUse,
            role: MessageRole.USER,
            content: userMessageText,
            timestamp: new Date(),
            isDeleted: false,
          });

          await messageDoc.save();

          // Queue the message for asynchronous processing via Kafka
          await messageProducerService.queueChatMessage(
            userId,
            userMessageText,
            sessionIdToUse,
            MessageSource.TELEGRAM,
            clientMessageId,
            undefined, // no config
            {
              telegramUserId: telegramUserId?.toString(),
              chatId: ctx.chat.id,
            }
          );

          // Update last interaction time
          ctx.session.lastInteractionTime = Date.now();

          // No need to await response - the Kafka consumer will handle it asynchronously
          // Just acknowledge we received the message but won't wait for the response
          logger.info(
            `Message from Telegram user ${telegramUserId} queued for processing`
          );
        } catch (error) {
          logger.error(
            `Error queueing message via Kafka for user ${userId}, session ${currentSessionId || "global"}:`,
            error
          );
          await ctx.reply(
            "Sorry, I encountered an error while processing your message. Please try again later."
          );
        }
      } catch (error) {
        // Catch errors in the outer try block (e.g., getting userId)
        logger.error("Critical error handling text message:", error);
        try {
          await ctx.reply(
            "Sorry, a critical error occurred. Please try using /start again."
          );
        } catch (replyError) {
          logger.error("Failed to send error reply to user:", replyError);
        }
      }
    });
  }

  /**
   * Link a telegram user to a system user
   */
  public linkUser(
    telegramUserId: number,
    systemUserId: string,
    username: string
  ): void {
    // This would be enhanced with a proper database implementation
    // For now, this is a simple in-memory implementation
    this.bot?.on("message", (ctx) => {
      if (ctx.from?.id === telegramUserId) {
        ctx.session.userId = systemUserId;
        ctx.session.username = username;
      }
    });
  }

  /**
   * Send a message to a specific user
   */
  public async sendMessage(
    telegramUserId: number,
    message: string
  ): Promise<boolean> {
    if (!this.bot || !this.isRunning) {
      console.error("Cannot send message: Bot not initialized or not running");
      return false;
    }

    try {
      await this.bot.api.sendMessage(telegramUserId, message);
      return true;
    } catch (error) {
      console.error(`Error sending message to user ${telegramUserId}:`, error);
      return false;
    }
  }

  /**
   * Send a message to a specific chat ID
   */
  public async sendMessageToChatId(
    chatId: number | string,
    message: string
  ): Promise<boolean> {
    if (!this.bot || !this.isRunning) {
      logger.error("Cannot send message: Bot not initialized or not running");
      return false;
    }

    try {
      await this.bot.api.sendMessage(chatId, message);
      logger.info(`Message sent to chat ID ${chatId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending message to chat ID ${chatId}:`, error);
      return false;
    }
  }

  // Helper to save message (async, non-blocking) - Similar to EnhancedChatService
  private _saveMessageToDB(message: ChatMessageModel, userId: string) {
    if (!message || !message.sessionId || !message.id) {
      logger.warn(
        "[TelegramBotService] Attempted to save invalid message object:",
        message
      );
      return;
    }

    const messageData = {
      _id: message.id,
      id: message.id,
      sessionId: message.sessionId,
      userId: userId, // Use the provided userId
      role: message.role,
      content: message.content,
      status: message.status,
      timestamp: new Date(message.timestamp),
      metadata: message.metadata ? { ...message.metadata } : undefined,
    };

    MessageModel.create(messageData)
      .then(() => {
        logger.debug(`Saved message ${message.id} to DB from TelegramService.`);
      })
      .catch((err: Error) => {
        logger.warn(
          `[TelegramBotService] Failed to save message ${message.id} to DB:`,
          err.message
        );
      });
  }

  // Helper to escape MarkdownV2 special characters
  private escapeMarkdownV2(text: string): string {
    // See https://core.telegram.org/bots/api#markdownv2-style for full list
    return text.replace(/[!_\-*\[\]()~`>#+=|{}.]/g, (match) => `\\${match}`);
  }

  private async _loadHistoryFromDB(
    sessionId: string,
    userId: string,
    includeDeleted: boolean = false
  ): Promise<void> {
    // Adapted from EnhancedChatService._loadHistoryFromDB
    try {
      // Clear any existing in-memory history first to avoid duplicates
      const cleared = chatSessionManager.clearSessionHistory(sessionId);
      if (cleared) {
        logger.debug(
          `[TelegramBotService] Cleared in-memory history for session ${sessionId} before loading from DB.`
        );
      }

      // Check if there's an active activity for this session
      // (making this activity-aware, like EnhancedChatService)
      const activeActivity = await activityService.getActiveActivity(
        userId,
        sessionId
      );

      logger.debug(
        `[TelegramBotService] Loading history for session ${sessionId}, user ${userId}${
          activeActivity ? ` with active activity ${activeActivity._id}` : ""
        }`
      );

      // Build query based on activity context
      let queryConditions: any = { sessionId };

      if (activeActivity) {
        // If in an activity session, show only messages related to that activity
        logger.debug(
          `[TelegramBotService] Filtering messages for activity ${activeActivity._id}`
        );
        queryConditions["metadata.activityId"] = activeActivity._id;
      } else {
        // If in a normal session, exclude ALL activity-related messages
        logger.debug(
          `[TelegramBotService] Excluding activity-related messages from normal session`
        );
        queryConditions["metadata.activityId"] = { $exists: false };
      }

      // Only filter out deleted messages if includeDeleted is false
      if (!includeDeleted) {
        queryConditions.isDeleted = { $ne: true };
      }

      const messagesFromDB = await MessageModel.find(queryConditions)
        .sort({ timestamp: -1 })
        .limit(20)
        .lean()
        .exec();

      if (messagesFromDB && messagesFromDB.length > 0) {
        // Reverse to get chronological order (oldest first)
        const messagesInChronologicalOrder = messagesFromDB.reverse();

        for (const msgData of messagesInChronologicalOrder) {
          const chatMessage = new ChatMessageModel({
            ...msgData,
            id: msgData._id?.toString() || uuidv4(),
            role: msgData.role as MessageRole,
            timestamp:
              msgData.timestamp?.toISOString() || new Date().toISOString(),
          });
          chatSessionManager.addMessage(sessionId, chatMessage);
        }
        logger.debug(
          `[TelegramBotService] Loaded ${messagesFromDB.length} messages into session ${sessionId}${
            activeActivity ? ` for activity ${activeActivity._id}` : ""
          }`
        );
      } else {
        logger.debug(
          `[TelegramBotService] No history found in DB for session ${sessionId}${
            activeActivity ? ` and activity ${activeActivity._id}` : ""
          }.`
        );
      }
    } catch (error) {
      logger.error(
        `[TelegramBotService] Error loading history from DB for session ${sessionId}:`,
        error
      );
    }
  }
}

// Create singleton instance
export const telegramBotService = new TelegramBotService();
