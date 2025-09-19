// import { Bot, Context, session, SessionFlavor } from "grammy";import { Logger } from "../utils/logger";
// import { aiService } from "./ai.service";
// import { chatSessionManager } from "./chat-session.service";
// import { sessionService } from "./session.service";
// import {
//   MessageRole,
//   ChatMessageModel,
//   MessageStatus,
// } from "../models/chat.model";
// import { v4 as uuidv4 } from "uuid";
// import { databaseService } from "../config/mongodb";
// import { contextService } from "./context.service";
// import { memoryService } from "./memory.service";
// import { ContextType } from "../interfaces/context-type.enum";
// import { ContextDuration } from "../interfaces/context-duration.enum";
//
// // Define the structure of the session data
// interface SessionData {
//   // Add any session properties you want to store, e.g.:
//   // activeSessionId?: string;
// }
//
// // Extend the Context type with the session flavor
// type MyContext = Context & SessionFlavor<SessionData>;
//
// /**
//  * Service for handling Telegram bot integration
//  */
// class TelegramService {
//   private readonly logger = new Logger("TelegramService");
//   // Use MyContext which includes SessionFlavor
//   private bot: Bot<MyContext> | null = null;
//   // Map to store telegram user ID to *active* session ID mappings
//   private userActiveSessions: Map<string, string> = new Map();
//
//   /**
//    * Initialize the Telegram bot with the given token
//    */
//   initialize(token: string) {
//     if (!token) {
//       this.logger.error(
//         "TELEGRAM_BOT_TOKEN is not defined in the environment variables."
//       );
//       throw new Error("TELEGRAM_BOT_TOKEN is required");
//     }
//
//     try {
//       this.bot = new Bot(token);
//       this.setupBot();
//       this.bot.start().catch((error) => {
//         this.logger.error("Failed to start Telegram bot:", error);
//       });
//       this.logger.info("Telegram bot started.");
//     } catch (error) {
//       this.logger.error("Error initializing Telegram bot:", error);
//       throw error;
//     }
//   }
//
//   /**
//    * Stop the Telegram bot
//    */
//   shutdown() {
//     if (this.bot) {
//       this.bot.stop();
//       this.logger.info("Telegram bot stopped.");
//     }
//   }
//
//   /**
//    * Set up bot commands and message handlers
//    */
//   private setupBot() {
//     if (!this.bot) {
//       this.logger.error("Cannot setup bot - bot instance is null");
//       return;
//     }
//
//     // Middleware to handle sessions, using our SessionData interface
//     this.bot.use(session({ initial: (): SessionData => ({}) }));
//
//     // Handle the /start command
//     this.bot.command("start", async (ctx: MyContext) => {
//       await this.handleStartCommand(ctx);
//     });
//
//     // Handle the /newsession command
//     this.bot.command("newsession", async (ctx: MyContext) => {
//       await this.handleNewSessionCommand(ctx);
//     });
//
//     // Handle the /help command
//     this.bot.command("help", async (ctx: MyContext) => {
//       await ctx.reply(
//         "Available commands:\n" +
//           "/start - Start or resume conversation\n" +
//           "/newsession - Start a new conversation session\n" +
//           "/listsessions - List your conversation sessions\n" +
//           "/usesession <sessionId> - Switch to an existing session\n" +
//           "/namesession <sessionId> <newName> - Rename a session\n" +
//           "/help - Show this help message"
//       );
//     });
//
//     // Handle text messages - this is the main chat functionality
//     this.bot.on("message:text", async (ctx: MyContext) => {
//       await this.handleMessage(ctx);
//     });
//
//     // Handle the /usesession command
//     this.bot.command("usesession", async (ctx: MyContext) => {
//       await this.handleUseSessionCommand(ctx);
//     });
//
//     // Handle the /listsessions command
//     this.bot.command("listsessions", async (ctx: MyContext) => {
//       await this.handleListSessionsCommand(ctx);
//     });
//
//     // Handle the /namesession command
//     this.bot.command("namesession", async (ctx: MyContext) => {
//       await this.handleNameSessionCommand(ctx);
//     });
//   }
//
//   /**
//    * Handle the /start command
//    */
//   private async handleStartCommand(ctx: MyContext) {
//     const telegramUserId = ctx.from?.id.toString();
//     if (!telegramUserId) {
//       await ctx.reply("Unable to identify user.");
//       return;
//     }
//     const userId = `telegram_${telegramUserId}`;
//
//     // Ensure global session exists for this user (will be created if needed)
//     // Using the service ensures it checks DB/creates if necessary
//     const globalSession = await sessionService.ensureGlobalSession(userId);
//     const globalSessionId = globalSession._id; // Use the actual global session ID
//
//     // Set the global session as the default active session for this user
//     this.userActiveSessions.set(telegramUserId, globalSessionId);
//     this.logger.info(
//       `User ${telegramUserId} started. Active session set to global: ${globalSessionId}`
//     );
//
//     // Load context for the global session
//     await aiService.loadSessionContext(userId, globalSessionId);
//
//     await ctx.reply(
//       "Welcome to Synapse! I'm ready when you are. Your conversation here is automatically using your primary global session."
//     );
//   }
//
//   /**
//    * Handle the /newsession command
//    */
//   private async handleNewSessionCommand(ctx: MyContext) {
//     const telegramUserId = ctx.from?.id.toString();
//     if (!telegramUserId) {
//       await ctx.reply("Unable to identify user.");
//       return;
//     }
//     const userId = `telegram_${telegramUserId}`;
//
//     // Use sessionService to create the session in the DB
//     const newSession = await sessionService.createSession(userId, {
//       title: "New Telegram Chat",
//     });
//
//     // Update the user's active session map
//     this.userActiveSessions.set(telegramUserId, newSession._id);
//     this.logger.info(
//       `User ${telegramUserId} created new session: ${newSession._id}. Set as active.`
//     );
//
//     // Load context for the new session
//     await aiService.loadSessionContext(userId, newSession._id);
//
//     await ctx.reply(
//       `I've created a new conversation session (ID: \`${newSession._id}\`). This is now your active session. How can I assist?`,
//       { parse_mode: "MarkdownV2" }
//     );
//   }
//
//   /**
//    * Handle incoming text messages
//    */
//   private async handleMessage(ctx: MyContext) {
//     const telegramUserId = ctx.from?.id.toString();
//     if (!telegramUserId) {
//       await ctx.reply("Unable to identify user.");
//       return;
//     }
//     const userId = `telegram_${telegramUserId}`;
//
//     const messageText = ctx.message?.text;
//     if (!messageText) {
//       await ctx.reply("I received an empty message. Please try again.");
//       return;
//     }
//
//     // Get current ACTIVE session ID from the map
//     let activeSessionId = this.userActiveSessions.get(telegramUserId);
//
//     // If no active session is mapped, default to the user's global session
//     if (!activeSessionId) {
//       this.logger.warn(
//         `No active session mapped for ${telegramUserId}, defaulting to global session.`
//       );
//       const globalSession = await sessionService.ensureGlobalSession(userId);
//       activeSessionId = globalSession._id;
//       this.userActiveSessions.set(telegramUserId, activeSessionId);
//       // Load context if we just defaulted to global
//       await aiService.loadSessionContext(userId, activeSessionId);
//     } else {
//       // Verify the mapped active session still exists (might have been deleted/expired)
//       const sessionExists = await sessionService.getSession(activeSessionId);
//       if (!sessionExists) {
//         this.logger.warn(
//           `Mapped active session ${activeSessionId} for ${telegramUserId} not found, defaulting to global.`
//         );
//         const globalSession = await sessionService.ensureGlobalSession(userId);
//         activeSessionId = globalSession._id;
//         this.userActiveSessions.set(telegramUserId, activeSessionId);
//         // Load context if we just defaulted to global
//         await aiService.loadSessionContext(userId, activeSessionId);
//       }
//     }
//
//     this.logger.info(
//       `Processing message from Telegram user ${telegramUserId} in active session ${activeSessionId}`
//     );
//
//     await ctx.api.sendChatAction(telegramUserId, "typing");
//
//     try {
//       // Process the user message using the active session ID
//       const response = await aiService.processUserMessage(
//         userId,
//         activeSessionId,
//         messageText
//       );
//
//       console.log(JSON.stringify(response))
//
//       if (response && response.responseMessage) {
//         // Send the response back to the user
//         await ctx.reply(response.responseMessage);
//
//         // If there are any action results, also send those
//         if (response.actionResults && response.actionResults.length > 0) {
//           const actionSummary = response.actionResults
//             .map(
//               (a) =>
//                 `${a.actionId}: ${a.success ? "Success" : "Failed"}${a.result ? ` - ${a.result}` : ""}`
//             )
//             .join("\n");
//
//           await ctx.reply(`Actions performed:\n${actionSummary}`);
//         }
//       } else {
//         throw new Error("Invalid response from AI service");
//       }
//     } catch (error) {
//       this.logger.error(
//         `Error processing message from Telegram user ${telegramUserId}:`,
//         error
//       );
//
//       await ctx.reply(
//         "I'm sorry, I encountered an error while processing your message. Please try again later."
//       );
//     }
//   }
//
//   /**
//    * Handle the /usesession <sessionId> command
//    */
//   private async handleUseSessionCommand(ctx: MyContext) {
//     const telegramUserId = ctx.from?.id.toString();
//     this.logger.info(
//       `Received /usesession attempt from user ${telegramUserId || "unknown"}`
//     );
//     if (!telegramUserId) {
//       await ctx.reply("Unable to identify user.");
//       return;
//     }
//
//     const expectedUserId = `telegram_${telegramUserId}`;
//     let providedSessionId: string | undefined;
//
//     try {
//       const args = ctx.message?.text?.split(" ") || [];
//       providedSessionId = args[1];
//       this.logger.info(
//         `Parsed args: ${args.join(" ")}, session ID: ${providedSessionId}`
//       );
//
//       if (!providedSessionId) {
//         await ctx.reply(
//           "Please provide a Session ID. Usage: /usesession <sessionId>"
//         );
//         return;
//       }
//
//       // Validate the session ID using sessionService
//       const session = await sessionService.getSession(providedSessionId);
//       this.logger.info(
//         `Session lookup result for ${providedSessionId}: ${session ? "Found" : "Not Found"}`
//       );
//       if (!session) {
//         await ctx.reply(`Session ID \`${providedSessionId}\` not found.`, {
//           parse_mode: "MarkdownV2",
//         });
//         return;
//       }
//
//       // Verify the session belongs to this Telegram user
//       this.logger.info(
//         `Comparing session owner (${session.userId}) with expected (${expectedUserId})`
//       );
//       if (session.userId !== expectedUserId) {
//         await ctx.reply(
//           `Session ID \`${providedSessionId}\` does not belong to you.`,
//           { parse_mode: "MarkdownV2" }
//         );
//         return;
//       }
//
//       // Update the user's active session map
//       this.userActiveSessions.set(telegramUserId, providedSessionId);
//       this.logger.info(
//         `Telegram user ${telegramUserId} successfully switched active session to ${providedSessionId}`
//       );
//
//       // --- Load context for the newly activated session ---
//       await aiService.loadSessionContext(expectedUserId, providedSessionId);
//
//       await ctx.reply(
//         `Switched to session: ${session.metadata?.title || "Untitled"} (ID: \`${providedSessionId}\`). You can now continue this conversation.`,
//         { parse_mode: "MarkdownV2" }
//       );
//     } catch (error) {
//       this.logger.error(
//         `Error in handleUseSessionCommand for user ${telegramUserId}:`,
//         error
//       );
//       await ctx.reply(
//         "An error occurred while trying to switch sessions. Please try again."
//       );
//     }
//   }
//
//   /**
//    * Handle the /listsessions command
//    */
//   private async handleListSessionsCommand(ctx: MyContext) {
//     const telegramUserId = ctx.from?.id.toString();
//     if (!telegramUserId) {
//       await ctx.reply("Unable to identify user.");
//       return;
//     }
//
//     const userId = `telegram_${telegramUserId}`;
//     // Fetch sessions using sessionService (which hits DB)
//     const userSessions = await sessionService.getUserSessions(userId);
//     const activeSessionId = this.userActiveSessions.get(telegramUserId);
//
//     if (userSessions.length === 0) {
//       // This shouldn't happen if ensureGlobalSession works, but handle anyway
//       await ctx.reply(
//         "You don't have any sessions yet. Start chatting to create your global session."
//       );
//       return;
//     }
//
//     let replyMessage = "Your chat sessions:\n";
//     // Sort sessions, maybe put global first?
//     userSessions.sort((a, b) => {
//       if (a._id.startsWith("global-")) return -1;
//       if (b._id.startsWith("global-")) return 1;
//       // Sort by last activity descending for non-global
//       return b.lastActivity.getTime() - a.lastActivity.getTime();
//     });
//
//     userSessions.forEach((session) => {
//       const title =
//         session.metadata?.title || `Session ${session._id.substring(0, 6)}`;
//       const isGlobal = session._id.startsWith("global-");
//       const isActive = activeSessionId === session._id;
//       replyMessage += `\n- ${title} (ID: \`${session._id}\`)${isGlobal ? " [Global]" : ""}${isActive ? " ✨ Active" : ""}`;
//     });
//
//     replyMessage +=
//       "\n\nUse `/usesession <sessionId>` to switch or `/namesession <sessionId> <newName>` to rename.";
//
//     await ctx.reply(replyMessage, { parse_mode: "MarkdownV2" });
//   }
//
//   /**
//    * Handle the /namesession <sessionId> <newName> command
//    */
//   private async handleNameSessionCommand(ctx: MyContext) {
//     const telegramUserId = ctx.from?.id.toString();
//     this.logger.info(
//       `Received /namesession attempt from user ${telegramUserId || "unknown"}`
//     );
//     if (!telegramUserId) {
//       await ctx.reply("Unable to identify user.");
//       return;
//     }
//     const expectedUserId = `telegram_${telegramUserId}`;
//
//     try {
//       const args = ctx.message?.text?.split(" ") || [];
//       const providedSessionId = args[1];
//       const newName = args.slice(2).join(" ");
//       this.logger.info(
//         `Parsed args: session ID=${providedSessionId}, newName='${newName}'`
//       );
//
//       if (!providedSessionId || !newName) {
//         await ctx.reply(
//           "Please provide a Session ID and a new name. Usage: /namesession <sessionId> <New Session Name>"
//         );
//         return;
//       }
//
//       // Validate session existence and ownership using sessionService
//       const session = await sessionService.getSession(providedSessionId);
//       this.logger.info(
//         `Session lookup result for ${providedSessionId}: ${session ? "Found" : "Not Found"}`
//       );
//
//       if (!session || session.userId !== expectedUserId) {
//         await ctx.reply(
//           `Session ID \`${providedSessionId}\` not found or does not belong to you.`,
//           { parse_mode: "MarkdownV2" }
//         );
//         return;
//       }
//
//       // Use sessionService to update metadata
//       this.logger.info(
//         `Attempting to rename session ${providedSessionId} to '${newName}' via sessionService`
//       );
//       const updatedSession = await sessionService.updateSessionMetadata(
//         providedSessionId,
//         { title: newName }
//       );
//       this.logger.info(
//         `Rename result: ${updatedSession ? "Success" : "Failed"}`
//       );
//
//       if (updatedSession) {
//         this.logger.info(
//           `Session ${providedSessionId} renamed to '${newName}' by Telegram user ${telegramUserId}`
//         );
//         await ctx.reply(`Session renamed to: ${newName}`);
//       } else {
//         // This might happen if the session disappeared between check and update, or DB error
//         await ctx.reply(
//           "Failed to rename the session. It might no longer exist or there was a database issue."
//         );
//       }
//     } catch (error) {
//       this.logger.error(
//         `Error in handleNameSessionCommand for user ${telegramUserId}:`,
//         error
//       );
//       await ctx.reply(
//         "An error occurred while trying to rename the session. Please try again."
//       );
//     }
//   }
// }
//
// // Create a singleton instance
// export const telegramService = new TelegramService();
