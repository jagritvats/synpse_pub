import { v4 as uuidv4 } from "uuid";import { loggerFactory } from "../../utils/logger.service";
import { ChatConfig } from "../../models/chat.model";
import { kafkaService } from "./kafka.service";
import { MemoryType, MemoryCategory } from "../memory.service";
import { IActivity } from "../../models/activity.model";
import { tracingService } from "../tracing.service";
import { enhancedChatService } from "../enhanced-chat.service";

// Import any operation type definitions
import {
  IMessageOperation,
  IMemoryOperation,
  ISessionOperation,
  IActivityOperation,
  IActionOperation,
  ISummarizationOperation,
  IContextAnalysisOperation,
} from "../../interfaces/kafka-operations";

// Type for all possible operation types
type Operation =
  | IMessageOperation
  | IMemoryOperation
  | ISessionOperation
  | IActivityOperation
  | IActionOperation
  | ISummarizationOperation
  | IContextAnalysisOperation;

const logger = loggerFactory.getLogger("MessageProducerService");

// Define message source types
export enum MessageSource {
  WEB_API = "WEB_API",
  TELEGRAM = "TELEGRAM",
  OTHER = "OTHER",
}

// Define operation types for generalized requests
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  QUERY = "query",
  PROCESS = "process",
}

// Define message request structure
export interface ChatMessageRequest {
  id: string;
  userId: string;
  sessionId: string;
  messageText: string;
  clientMessageId?: string;
  config?: ChatConfig;
  source: MessageSource;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Define summarization request structure
export interface SummarizationRequest {
  id: string;
  userId: string;
  sessionId: string;
  query?: string;
  synchronous: boolean;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Define context analysis request structure
export interface ContextAnalysisRequest {
  id: string;
  userId: string;
  sessionId: string;
  userInput: string;
  messageId?: string;
  recentMessages?: Array<{ role: string; content: string }>;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Define memory operation request structure
export interface MemoryOperationRequest {
  id: string;
  operation: OperationType;
  userId: string;
  memoryId?: string;
  text?: string;
  type?: MemoryType;
  source?: string;
  importance?: number;
  category?: MemoryCategory;
  metadata?: Record<string, any>;
  query?: string;
  timestamp: string;
}

// Define session operation request structure
export interface SessionOperationRequest {
  id: string;
  operation: OperationType;
  userId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Define activity operation request structure
export interface ActivityOperationRequest {
  id: string;
  operation: OperationType;
  userId: string;
  sessionId: string;
  activityId?: string;
  activityType?: string;
  activityName?: string;
  stateData?: any;
  metadata?: Record<string, any>;
  messageId?: string;
  messageText?: string;
  timestamp: string;
}

// Define action operation request structure
export interface ActionOperationRequest {
  id: string;
  operation: OperationType;
  userId: string;
  sessionId?: string;
  actionId?: string;
  actionName?: string;
  actionParams?: any;
  confidence?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Define Kafka topics
export enum KafkaTopic {
  CHAT_MESSAGES = "chat-message-requests",
  SUMMARIZATION = "summarization-requests",
  CONTEXT_ANALYSIS = "context-analysis-requests",
  MEMORY_OPERATIONS = "memory-operations",
  SESSION_OPERATIONS = "session-operations",
  ACTIVITY_OPERATIONS = "activity-operations",
  ACTION_OPERATIONS = "action-operations",
}

// Map of topics for different operation types
const TOPIC_MAP = {
  // Chat message operations
  "chat.message.create": "chat-message-requests",
  "chat.message.update": "chat-message-requests",
  "chat.message.delete": "chat-message-requests",

  // Memory operations
  "memory.create": "memory-operations",
  "memory.update": "memory-operations",
  "memory.delete": "memory-operations",
  "memory.query": "memory-operations",

  // Session operations
  "session.create": "session-operations",
  "session.update": "session-operations",
  "session.delete": "session-operations",
  "session.query": "session-operations",

  // Activity operations
  "activity.create": "activity-operations",
  "activity.update": "activity-operations",
  "activity.end": "activity-operations",

  // Action operations
  "action.execute": "action-operations",
  "action.complete": "action-operations",

  // Summarization operations
  "summarization.generate": "summarization-requests",
  "summarization.update": "summarization-requests",

  // Context analysis operations
  "context.analyze": "context-analysis-requests",
  "context.evaluate": "context-analysis-requests",
};

// Operation type to topic mapping for TypeScript type safety
type OperationTypeToTopic = {
  [K in keyof typeof TOPIC_MAP]: string;
};

// Max operation size in bytes
const MAX_OPERATION_SIZE = 1024 * 1024; // 1MB

// Map flow types to their specific environment configuration variables
const KAFKA_CONFIG_MAP = {
  // Service-level flows
  chat_messages: "KAFKA_CHAT_MESSAGES",
  summarization: "KAFKA_SUMMARIZATION",
  context_analysis: "KAFKA_CONTEXT_ANALYSIS",
  memory_operations: "KAFKA_MEMORY_OPERATIONS",
  session_operations: "KAFKA_SESSION_OPERATIONS",
  activity_operations: "KAFKA_ACTIVITY_OPERATIONS",
  action_operations: "KAFKA_ACTION_OPERATIONS",

  // Topic-to-config mapping for operation types
  "chat-message-requests": "KAFKA_CHAT_MESSAGES",
  "summarization-requests": "KAFKA_SUMMARIZATION",
  "context-analysis-requests": "KAFKA_CONTEXT_ANALYSIS",
  "memory-operations": "KAFKA_MEMORY_OPERATIONS",
  "session-operations": "KAFKA_SESSION_OPERATIONS",
  "activity-operations": "KAFKA_ACTIVITY_OPERATIONS",
  "action-operations": "KAFKA_ACTION_OPERATIONS",
};

/**
 * Service for producing messages to Kafka topics
 */
class MessageProducerService {
  private flowConfigs: Map<string, boolean> = new Map();
  private globalKafkaEnabled: boolean = true;

  constructor() {
    logger.info("MessageProducerService initialized");

    // Initialize flow configurations
    this.initializeFlowConfigs();
  }

  /**
   * Initialize the flow configurations from environment variables
   */
  private initializeFlowConfigs(): void {
    // Check global Kafka enablement (the main flag that affects all)
    this.globalKafkaEnabled = process.env.ENABLE_KAFKA !== "false";

    // Initialize flow-specific configurations
    Object.entries(KAFKA_CONFIG_MAP).forEach(([flowKey, envVar]) => {
      if (flowKey.includes("-")) return; // Skip the topic mappings

      // Get env var value, default to the global setting if not specified
      const isEnabled =
        process.env[envVar] !== undefined
          ? process.env[envVar]?.toLowerCase() === "true"
          : this.globalKafkaEnabled;

      this.flowConfigs.set(flowKey, isEnabled);

      logger.info(
        `Kafka flow '${flowKey}' ${isEnabled ? "enabled" : "disabled"} (${envVar}=${process.env[envVar] || "unset"})`
      );
    });
  }

  /**
   * Check if a specific flow is enabled
   * @param flowKey The flow key to check
   * @returns True if the flow is enabled, false otherwise
   */
  isFlowEnabled(flowKey: string): boolean {
    // If directly defined in flowConfigs, use that
    if (this.flowConfigs.has(flowKey)) {
      return this.flowConfigs.get(flowKey) || false;
    }

    // Otherwise, use the global setting
    return this.globalKafkaEnabled;
  }

  /**
   * Check if Kafka processing is enabled for a specific topic
   * @param topic The Kafka topic
   * @returns True if Kafka is enabled for this topic, false otherwise
   */
  isTopicEnabled(topic: string): boolean {
    // Map the topic to its configuration key
    const configKey = KAFKA_CONFIG_MAP[topic as keyof typeof KAFKA_CONFIG_MAP];

    // If we have a specific config for this topic, use it
    if (configKey && this.flowConfigs.has(configKey)) {
      return this.flowConfigs.get(configKey) || false;
    }

    // Otherwise, use the global setting
    return this.globalKafkaEnabled;
  }

  /**
   * Check if a specific operation type is enabled for Kafka processing
   * @param operationType The operation type (e.g., "chat.message.create")
   * @returns True if Kafka is enabled for this operation type, false otherwise
   */
  isOperationEnabled(operationType: string): boolean {
    // Map the operation type to its topic
    const topic = (TOPIC_MAP as OperationTypeToTopic)[operationType];

    // If we have a topic, check if it's enabled
    if (topic) {
      return this.isTopicEnabled(topic);
    }

    // Otherwise, use the global setting
    return this.globalKafkaEnabled;
  }

  /**
   * Queue an operation to be processed asynchronously
   * @param operation The operation to queue
   * @param parentContext Optional parent trace context
   * @returns Promise resolving to the operation ID if successful
   */
  async queueOperation(
    operation: Operation,
    parentContext?: any
  ): Promise<string> {
    if (!operation.id) {
      operation.id = uuidv4();
    }

    if (!operation.timestamp) {
      operation.timestamp = Date.now();
    }

    const operationType = operation.type;
    const topic = (TOPIC_MAP as OperationTypeToTopic)[operationType];

    if (!topic) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    // Check if this operation/topic is enabled for Kafka processing
    const useKafka = this.isTopicEnabled(topic) && kafkaService.isEnabled();

    // Start a trace span for this operation
    const { span, context } = tracingService.startSpan(
      parentContext,
      `kafka_produce_${operationType}`,
      {
        topic,
        operationId: operation.id,
        operationType: operationType,
        useKafka, // Add whether we're using Kafka to the trace
      }
    );

    try {
      // Add span context to the operation
      const operationWithTrace = tracingService.injectContext(
        context,
        operation
      );

      // Validate the operation size
      const operationSize = JSON.stringify(operationWithTrace).length;
      if (operationSize > MAX_OPERATION_SIZE) {
        throw new Error(
          `Operation size (${operationSize} bytes) exceeds maximum allowed size (${MAX_OPERATION_SIZE} bytes)`
        );
      }

      // Log the operation being queued
      logger.debug(
        `Queuing operation ${operation.id} of type ${operationType}`,
        {
          traceId: context.traceId,
          spanId: context.spanId,
          operationId: operation.id,
          useKafka, // Include whether we're using Kafka in the log
        }
      );

      // Send to Kafka if enabled, otherwise process synchronously
      if (useKafka) {
        try {
          // Get the producer and ensure it's connected
          const producer = await kafkaService.getProducer();

          logger.debug(
            `Sending operation ${operation.id} to Kafka topic ${topic}`
          );

          // Send the message to Kafka
          await producer.send({
            topic,
            messages: [
              {
                key: this._getMessageKey(operation),
                value: JSON.stringify(operationWithTrace),
                headers: {
                  "trace-id": context.traceId,
                  "span-id": context.spanId,
                  "operation-type": operationType,
                },
              },
            ],
          });

          logger.debug(
            `Operation ${operation.id} queued successfully to topic ${topic}`,
            {
              traceId: context.traceId,
              spanId: context.spanId,
            }
          );

          // End the trace span successfully
          tracingService.endSpan(span.context.spanId);

          return operation.id;
        } catch (kafkaError) {
          // Add error to the span
          tracingService.setSpanTag(span.context.spanId, "kafka_error", true);

          const errorMessage =
            kafkaError instanceof Error
              ? kafkaError.message
              : String(kafkaError);
          logger.error(
            `Kafka error sending operation ${operation.id} to topic ${topic}: ${errorMessage}`,
            kafkaError,
            {
              traceId: context.traceId,
              spanId: context.spanId,
            }
          );

          // Rethrow to be handled by the outer catch
          throw kafkaError;
        }
      } else {
        // Add fallback info to the span
        tracingService.setSpanTag(span.context.spanId, "kafka_fallback", true);
        logger.warn(
          `Kafka is disabled for flow ${topic}, fallback to synchronous processing for ${operationType}`,
          {
            traceId: context.traceId,
            spanId: context.spanId,
            operationId: operation.id,
          }
        );

        // Process synchronously - this should be implemented by application code
        // End the trace span with note about sync processing
        tracingService.endSpan(span.context.spanId);

        // Return the operation ID
        return operation.id;
      }
    } catch (error) {
      // End the trace span with error
      tracingService.endSpan(span.context.spanId, error as Error);

      // Log the error and rethrow
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to queue operation ${operation.id} of type ${operationType}: ${errorMessage}`,
        error,
        {
          traceId: context.traceId,
          spanId: context.spanId,
        }
      );
      throw error;
    }
  }

  /**
   * Get the message key for an operation
   * @param operation The operation
   * @returns The message key
   */
  private _getMessageKey(operation: Operation): string {
    // Use the most appropriate key for the operation type
    if ("userId" in operation && operation.userId) {
      return `user-${operation.userId}`;
    } else if ("sessionId" in operation && operation.sessionId) {
      return `session-${operation.sessionId}`;
    } else if ("id" in operation && operation.id) {
      return `op-${operation.id}`;
    } else {
      return uuidv4();
    }
  }

  /**
   * Queue a chat message for async processing
   */
  async queueChatMessage(
    userId: string,
    messageText: string,
    sessionId: string,
    source: MessageSource,
    clientMessageId?: string,
    config?: ChatConfig,
    metadata?: Record<string, any>
  ): Promise<string> {
    // Check if chat messages should use Kafka
    const useKafka =
      this.isFlowEnabled("chat_messages") && kafkaService.isEnabled();

    const requestId = uuidv4();
    logger.debug(
      `Creating chat message request ${requestId} for user ${userId} in session ${sessionId} (useKafka: ${useKafka})`
    );

    const messageRequest = {
      id: requestId,
      userId,
      sessionId,
      messageText,
      clientMessageId,
      config,
      source,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // If Kafka is disabled for chat messages or the global Kafka service is disabled,
    // process the message synchronously
    if (!useKafka) {
      logger.info(
        `Processing chat message synchronously (Kafka disabled for chat messages)`
      );

      // Call the enhanced chat service directly for synchronous processing
      try {
        // This would typically be implemented in the consumer side
        // We need to get the session and process the message directly
        const result = await enhancedChatService.processTextMessage(
          userId,
          sessionId,
          messageText,
          clientMessageId,
          config
        );

        return result.messageId || requestId;
      } catch (error) {
        logger.error(
          `Error during synchronous chat message processing:`,
          error
        );
        throw error;
      }
    }

    // Produce the message to Kafka
    try {
      logger.debug(
        `Attempting to queue message to Kafka for user ${userId} in session ${sessionId}`
      );

      // Ensure Kafka producer is ready
      const producer = await kafkaService.getProducer();

      await this.queueOperation({
        ...messageRequest,
        type: "chat.message.create",
        messageId: clientMessageId || requestId, // Ensure we have a messageId for IMessageOperation
      } as IMessageOperation);

      logger.info(
        `Message successfully queued to Kafka for ${source} user ${userId} in session ${sessionId}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to queue chat message to Kafka: ${errorMessage}`,
        error
      );

      // Fall back to synchronous processing if Kafka queue fails
      logger.info(
        `Falling back to synchronous processing after Kafka queue failure`
      );

      try {
        const result = await enhancedChatService.processTextMessage(
          userId,
          sessionId,
          messageText,
          clientMessageId,
          config
        );

        logger.info(
          `Successfully processed message synchronously after Kafka failure: ${requestId}`
        );
        return result.messageId || requestId;
      } catch (syncError) {
        const syncErrorMessage =
          syncError instanceof Error ? syncError.message : String(syncError);
        logger.error(
          `Error during fallback synchronous processing: ${syncErrorMessage}`,
          syncError
        );
        throw new Error(
          `Failed to process message after Kafka queue failure: ${syncErrorMessage}`
        );
      }
    }
  }

  /**
   * Queue a summarization request
   */
  async queueSummarization(
    userId: string,
    sessionId: string,
    synchronous: boolean = false,
    query?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    // Check if summarization should use Kafka
    const useKafka = this.isFlowEnabled("summarization") && !synchronous;

    const requestId = uuidv4();
    logger.debug(
      `Creating summarization request ${requestId} for user ${userId} in session ${sessionId} (useKafka: ${useKafka})`
    );

    const summRequest: SummarizationRequest = {
      id: requestId,
      userId,
      sessionId,
      query,
      synchronous,
      metadata,
      timestamp: new Date().toISOString(),
    };

    if (!useKafka) {
      logger.info(
        `Processing summarization request synchronously (Kafka disabled or synchronous mode requested)`
      );
      // Call the summary service directly for synchronous processing
      try {
        // This is just an example, your actual service call may differ
        const summary = await summaryService.generateUserSummary(
          userId,
          sessionId,
          false // Not async
        );

        // Return the request ID, the actual summary result would be stored in your DB
        // or returned through other means
        return requestId;
      } catch (error) {
        logger.error(
          `Error during synchronous summarization processing:`,
          error as Error
        );
        throw error;
      }
    }

    // Produce the message to Kafka
    try {
      await this.queueOperation({
        ...summRequest,
        type: "summarization.generate",
      } as ISummarizationOperation);

      logger.info(
        `Summarization request queued for user ${userId} in session ${sessionId}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      logger.error(`Failed to queue summarization to Kafka:`, error as Error);

      // Fall back to synchronous processing if Kafka queue fails
      logger.info(
        `Falling back to synchronous summarization after Kafka queue failure`
      );

      try {
        const summary = await summaryService.generateUserSummary(
          userId,
          sessionId,
          false // Not async
        );

        return requestId;
      } catch (syncError) {
        logger.error(
          `Error during fallback synchronous summarization:`,
          syncError as Error
        );
        throw syncError;
      }
    }
  }

  /**
   * Queue a context analysis request
   */
  async queueContextAnalysis(
    userId: string,
    sessionId: string,
    userInput: string,
    messageId?: string,
    recentMessages?: Array<{ role: string; content: string }>,
    metadata?: Record<string, any>
  ): Promise<string> {
    // Check if context analysis should use Kafka
    const useKafka = this.isFlowEnabled("context_analysis");

    const requestId = uuidv4();
    logger.debug(
      `Creating context analysis request ${requestId} for user ${userId} in session ${sessionId} (useKafka: ${useKafka})`
    );

    const analysisRequest: ContextAnalysisRequest = {
      id: requestId,
      userId,
      sessionId,
      userInput,
      messageId,
      recentMessages,
      metadata,
      timestamp: new Date().toISOString(),
    };

    if (!useKafka) {
      logger.info(
        `Processing context analysis request synchronously (Kafka disabled for context analysis)`
      );
      // Call the companion thinking service directly for synchronous processing
      try {
        // This is just an example, your actual service call may differ
        const result = await companionThinkingService.processAndInjectThinking(
          userId,
          sessionId,
          userInput,
          messageId,
          recentMessages
        );

        return requestId;
      } catch (error) {
        logger.error(
          `Error during synchronous context analysis processing:`,
          error as Error
        );
        throw error;
      }
    }

    // Produce the message to Kafka
    try {
      await this.queueOperation({
        ...analysisRequest,
        type: "context.analyze",
        messageText: userInput, // Ensure we have the required messageText for IContextAnalysisOperation
      } as IContextAnalysisOperation);

      logger.info(
        `Context analysis request queued for user ${userId} in session ${sessionId}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      logger.error(
        `Failed to queue context analysis to Kafka:`,
        error as Error
      );

      // Fall back to synchronous processing if Kafka queue fails
      logger.info(
        `Falling back to synchronous context analysis after Kafka queue failure`
      );

      try {
        const result = await companionThinkingService.processAndInjectThinking(
          userId,
          sessionId,
          userInput,
          messageId,
          recentMessages
        );

        return requestId;
      } catch (syncError) {
        logger.error(
          `Error during fallback synchronous context analysis:`,
          syncError as Error
        );
        throw syncError;
      }
    }
  }

  /**
   * Queue a memory operation
   */
  async queueMemoryOperation(
    operation: OperationType,
    userId: string,
    options: {
      memoryId?: string;
      text?: string;
      type?: MemoryType;
      source?: string;
      importance?: number;
      category?: MemoryCategory;
      metadata?: Record<string, any>;
      query?: string;
    }
  ): Promise<string> {
    // Check if memory operations should use Kafka
    const useKafka = this.isFlowEnabled("memory_operations");

    const requestId = uuidv4();
    logger.debug(
      `Creating memory ${operation} request ${requestId} for user ${userId} (useKafka: ${useKafka})`
    );

    const memoryRequest: MemoryOperationRequest = {
      id: requestId,
      operation,
      userId,
      memoryId: options.memoryId,
      text: options.text,
      type: options.type,
      source: options.source,
      importance: options.importance,
      category: options.category,
      metadata: options.metadata,
      query: options.query,
      timestamp: new Date().toISOString(),
    };

    if (!useKafka) {
      logger.info(
        `Processing memory ${operation} synchronously (Kafka disabled for memory operations)`
      );

      // Call the memory service directly based on the operation type
      try {
        switch (operation) {
          case OperationType.CREATE:
            if (!options.text) {
              throw new Error("Text is required for memory creation");
            }

            await memoryService.addMemory(
              userId,
              options.text,
              options.type || MemoryType.MEDIUM_TERM,
              options.source || "user",
              options.metadata || {},
              options.importance || 5,
              options.category || MemoryCategory.FACT
            );
            break;

          case OperationType.UPDATE:
            if (!options.memoryId) {
              throw new Error("Memory ID is required for update");
            }

            await memoryService.updateMemory(options.memoryId, {
              text: options.text,
              type: options.type,
              importance: options.importance,
              category: options.category,
              metadata: options.metadata,
            });
            break;

          case OperationType.DELETE:
            if (!options.memoryId) {
              throw new Error("Memory ID is required for delete");
            }

            await memoryService.softDeleteMemory(options.memoryId);
            break;

          case OperationType.QUERY:
            if (!options.query) {
              throw new Error("Query is required for memory search");
            }

            await memoryService.getRelevantMemories(
              userId,
              options.query,
              10, // Default limit
              options.metadata as any // Cast to the expected options type
            );
            break;

          default:
            throw new Error(`Unsupported memory operation: ${operation}`);
        }

        logger.info(
          `Memory ${operation} operation processed synchronously for user ${userId}`
        );
        return requestId;
      } catch (error) {
        logger.error(
          `Error during synchronous memory ${operation} processing:`,
          error as Error
        );
        throw error;
      }
    }

    // Produce the message to Kafka
    try {
      await this.queueOperation({
        ...memoryRequest,
        type: `memory.${operation}` as MemoryOperationType,
      } as IMemoryOperation);

      logger.info(
        `Memory ${operation} operation queued for user ${userId}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      logger.error(
        `Failed to queue memory operation to Kafka:`,
        error as Error
      );

      // Fall back to synchronous processing if Kafka queue fails
      logger.info(
        `Falling back to synchronous memory processing after Kafka queue failure`
      );

      // Reuse the synchronous processing code from above, but condensed to avoid duplication
      try {
        switch (operation) {
          case OperationType.CREATE:
            if (options.text) {
              await memoryService.addMemory(
                userId,
                options.text,
                options.type,
                options.source,
                options.metadata,
                options.importance,
                options.category
              );
            }
            break;
          case OperationType.UPDATE:
            if (options.memoryId) {
              await memoryService.updateMemory(options.memoryId, {
                text: options.text,
                type: options.type,
                importance: options.importance,
                category: options.category,
                metadata: options.metadata,
              });
            }
            break;
          case OperationType.DELETE:
            if (options.memoryId) {
              await memoryService.softDeleteMemory(options.memoryId);
            }
            break;
          case OperationType.QUERY:
            if (options.query) {
              await memoryService.getRelevantMemories(
                userId,
                options.query,
                10,
                options.metadata as any
              );
            }
            break;
        }

        return requestId;
      } catch (syncError) {
        logger.error(
          `Error during fallback synchronous memory processing:`,
          syncError as Error
        );
        throw syncError;
      }
    }
  }

  /**
   * Queue a session operation for asynchronous processing
   */
  async queueSessionOperation(
    operation: OperationType,
    userId: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Generate a unique request ID
      const requestId = uuidv4();

      // Create the session operation request
      const sessionRequest: SessionOperationRequest = {
        id: requestId,
        operation,
        userId,
        sessionId,
        metadata,
        timestamp: new Date().toISOString(),
      };

      // Produce the message to Kafka
      await this.queueOperation(sessionRequest as ISessionOperation);

      logger.info(
        `Session ${operation} operation queued for user ${userId}${sessionId ? `, session ${sessionId}` : ""}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      logger.error(`Error queueing session operation: ${error}`);
      throw new Error(`Failed to queue session operation: ${error}`);
    }
  }

  /**
   * Queue an activity operation for asynchronous processing
   */
  async queueActivityOperation(
    operation: OperationType,
    userId: string,
    sessionId: string,
    options: {
      activityId?: string;
      activityType?: string;
      activityName?: string;
      stateData?: any;
      metadata?: Record<string, any>;
      messageId?: string;
      messageText?: string;
    }
  ): Promise<string> {
    try {
      // Generate a unique request ID
      const requestId = uuidv4();

      // Create the activity operation request
      const activityRequest: ActivityOperationRequest = {
        id: requestId,
        operation,
        userId,
        sessionId,
        ...options,
        timestamp: new Date().toISOString(),
      };

      // Produce the message to Kafka
      await this.queueOperation(activityRequest as IActivityOperation);

      logger.info(
        `Activity ${operation} operation queued for user ${userId}, session ${sessionId}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      logger.error(`Error queueing activity operation: ${error}`);
      throw new Error(`Failed to queue activity operation: ${error}`);
    }
  }

  /**
   * Queue an action operation for asynchronous processing
   */
  async queueActionOperation(
    operation: OperationType,
    userId: string,
    options: {
      sessionId?: string;
      actionId?: string;
      actionName?: string;
      actionParams?: any;
      confidence?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      // Generate a unique request ID
      const requestId = uuidv4();

      // Create the action operation request
      const actionRequest: ActionOperationRequest = {
        id: requestId,
        operation,
        userId,
        ...options,
        timestamp: new Date().toISOString(),
      };

      // Produce the message to Kafka
      await this.queueOperation(actionRequest as IActionOperation);

      logger.info(
        `Action ${operation} operation queued for user ${userId}, session ${sessionId}: ${requestId}`
      );
      return requestId;
    } catch (error) {
      logger.error(`Error queueing action operation: ${error}`);
      throw new Error(`Failed to queue action operation: ${error}`);
    }
  }
}

// Export a singleton instance
export const messageProducerService = new MessageProducerService();
