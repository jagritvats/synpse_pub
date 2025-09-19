import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import path from "path";

// Load environment variables
dotenv.config();

// Import Middleware
import { errorHandler } from "./middlewares/error.middleware"; // Use specific error handler
import { authMiddleware } from "./middlewares/auth.middleware"; // Assuming this is needed if not applied globally in controllers
import { logMiddleware } from "./middlewares/log.middleware";
import {
  corsMiddleware,
  tracingMiddleware,
  responseTimeMiddleware,
} from "./middlewares/tracing.middleware";

// Import service singletons to initialize them (and potentially use them)
import { actionManager } from "./services/action-manager.service";
import { aiActionSuggester } from "./services/ai-action-suggester.service";
import { contextService } from "./services/context.service";
import { memoryService } from "./services/memory.service";
import { aiService } from "./services/ai.service";
import { mongoVectorDbService } from "./services/mongo-vector-db.service";
import { socialService } from "./services/social.service";
import { connectToDatabase, databaseService } from "./config/mongodb";
import { initScheduler } from "./services/scheduler.service"; // Import scheduler init
import { telegramBotService } from "./services/telegram/telegram-bot.service"; // Import telegram service
import { actionLogService } from "./services/action-log.service";
import { companionThinkingService } from "./services/companion-thinking.service"; // Import companion thinking service
import { summaryService } from "./services/summary.service"; // Import summary service

// Import Controllers (containing routes)
import healthRoutes from "./controllers/dev/health.controller";
import userRoutes from "./controllers/user.controller";
import authRoutes from "./controllers/auth.controller";
import chatRoutes from "./controllers/chat.controller";
import aiParametersRoutes from "./controllers/dev/ai-parameters.controller";
import serendipityRoutes from "./controllers/serendipity.controller"; // Uncommented and path confirmed
import memoryRoutes from "./controllers/memory.controller";
import contextRoutes from "./controllers/context.controller";
import schedulerRoutes from "./controllers/dev/scheduler.controller"; // Corrected path
import actionManagerRoutes from "./controllers/dev/action-manager.controller";
import companionStateRoutes from "./controllers/dev/companion-state.controller";
import socialRoutes from "./controllers/social.controller";
import actionRoutes from "./controllers/action.controller"; // Corrected path (removed dev/)
import triggerRoutes from "./controllers/dev/triggers.controller";
import noteRoutes from "./controllers/dev/notes.controller";
import telegramRoutes from "./controllers/dev/telegram.controller";
import vectorDbRoutes from "./controllers/vector-db.controller"; // Added import
import notionRoutes from "./controllers/dev/notion.controller";
import { timelineController as timelineRoutes } from "./controllers/dev/timeline.controller"; // Use named import
import userStateRoutes from "./controllers/user-state.controller"; // Import user state routes
import globalPromptRoutes from "./controllers/user.controller"; // Assuming global prompt is here
import telegramSchedulerRoutes from "./controllers/telegram/telegram-scheduler.controller";
import companionThinkingRoutes from "./controllers/dev/companion-thinking.controller"; // Import companion thinking routes
import summaryRoutes from "./controllers/dev/summary.controller"; // Import summary routes

// Import the telegram scheduler service
import { telegramSchedulerService } from "./services/telegram/telegram-scheduler.service";

// Import Kafka services
import { kafkaService } from "./services/kafka/kafka.service";
import { messageConsumerService } from "./services/kafka/message-consumer.service";

// Create Express application
const app = express();
const port = process.env.PORT || 3000; // Use PORT from env, fallback to 3000

// Apply middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsMiddleware));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply observability middleware
app.use(responseTimeMiddleware);
app.use(tracingMiddleware);
// Replace morgan with our custom logger
// app.use(morgan("dev"));
app.use(logMiddleware);

// Apply auth middleware (but not to paths that don't need it)
// Add any paths that don't need auth to the skipPaths array
const skipPaths = ["/api/auth/login", "/api/auth/register", "/api/health"];
app.use((req, res, next) => {
  if (skipPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// Mount Controller Routes
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai-parameters", aiParametersRoutes);
app.use("/api/serendipity", serendipityRoutes); // Uncommented
app.use("/api/memories", memoryRoutes);
app.use("/api/context", contextRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/action-manager", actionManagerRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/actions", actionRoutes);
app.use("/api/triggers", triggerRoutes); // Corrected path typo from /api/trigger
app.use("/api/notes", noteRoutes); // Corrected path typo from /api/note
app.use("/api/telegram", telegramRoutes);
app.use("/api/vector-db", vectorDbRoutes); // Added usage
app.use("/api/notion", notionRoutes); // Updated path to match our integration
app.use("/api/user-state", userStateRoutes); // Add user state routes
app.use("/api/user/global-prompt", globalPromptRoutes); // Keep existing user routes if needed
app.use("/api/telegram/scheduler", telegramSchedulerRoutes);
app.use("/api/dev/companion-thinking", companionThinkingRoutes); // Mount companion thinking routes
app.use("/api/dev/summary", summaryRoutes); // Mount summary routes

// Companion state routes - mount at both /api/companion-state and /api/dev/companion-state for compatibility
app.use("/api/companion-state", companionStateRoutes);

// Development routes
app.use("/api/timeline", timelineRoutes);

// Serve static files in production (from app.ts)
if (process.env.NODE_ENV === "production") {
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, "../public")));

  // For any other route, serve the index.html file
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
  });
}

// Global error handler (from old index.ts, using imported handler)
app.use(errorHandler);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`http://localhost:${port}`); // Log link from old index.ts

  // Initialize background tasks / services
  console.log("Initializing services...");
  initScheduler(); // Initialize scheduler from old index.ts

  // Start Telegram bot if token is provided (from old index.ts)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      telegramBotService.start();
      console.log("Telegram bot started automatically");
      // Do NOT start telegramSchedulerService here!
    } catch (error) {
      console.error("Failed to start Telegram services:", error);
    }
  } else {
    console.log(
      "Telegram services not started: TELEGRAM_BOT_TOKEN not provided"
    );
  }

  // Connect to MongoDB (from app.ts)
  connectToDatabase()
    .then(() => {
      console.log("MongoDB connection established successfully");
      // Start the Telegram scheduler service ONLY after DB is connected
      if (process.env.TELEGRAM_BOT_TOKEN) {
        telegramSchedulerService.start();
        console.log(
          "Telegram scheduler service started automatically (after DB connection)"
        );
      }

      // Initialize Kafka services
      if (process.env.ENABLE_KAFKA !== "false") {
        try {
          console.log("Initializing Kafka services...");

          // Log Kafka configuration
          console.log(
            `Using Kafka brokers: ${process.env.KAFKA_BROKERS || "localhost:9092"}`
          );
          console.log(
            `Kafka client ID: ${process.env.KAFKA_CLIENT_ID || "synapse-app"}`
          );

          // Connect to Kafka with proper error handling
          kafkaService
            .connect()
            .then(() => {
              console.log("Successfully connected to Kafka");

              // Start message consumers
              return messageConsumerService.startConsuming();
            })
            .then(() => {
              console.log("Kafka message consumers started successfully");
            })
            .catch((error) => {
              console.error("Kafka initialization error:", error);
              console.log("Falling back to synchronous processing mode");
            });
        } catch (error) {
          console.error("Failed to initialize Kafka:", error);
          console.log("Using synchronous processing as fallback");
        }
      } else {
        console.log(
          "Kafka is disabled by configuration. Using synchronous processing."
        );
      }
    })
    .catch((err) => {
      console.error("Initial MongoDB connection failed:", err);
      console.log("Services will use in-memory fallback where available");
    });

  // Set up database service event listeners for ongoing monitoring (from app.ts)
  databaseService.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });
  databaseService.on("disconnected", () => {
    console.warn("MongoDB disconnected - services will use in-memory fallback");
  });
  databaseService.on("reconnected", () => {
    console.log("MongoDB reconnected - resuming normal operation");
  });
  databaseService.on("maxReconnectAttemptsReached", () => {
    console.error(
      "MongoDB max reconnect attempts reached - check database server"
    );
  });

  // Register the AI action suggester (commented out in app.ts, kept commented)
  // actionManager.registerDefaultActions(aiActionSuggester);
  // console.log("Registered AI action suggester with action manager");

  // Enable companion thinking service by default unless explicitly disabled
  if (process.env.DISABLE_COMPANION_THINKING !== "true") {
    companionThinkingService.setEnabled(true);
    console.log("Companion thinking service enabled");
  } else {
    companionThinkingService.setEnabled(false);
    console.log("Companion thinking service disabled by configuration");
  }

  // Enable user summary service by default
  summaryService.setEnabled(true);
  console.log("User summary service enabled");
});

// Handle unhandled promise rejections (from old index.ts)
process.on("unhandledRejection", (err: Error) => {
  console.error("Unhandled Promise Rejection:", err);
  // Consider more robust handling like logging service or graceful shutdown
});

// Handle uncaught exceptions (from old index.ts)
process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err);
  // It's generally recommended to exit after an uncaught exception
  process.exit(1);
});

// Export action-related services
export { actionManager } from "./services/action-manager.service";
export { actionLogService } from "./services/action-log.service";

export default app;
