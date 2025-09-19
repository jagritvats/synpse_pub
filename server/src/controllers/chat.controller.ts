import { Router, Request, Response } from "express";
import { MessageRole, MessageStatus } from "../models/chat.model";
import { chatSessionManager } from "../services/chat-session.service";
import { aiService } from "../services/ai.service";
import { sessionService } from "../services/session.service";
import { v4 as uuidv4 } from "uuid";
import SSE from "express-sse";
import { optionalAuthMiddleware } from "../middlewares/auth.middleware";
import Message from "../models/message.model";
import jwt from "jsonwebtoken";
import { enhancedChatService } from "../services/enhanced-chat.service";
import { loggerFactory } from "../utils/logger.service";
import { SSEWrapper } from "../utils/sse.wrapper";
import { userService } from "../services/user.service";
import Memory from "../models/memory.model";
import VectorDocument from "../models/vector-document.model";
import {
  messageProducerService,
  MessageSource,
} from "../services/kafka/message-producer.service";

const logger = loggerFactory.getLogger("ChatController");

const router = Router();
router.use(optionalAuthMiddleware);

// Create SSE instances for each session
export const sseConnections: Record<string, SSEWrapper> = {};

/**
 * @route   POST /api/chat/sessions
 * @desc    Create a new chat session for the authenticated user
 * @access  Private
 */
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    // Use req.user.id; must be present for creating a user-specific session
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User ID required to create session" });
    }
    const metadata = req.body.metadata || {};

    console.log(`Creating new chat session for user ${userId}`);

    const session = await sessionService.createSession(userId, metadata);
    if (!session) {
      return res.status(500).json({ error: "Failed to create session" });
    }

    // Initialize chat session state
    chatSessionManager.initializeSession(session.id, session.userId);

    res.status(201).json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @route   GET /api/chat/sessions
 * @desc    Get all chat sessions for the authenticated user
 * @access  Private
 */
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    // Use req.user.id; must be present to get user's sessions
    const userId = req.user?.id;
    if (!userId) {
      // If anonymous access to list sessions is ever needed, this logic would change,
      // but based on the goal, we require a logged-in user here.
      return res
        .status(401)
        .json({ error: "Unauthorized: User ID required to list sessions" });
    }
    const sessions = await sessionService.getUserSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error("Error getting sessions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @route   GET /api/chat/sessions/:sessionId
 * @desc    Get a specific chat session (verify ownership)
 * @access  Private
 */
router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    // Use req.user.id; must be present to verify ownership
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User ID required to view session" });
    }
    const session = await sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @route   DELETE /api/chat/sessions/:sessionId
 * @desc    Delete a chat session (verify ownership)
 * @access  Private
 */
router.delete("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    // Use req.user.id; must be present to verify ownership
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User ID required to delete session" });
    }

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const success = await sessionService.endSession(sessionId);

    // Clean up chat session state from memory
    chatSessionManager.endSession(sessionId);

    // Clean up SSE connection if exists
    if (sseConnections[sessionId]) {
      sseConnections[sessionId].close();
      delete sseConnections[sessionId];
    }

    res.status(204).end();
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @route   POST /api/chat/:sessionId/message
 * @desc    Send a message in a chat session.
 *          Handles session validation, enqueues message for async processing via Kafka,
 *          and SSE updates will be sent by the Kafka consumer when processing is complete.
 * @access  Private (or Anonymous)
 */
router.post("/:sessionId/message", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { message, config, clientTempId } = req.body;
  // Get user ID from auth middleware; must be present to send a message
  const userId = req.user?.id;
  if (!userId) {
    // This implies anonymous users cannot send messages at all.
    // If anonymous messaging was intended, the session would need to be created/fetched differently.
    return res
      .status(401)
      .json({ message: "Unauthorized: User ID required to send message" });
  }

  if (!message) {
    return res.status(400).json({ message: "Message content is required" });
  }

  const clientMessageId = uuidv4(); // Generate a REAL ID for the user's message submission

  logger.info(
    `Received message POST for session ${sessionId}, user ${userId}, clientMsgId ${clientMessageId}, tempId ${clientTempId}`
  );

  try {
    // Verify session existence and access rights
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Verify ownership/access rights
    if (session.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Access denied - Not your session" });
    }

    // Indicate processing started via SSE
    if (sseConnections[sessionId]) {
      // Send user message status (initially received, maybe processing)
      sseConnections[sessionId].send(
        {
          messageId: clientMessageId, // Send the REAL backend-generated ID
          clientTempId: clientTempId, // Include the client's temp ID for reconciliation
          sessionId: sessionId,
          role: MessageRole.USER,
          content: message,
          status: MessageStatus.PROCESSING, // Or COMPLETED if we consider it done on receipt
          timestamp: new Date().toISOString(),
          userId: userId,
        },
        "messageUpdate" // Use messageUpdate to potentially create/update the message on client
      );
      // Indicate assistant is typing (placeholder)
      sseConnections[sessionId].send({ isTyping: true }, "typing");
    } else {
      logger.warn(
        `SSE connection not found for session ${sessionId} before processing message.`
      );
    }

    // Add the user message to the chat session
    // This ensures the message appears in the chat immediately
    chatSessionManager.addMessage(sessionId, {
      id: clientMessageId,
      sessionId: sessionId,
      role: MessageRole.USER,
      content: message,
      status: MessageStatus.PROCESSING,
      timestamp: new Date().toISOString(),
    });

    // Queue the message for asynchronous processing via Kafka
    const requestId = await messageProducerService.queueChatMessage(
      userId,
      message,
      sessionId,
      MessageSource.WEB_API,
      clientMessageId,
      config
    );

    // Respond to the POST request successfully
    res.status(200).json({
      userMessageId: clientMessageId,
      requestId: requestId, // Return the Kafka request ID for tracing
      sessionId: sessionId,
      status: "Message queued for processing",
    });
  } catch (error: any) {
    logger.error(
      `Error queueing message in POST /${sessionId}/message for user ${userId}:`,
      error
    );

    // Attempt to send an error message via SSE
    if (sseConnections[sessionId]) {
      const errorAssistantMessageId = uuidv4();
      const errorContent = error.message?.includes("Access denied")
        ? "Error: Access Denied."
        : "Sorry, an internal error occurred processing your message.";

      sseConnections[sessionId].send(
        {
          messageId: errorAssistantMessageId,
          sessionId: sessionId,
          role: MessageRole.ASSISTANT,
          content: errorContent,
          status: MessageStatus.ERROR,
          timestamp: new Date().toISOString(),
          userId: userId,
          metadata: { error: true, errorMessage: error.message },
        },
        "messageUpdate"
      );
      // Send typing stopped
      sseConnections[sessionId].send(
        { isTyping: false, messageId: errorAssistantMessageId },
        "typing"
      );
    }

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (error.message?.includes("not found")) {
      statusCode = 404;
    } else if (error.message?.includes("Access denied")) {
      statusCode = 403;
    }

    res.status(statusCode).json({
      error: "Failed to queue message",
      message: error.message || "Unknown error",
      userMessageId: clientMessageId,
    });
  }
});

/**
 * @route   GET /api/chat/sessions/:sessionId/messages
 * @desc    Get all messages for a specific chat session (verify ownership if not anonymous)
 * @access  Private (or Anonymous)
 */
router.get("/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    // Use req.user.id; must be present to verify ownership
    const userId = req.user?.id;
    if (!userId) {
      // This implies anonymous users cannot fetch messages.
      // If needed, access control would need to check session properties (e.g., isPublic)
      // instead of relying on a userId match.
      return res
        .status(401)
        .json({ error: "Unauthorized: User ID required to fetch messages" });
    }
    const limit = parseInt(req.query.limit as string) || 100;

    // Verify session existence and access rights
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Verify ownership/access rights
    if (session.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Access denied - Not your session" });
    }

    // Get query parameter for showing deleted messages
    const includeDeleted = req.query.includeDeleted === "true";

    // Fetch messages directly from the Message collection
    let query = { sessionId };

    // Only filter out deleted messages if includeDeleted is false
    if (!includeDeleted) {
      query = { ...query, isDeleted: { $ne: true } };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 }) // Sort by timestamp descending (most recent first)
      .limit(limit); // Apply limit for pagination

    // Messages are fetched most recent first, reverse for chronological display
    res.json(messages.reverse());
  } catch (error) {
    console.error("Error getting session messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @route   GET /api/chat/:sessionId/events
 * @desc    Establish SSE connection for real-time session updates
 * @access  Private (or Anonymous)
 */
router.get("/:sessionId/events", async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  // Check both authorization header and query parameter for token
  let token: string | undefined = undefined;

  // First check Authorization header (prioritize this)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
    logger.debug(
      `SSE Auth: Using token from Authorization header for session ${sessionId}`
    );
  }
  // Then fall back to query parameter if header is not available
  else if (req.query.token) {
    token = req.query.token as string;
    logger.debug(
      `SSE Auth: Using token from query parameter for session ${sessionId}`
    );
  }

  let userId: string | undefined = undefined; // Initialize as undefined

  // Add proper headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Add CORS headers to support cross-origin SSE
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // --- Authentication ---
  if (!token) {
    logger.warn(`SSE Auth: No token provided for session ${sessionId}.`);
    res.write(
      `event: error\ndata: ${JSON.stringify({ error: "Unauthorized: No token provided" })}\n\n`
    );
    return res.end();
  }

  try {
    // Use the correct environment variable (JWT_SECRET) consistent with middleware/signing
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Handle missing secret consistently
      logger.error("JWT_SECRET is not defined for SSE /events endpoint.");
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Internal server error: Auth config missing." })}\n\n`
      );
      return res.end();
    }

    // Verify using the correct secret
    try {
      const decoded = jwt.verify(token, secret) as { id: string };
      // Check if user exists in DB (optional but good practice)
      const user = await userService.findUserById(decoded.id);
      if (!user) {
        logger.warn(
          `SSE Auth: User ${decoded.id} from token not found in DB for session ${sessionId}.`
        );
        res.write(
          `event: error\ndata: ${JSON.stringify({ error: "Unauthorized: User not found" })}\n\n`
        );
        return res.end();
      }
      userId = user._id.toString(); // Set userId only if token is valid and user exists
      logger.debug(
        `SSE Auth: User ${userId} verified via token for session ${sessionId}.`
      );
    } catch (e: unknown) {
      // Log the specific JWT error
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn(
        `SSE Auth: Invalid token for session ${sessionId}. Error: ${errorMessage}`
      );
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: `Unauthorized: Invalid token (${errorMessage})` })}\n\n`
      );
      return res.end();
    }

    // userId should now be a valid user ID or the request should have ended
    if (!userId) {
      // This case should technically be unreachable due to checks above, but acts as a safeguard.
      logger.error(
        `SSE Auth: userId is unexpectedly undefined after auth checks for session ${sessionId}.`
      );
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Internal Server Error during authentication" })}\n\n`
      );
      return res.end();
    }

    logger.info(
      `SSE connection attempt for session ${sessionId}, user ${userId}`
    );

    // 1. Verify Session Existence & Access Rights using SessionService
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      logger.warn(`SSE connection failed: Session ${sessionId} not found.`);
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Session not found" })}\n\n`
      );
      return res.end();
    }

    // Access check: Simply check if the session belongs to the authenticated user.
    // Global sessions can be accessed by anyone, other sessions must be owned by the user
    const isGlobalSession = sessionId.startsWith("global-");
    if (!isGlobalSession && session.userId !== userId) {
      logger.warn(
        `SSE connection denied: User ${userId} cannot access session ${sessionId} owned by ${session.userId}.`
      );
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Access denied - Not your session" })}\n\n`
      );
      return res.end();
    }

    // 2. Setup SSE Connection using our wrapper
    // Create wrapper with session and user info
    const sseWrapper = new SSEWrapper(sessionId, userId);

    // Initialize the wrapper - will handle all the headers, initial message, etc.
    try {
      const initialized = sseWrapper.init(req, res);
      if (!initialized) {
        logger.error(
          `Failed to initialize SSE wrapper for session ${sessionId}`
        );
        if (!res.headersSent) {
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: "Failed to initialize SSE connection" })}\n\n`
          );
          return res.end();
        }
        return;
      }

      // Store in global map for access in message handler/etc
      sseConnections[sessionId] = sseWrapper;

      // Send initial connection success message
      res.write(
        `event: connected\ndata: ${JSON.stringify({ status: "connected", sessionId })}\n\n`
      );

      // 3. Handle Client Disconnect - Our wrapper handles this internally as well
      req.on("close", () => {
        logger.info(
          `SSE connection closed for session ${sessionId}, user ${userId}.`
        );
        if (sseConnections[sessionId] === sseWrapper) {
          delete sseConnections[sessionId];
        }
      });
    } catch (error) {
      logger.error(`Error initializing SSE wrapper: ${error}`);
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Error initializing SSE connection" })}\n\n`
      );
      return res.end();
    }
  } catch (error) {
    logger.error(`Error establishing SSE for session ${sessionId}: ${error}`);
    // Handle error response if possible
    if (!res.headersSent) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Internal server error setting up SSE" })}\n\n`
      );
      return res.end();
    } else {
      logger.error(
        "SSE stream headers already sent, cannot send JSON error for SSE setup failure."
      );
      if (!res.writableEnded) {
        try {
          res.end();
        } catch (endError) {
          logger.error("Error ending response after SSE failure:", endError);
        }
      }
    }
  }
});

/**
 * @route   DELETE /api/chat/:sessionId/messages/:messageId
 * @desc    Soft delete a message by ID (mark as deleted)
 * @access  Private
 */
router.delete(
  "/:sessionId/messages/:messageId",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, messageId } = req.params;
      // Get user ID from auth middleware; must be present to delete a message
      const userId = req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: User ID required to delete messages" });
      }

      // First check if the session exists and user has access
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership/access rights
      if (session.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Access denied - Not your session" });
      }

      // 1. First update the message in the database
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (message.sessionId !== sessionId) {
        return res
          .status(400)
          .json({ error: "Message does not belong to this session" });
      }

      // Mark the message as deleted
      message.isDeleted = true;
      await message.save();

      // 2. Update any related memories that have this message ID
      await Memory.updateMany(
        { "metadata.messageId": messageId },
        { isDeleted: true }
      );

      // 3. Update any related vector documents
      await VectorDocument.updateMany(
        { sourceId: messageId },
        { isDeleted: true }
      );

      // 4. Update the in-memory chat session
      const inMemoryUpdated = chatSessionManager.softDeleteMessage(
        sessionId,
        messageId
      );

      // 5. Send SSE update if connection exists
      if (sseConnections[sessionId]) {
        sseConnections[sessionId].send(
          {
            messageId: messageId,
            isDeleted: true,
          },
          "messageUpdate"
        );
      }

      res.status(200).json({
        success: true,
        message: "Message soft-deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * @route   POST /api/chat/:sessionId/messages/:messageId/restore
 * @desc    Restore a soft-deleted message
 * @access  Private
 */
router.post(
  "/:sessionId/messages/:messageId/restore",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, messageId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized: User ID required to restore messages",
        });
      }

      // First check if the session exists and user has access
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership/access rights
      if (session.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Access denied - Not your session" });
      }

      // 1. First update the message in the database
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (message.sessionId !== sessionId) {
        return res
          .status(400)
          .json({ error: "Message does not belong to this session" });
      }

      // Mark the message as not deleted
      message.isDeleted = false;
      await message.save();

      // 2. Update any related memories
      await Memory.updateMany(
        { "metadata.messageId": messageId },
        { isDeleted: false }
      );

      // 3. Update any related vector documents
      await VectorDocument.updateMany(
        { sourceId: messageId },
        { isDeleted: false }
      );

      // 4. Update the in-memory chat session
      const inMemoryUpdated = chatSessionManager.restoreMessage(
        sessionId,
        messageId
      );

      // 5. Send SSE update if connection exists
      if (sseConnections[sessionId]) {
        sseConnections[sessionId].send(
          {
            messageId: messageId,
            isDeleted: false,
          },
          "messageUpdate"
        );
      }

      res.status(200).json({
        success: true,
        message: "Message restored successfully",
      });
    } catch (error) {
      console.error("Error restoring message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * @route   PATCH /api/chat/sessions/:sessionId/status
 * @desc    Update session status (e.g., active, archived, favorite)
 * @access  Private (or Anonymous)
 */
router.patch(
  "/sessions/:sessionId/status",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { status } = req.body; // Expecting { status: "active" | "archived" | "favorite" }
      // Get user ID; must be present to modify session status
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized: User ID required to update session status",
        });
      }

      if (!status || !["active", "archived", "favorite"].includes(status)) {
        return res.status(400).json({ error: "Invalid status provided" });
      }

      // Verify session existence and access
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Remove anonymous/global session checks
      // const isGlobalSession = ...;
      // Add access control checks similar to other routes...
      if (session.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Access denied - Not your session" });
      }
      // if (userId === "anonymous" ...) { ... } // Remove this block
      // if (userId === "anonymous" ...) { ... } // Remove this block
      // Global session probably shouldn't be archived/favorited? // Remove comment

      // Update the session metadata
      const updatedSession = await sessionService.updateSessionMetadata(
        sessionId,
        { status }
      );

      if (!updatedSession) {
        // This might happen if the session disappeared between check and update
        return res
          .status(404)
          .json({ error: "Session not found during update" });
      }

      res.json(updatedSession); // Return updated session
    } catch (error) {
      console.error("Error updating session status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
