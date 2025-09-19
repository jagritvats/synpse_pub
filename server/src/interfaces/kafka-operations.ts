/** * Base interface for all Kafka operations
 */
export interface IBaseOperation {
  id: string;
  type: string;
  timestamp: number;
  traceContext?: any; // Will contain tracing information
}

/**
 * Chat message operation types
 */
export type MessageOperationType =
  | "chat.message.create"
  | "chat.message.update"
  | "chat.message.delete";

/**
 * Interface for chat message operations
 */
export interface IMessageOperation extends IBaseOperation {
  type: MessageOperationType;
  userId: string;
  sessionId: string;
  messageId: string;
  messageText?: string;
  messageRole?: "user" | "assistant" | "system";
  metadata?: Record<string, any>;
  clientMessageId?: string;
  activityId?: string;
  config?: Record<string, any>;
}

/**
 * Memory operation types
 */
export type MemoryOperationType =
  | "memory.create"
  | "memory.update"
  | "memory.delete"
  | "memory.query";

/**
 * Interface for memory operations
 */
export interface IMemoryOperation extends IBaseOperation {
  type: MemoryOperationType;
  userId: string;
  memoryId?: string;
  category?: string;
  memoryType?: string;
  content?: string;
  importance?: number;
  metadata?: Record<string, any>;
  query?: string;
  limit?: number;
  filter?: Record<string, any>;
}

/**
 * Session operation types
 */
export type SessionOperationType =
  | "session.create"
  | "session.update"
  | "session.delete"
  | "session.query";

/**
 * Interface for session operations
 */
export interface ISessionOperation extends IBaseOperation {
  type: SessionOperationType;
  userId: string;
  sessionId?: string;
  title?: string;
  metadata?: Record<string, any>;
  isGlobal?: boolean;
  isArchived?: boolean;
}

/**
 * Activity operation types
 */
export type ActivityOperationType =
  | "activity.create"
  | "activity.update"
  | "activity.end";

/**
 * Interface for activity operations
 */
export interface IActivityOperation extends IBaseOperation {
  type: ActivityOperationType;
  userId: string;
  sessionId: string;
  activityId?: string;
  activityType?: string;
  activityName?: string;
  state?: Record<string, any>;
  metadata?: Record<string, any>;
  goal?: string;
  messageId?: string;
}

/**
 * Action operation types
 */
export type ActionOperationType = "action.execute" | "action.complete";

/**
 * Interface for action operations
 */
export interface IActionOperation extends IBaseOperation {
  type: ActionOperationType;
  userId: string;
  sessionId: string;
  actionId: string;
  actionType: string;
  parameters?: Record<string, any>;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Summarization operation types
 */
export type SummarizationOperationType =
  | "summarization.generate"
  | "summarization.update";

/**
 * Interface for summarization operations
 */
export interface ISummarizationOperation extends IBaseOperation {
  type: SummarizationOperationType;
  userId: string;
  sessionId?: string;
  messages?: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  existingSummary?: string;
  options?: {
    maxTokens?: number;
    extractTraits?: boolean;
    extractInterests?: boolean;
  };
}

/**
 * Context analysis operation types
 */
export type ContextAnalysisOperationType =
  | "context.analyze"
  | "context.evaluate";

/**
 * Interface for context analysis operations
 */
export interface IContextAnalysisOperation extends IBaseOperation {
  type: ContextAnalysisOperationType;
  userId: string;
  sessionId: string;
  messageId: string;
  messageText: string;
  previousState?: Record<string, any>;
  analysisType?: "thinking" | "mood" | "interests" | "goals";
  options?: Record<string, any>;
}
