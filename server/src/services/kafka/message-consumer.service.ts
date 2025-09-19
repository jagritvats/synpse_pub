import { EachMessagePayload } from "kafkajs";import { v4 as uuidv4 } from "uuid";
import { loggerFactory } from "../../utils/logger.service";
import { enhancedChatService } from "../enhanced-chat.service";
import { sseConnections } from "../../controllers/chat.controller";
import {
  MessageRole,
  MessageStatus,
  ChatMessageModel,
} from "../../models/chat.model";
import {
  ChatMessageRequest,
  MessageSource,
  KafkaTopic,
  SummarizationRequest,
  ContextAnalysisRequest,
  MemoryOperationRequest,
  SessionOperationRequest,
  ActivityOperationRequest,
  ActionOperationRequest,
  OperationType,
} from "./message-producer.service";
import { telegramBotService } from "../telegram/telegram-bot.service";
import { summaryService } from "../summary.service";
import { companionThinkingService } from "../companion-thinking.service";
import { memoryService, MemoryType, MemoryCategory } from "../memory.service";
import { sessionService } from "../session.service";
import { activityService } from "../activity.service";
import { chatSessionManager } from "../chat-session.service";
import { kafkaService } from "./kafka.service";

const logger = loggerFactory.getLogger("MessageConsumerService");

/**
 * Service to consume and process message requests from Kafka
 */
class MessageConsumerService {
  private consumers: Record<string, boolean> = {};

  constructor() {
    logger.info("MessageConsumerService initialized");
  }

  /**
   * Start consuming messages from all configured topics
   */
  async startConsuming(): Promise<void> {
    try {
      await this.startChatConsumer();
      await this.startSummarizationConsumer();
      await this.startContextAnalysisConsumer();
      await this.startMemoryOperationsConsumer();
      await this.startSessionOperationsConsumer();
      await this.startActivityOperationsConsumer();
      await this.startActionOperationsConsumer();
    } catch (error) {
      logger.error(`Error starting consumers: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming chat message requests
   */
  async startChatConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.CHAT_MESSAGES]) {
      logger.warn(`Chat consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.CHAT_MESSAGES,
        "chat-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty chat message payload");
              return;
            }

            const request: ChatMessageRequest = JSON.parse(requestStr);
            logger.info(
              `Processing chat message request ${request.id} from ${request.source}`
            );

            await this.processChatMessage(request);
          } catch (error) {
            logger.error(`Error processing chat message: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.CHAT_MESSAGES] = true;
      logger.info(`Started consumer for ${KafkaTopic.CHAT_MESSAGES}`);
    } catch (error) {
      logger.error(`Failed to start chat consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming summarization requests
   */
  async startSummarizationConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.SUMMARIZATION]) {
      logger.warn(`Summarization consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.SUMMARIZATION,
        "summarization-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty summarization payload");
              return;
            }

            const request: SummarizationRequest = JSON.parse(requestStr);
            logger.info(
              `Processing summarization request ${request.id} for user ${request.userId}, session ${request.sessionId}`
            );

            await this.processSummarization(request);
          } catch (error) {
            logger.error(`Error processing summarization: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.SUMMARIZATION] = true;
      logger.info(`Started consumer for ${KafkaTopic.SUMMARIZATION}`);
    } catch (error) {
      logger.error(`Failed to start summarization consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming context analysis requests
   */
  async startContextAnalysisConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.CONTEXT_ANALYSIS]) {
      logger.warn(`Context analysis consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.CONTEXT_ANALYSIS,
        "context-analysis-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty context analysis payload");
              return;
            }

            const request: ContextAnalysisRequest = JSON.parse(requestStr);
            logger.info(
              `Processing context analysis request ${request.id} for user ${request.userId}, session ${request.sessionId}`
            );

            await this.processContextAnalysis(request);
          } catch (error) {
            logger.error(`Error processing context analysis: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.CONTEXT_ANALYSIS] = true;
      logger.info(`Started consumer for ${KafkaTopic.CONTEXT_ANALYSIS}`);
    } catch (error) {
      logger.error(`Failed to start context analysis consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming memory operations
   */
  async startMemoryOperationsConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.MEMORY_OPERATIONS]) {
      logger.warn(`Memory operations consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.MEMORY_OPERATIONS,
        "memory-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty memory operation payload");
              return;
            }

            const request: MemoryOperationRequest = JSON.parse(requestStr);
            logger.info(
              `Processing memory ${request.operation} operation ${request.id} for user ${request.userId}`
            );

            await this.processMemoryOperation(request);
          } catch (error) {
            logger.error(`Error processing memory operation: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.MEMORY_OPERATIONS] = true;
      logger.info(`Started consumer for ${KafkaTopic.MEMORY_OPERATIONS}`);
    } catch (error) {
      logger.error(`Failed to start memory operations consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming session operations
   */
  async startSessionOperationsConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.SESSION_OPERATIONS]) {
      logger.warn(`Session operations consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.SESSION_OPERATIONS,
        "session-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty session operation payload");
              return;
            }

            const request: SessionOperationRequest = JSON.parse(requestStr);
            logger.info(
              `Processing session ${request.operation} operation ${request.id} for user ${request.userId}`
            );

            await this.processSessionOperation(request);
          } catch (error) {
            logger.error(`Error processing session operation: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.SESSION_OPERATIONS] = true;
      logger.info(`Started consumer for ${KafkaTopic.SESSION_OPERATIONS}`);
    } catch (error) {
      logger.error(`Failed to start session operations consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming activity operations
   */
  async startActivityOperationsConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.ACTIVITY_OPERATIONS]) {
      logger.warn(`Activity operations consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.ACTIVITY_OPERATIONS,
        "activity-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty activity operation payload");
              return;
            }

            const request: ActivityOperationRequest = JSON.parse(requestStr);
            logger.info(
              `Processing activity ${request.operation} operation ${request.id} for user ${request.userId}, session ${request.sessionId}`
            );

            await this.processActivityOperation(request);
          } catch (error) {
            logger.error(`Error processing activity operation: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.ACTIVITY_OPERATIONS] = true;
      logger.info(`Started consumer for ${KafkaTopic.ACTIVITY_OPERATIONS}`);
    } catch (error) {
      logger.error(`Failed to start activity operations consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Start consuming action operations
   */
  async startActionOperationsConsumer(): Promise<void> {
    if (this.consumers[KafkaTopic.ACTION_OPERATIONS]) {
      logger.warn(`Action operations consumer already started`);
      return;
    }

    try {
      await kafkaService.consumeMessages(
        KafkaTopic.ACTION_OPERATIONS,
        "action-processor-group",
        async (payload: EachMessagePayload) => {
          try {
            const message = payload.message;
            const requestStr = message.value?.toString();

            if (!requestStr) {
              logger.warn("Received empty action operation payload");
              return;
            }

            const request: ActionOperationRequest = JSON.parse(requestStr);
            logger.info(
              `Processing action ${request.operation} operation ${request.id} for user ${request.userId}`
            );

            await this.processActionOperation(request);
          } catch (error) {
            logger.error(`Error processing action operation: ${error}`);
          }
        }
      );

      this.consumers[KafkaTopic.ACTION_OPERATIONS] = true;
      logger.info(`Started consumer for ${KafkaTopic.ACTION_OPERATIONS}`);
    } catch (error) {
      logger.error(`Failed to start action operations consumer: ${error}`);
      throw error;
    }
  }

  /**
   * Process a chat message request
   */
  private async processChatMessage(request: ChatMessageRequest): Promise<void> {
    try {
      const {
        userId,
        sessionId,
        messageText,
        source,
        clientMessageId,
        config,
      } = request;

      // Log the processing of the message
      logger.info(
        `Processing ${source} message for user ${userId} in session ${sessionId}: ${request.id}`
      );

      // Create a placeholder message first to show in the UI
      let messageId = clientMessageId;
      let sseConnection = sseConnections[sessionId];

      // Process based on source
      if (source === MessageSource.WEB_API) {
        // Process via enhanced chat service
        const processingResult = await enhancedChatService.processTextMessage(
          userId,
          sessionId,
          messageText,
          clientMessageId,
          config
        );

        messageId = processingResult.userMessage?.id || clientMessageId;
        logger.info(
          `Processed web message for user ${userId} in session ${sessionId}, messageId: ${messageId}`
        );

        // Report processing status to UI if SSE connection exists
        if (sseConnection) {
          sseConnection.send(
            {
              type: "message-processed",
              userId,
              sessionId,
              messageId: messageId,
              clientMessageId,
              status: "completed",
            },
            "status"
          );
        }
      } else if (source === MessageSource.API) {
        // Logic for mobile messages if needed
        // ...
        logger.info(
          `Processed API message for user ${userId} in session ${sessionId}`
        );
      } else {
        logger.warn(
          `Unsupported message source: ${source} for message: ${request.id}`
        );
      }

      // Now ensure thinking is triggered for this message regardless of source
      try {
        // Get chat history for the thinking service (limited to last few messages for context)
        const session = await sessionService.getSession(sessionId);
        if (session) {
          // Format recent messages for thinking processor
          const messages = session.messages || [];
          const recentMessages = messages
            .slice(-5) // Just use last 5 messages for context
            .map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

          // Trigger thinking process explicitly
          const thinkingResult = await companionThinkingService.processThinking(
            userId,
            sessionId,
            messageText,
            messageId || clientMessageId,
            recentMessages
          );

          logger.info(
            `Companion thinking triggered for message ${messageId || clientMessageId} in session ${sessionId}: ${thinkingResult ? "successful" : "failed/skipped"}`
          );
        }
      } catch (thinkingError) {
        // Don't let thinking errors affect message processing
        logger.error(`Error processing companion thinking: ${thinkingError}`);
      }
    } catch (error) {
      logger.error(
        `Error processing chat message: ${error instanceof Error ? error.message : String(error)}`
      );
      // Try to notify client of error
      try {
        const localSseConnection = sseConnections[request.sessionId];
        if (localSseConnection) {
          localSseConnection.send(
            {
              type: "error",
              message: "Failed to process message",
              details: error instanceof Error ? error.message : "Unknown error",
              clientMessageId: request.clientMessageId,
            },
            "error"
          );
        }
      } catch (sseError) {
        logger.error(`Error sending error notification to client: ${sseError}`);
      }
    }
  }

  /**
   * Process a summarization request
   */
  private async processSummarization(
    request: SummarizationRequest
  ): Promise<void> {
    try {
      const { userId, sessionId, synchronous, query } = request;

      logger.info(
        `Processing summarization for user ${userId}, session ${sessionId}`
      );

      // Generate the summary
      const summary = await summaryService.processSummaryGeneration(
        userId,
        sessionId,
        query || undefined
      );

      logger.info(
        `Completed summarization for user ${userId}, session ${sessionId}`
      );

      // If the request requires notifying clients, do that here via SSE
      if (request.metadata?.requiresResponse && sseConnections[sessionId]) {
        sseConnections[sessionId].send(
          {
            type: "summary",
            userId,
            sessionId,
            summary,
            requestId: request.id,
            timestamp: new Date().toISOString(),
          },
          "summary"
        );
        logger.info(`Sent summary SSE update for request ${request.id}`);
      }
    } catch (error) {
      logger.error(`Error processing summarization ${request.id}: ${error}`);
    }
  }

  /**
   * Process a context analysis request
   */
  private async processContextAnalysis(
    request: ContextAnalysisRequest
  ): Promise<void> {
    try {
      const { userId, sessionId, userInput, messageId, recentMessages } =
        request;

      logger.info(
        `Processing context analysis for user ${userId}, message ${messageId || "unknown"}`
      );

      // Process thinking via the companion thinking service
      const result = await companionThinkingService.doProcessThinking(
        userId,
        sessionId,
        userInput,
        messageId,
        recentMessages || []
      );

      logger.info(
        `Completed context analysis for user ${userId}, session ${sessionId}, result: ${result ? "success" : "failure"}`
      );
    } catch (error) {
      logger.error(`Error processing context analysis ${request.id}: ${error}`);
    }
  }

  /**
   * Process a memory operation
   */
  private async processMemoryOperation(
    request: MemoryOperationRequest
  ): Promise<void> {
    try {
      const { userId, operation } = request;

      logger.info(`Processing memory ${operation} for user ${userId}`);

      switch (operation) {
        case OperationType.CREATE:
          if (!request.text) {
            logger.error(`Missing text for memory creation ${request.id}`);
            return;
          }

          await memoryService.addMemory(
            userId,
            request.text,
            request.type || MemoryType.MEDIUM_TERM,
            request.source || "kafka-service",
            request.metadata || {},
            request.importance || 5,
            request.category || MemoryCategory.FACT
          );
          logger.info(`Created memory for user ${userId}`);
          break;

        case OperationType.UPDATE:
          if (!request.memoryId) {
            logger.error(`Missing memoryId for memory update ${request.id}`);
            return;
          }

          const updates: any = {};
          if (request.text) updates.text = request.text;
          if (request.importance) updates.importance = request.importance;
          if (request.metadata) updates.metadata = { ...request.metadata };

          await memoryService.updateMemory(request.memoryId, updates);
          logger.info(`Updated memory ${request.memoryId} for user ${userId}`);
          break;

        case OperationType.DELETE:
          if (!request.memoryId) {
            logger.error(`Missing memoryId for memory deletion ${request.id}`);
            return;
          }

          await memoryService.softDeleteMemory(request.memoryId);
          logger.info(`Deleted memory ${request.memoryId} for user ${userId}`);
          break;

        case OperationType.QUERY:
          // Handle query operations - results would normally be returned via SSE or callback
          logger.info(`Memory query operation not implemented via Kafka`);
          break;

        default:
          logger.warn(`Unsupported memory operation: ${operation}`);
      }
    } catch (error) {
      logger.error(`Error processing memory operation ${request.id}: ${error}`);
    }
  }

  /**
   * Process a session operation
   */
  private async processSessionOperation(
    request: SessionOperationRequest
  ): Promise<void> {
    try {
      const { userId, operation } = request;

      logger.info(`Processing session ${operation} for user ${userId}`);

      switch (operation) {
        case OperationType.CREATE:
          const newSession = await sessionService.createSession(
            userId,
            request.metadata || { title: "New Session" }
          );

          if (newSession) {
            logger.info(
              `Created new session ${newSession._id} for user ${userId}`
            );

            // Notify the client if needed
            if (sseConnections[userId]) {
              sseConnections[userId].send(
                {
                  type: "sessionCreated",
                  sessionId: newSession._id,
                  session: newSession,
                },
                "sessionUpdate"
              );
            }
          }
          break;

        case OperationType.UPDATE:
          if (!request.sessionId) {
            logger.error(`Missing sessionId for session update ${request.id}`);
            return;
          }

          await sessionService.updateSession(
            request.sessionId,
            request.metadata
          );
          logger.info(
            `Updated session ${request.sessionId} for user ${userId}`
          );
          break;

        case OperationType.DELETE:
          if (!request.sessionId) {
            logger.error(
              `Missing sessionId for session deletion ${request.id}`
            );
            return;
          }

          await sessionService.deleteSession(request.sessionId);
          logger.info(
            `Deleted session ${request.sessionId} for user ${userId}`
          );
          break;

        default:
          logger.warn(`Unsupported session operation: ${operation}`);
      }
    } catch (error) {
      logger.error(
        `Error processing session operation ${request.id}: ${error}`
      );
    }
  }

  /**
   * Process an activity operation
   */
  private async processActivityOperation(
    request: ActivityOperationRequest
  ): Promise<void> {
    try {
      const { userId, sessionId, operation } = request;

      logger.info(
        `Processing activity ${operation} for user ${userId}, session ${sessionId}`
      );

      switch (operation) {
        case OperationType.CREATE:
          if (!request.activityType || !request.activityName) {
            logger.error(
              `Missing activityType or activityName for activity creation ${request.id}`
            );
            return;
          }

          const activity = await activityService.startActivity(
            userId,
            sessionId,
            request.activityType as any,
            request.activityName,
            request.stateData || {},
            request.metadata || {}
          );

          logger.info(
            `Created activity ${activity._id} of type ${request.activityType} for user ${userId}`
          );
          break;

        case OperationType.UPDATE:
          if (!request.activityId) {
            logger.error(
              `Missing activityId for activity update ${request.id}`
            );
            return;
          }

          await activityService.updateActivityState(
            request.activityId,
            request.stateData,
            request.metadata,
            request.messageText
          );

          logger.info(
            `Updated activity ${request.activityId} for user ${userId}`
          );
          break;

        case OperationType.DELETE:
          if (!request.activityId) {
            logger.error(
              `Missing activityId for activity deletion ${request.id}`
            );
            return;
          }

          await activityService.endActivity(request.activityId);
          logger.info(
            `Ended activity ${request.activityId} for user ${userId}`
          );
          break;

        case OperationType.PROCESS:
          if (!request.activityId && !request.messageText) {
            logger.error(
              `Missing required data for activity message processing ${request.id}`
            );
            return;
          }

          // If no activityId but messageText is provided, try to process as activity command
          if (!request.activityId && request.messageText) {
            const result = await activityService.processActivityCommand(
              userId,
              sessionId,
              request.messageText,
              request.messageId
            );

            if (result.handled) {
              logger.info(
                `Processed activity command for user ${userId}, result: ${result.activityId || "no activity"}`
              );
            }
          }
          // If activityId and messageId are provided, add message to activity
          else if (request.activityId && request.messageId) {
            await activityService.addMessageToActivity(
              request.activityId,
              request.messageId,
              request.messageText
            );
            logger.info(
              `Added message ${request.messageId} to activity ${request.activityId}`
            );
          }
          break;

        default:
          logger.warn(`Unsupported activity operation: ${operation}`);
      }
    } catch (error) {
      logger.error(
        `Error processing activity operation ${request.id}: ${error}`
      );
    }
  }

  /**
   * Process an action operation
   */
  private async processActionOperation(
    request: ActionOperationRequest
  ): Promise<void> {
    try {
      const { userId, operation } = request;

      logger.info(`Processing action ${operation} for user ${userId}`);

      // Placeholder for action service implementation
      // This should be implemented with your specific action service
      switch (operation) {
        case OperationType.PROCESS:
          if (!request.actionName) {
            logger.error(
              `Missing actionName for action processing ${request.id}`
            );
            return;
          }

          logger.info(
            `Would process action ${request.actionName} with params: ${JSON.stringify(request.actionParams || {})}`
          );
          // Implementation would go here once action service is available
          break;

        default:
          logger.warn(`Unsupported action operation: ${operation}`);
      }
    } catch (error) {
      logger.error(`Error processing action operation ${request.id}: ${error}`);
    }
  }
}

export const messageConsumerService = new MessageConsumerService();
