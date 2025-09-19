import { v4 as uuidv4 } from "uuid";
export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

export enum MessageStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  ERROR = "error",
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status: MessageStatus;
  metadata?: Record<string, any>;
  isDeleted?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  chatHistory: ChatMessage[];
  metadata?: Record<string, any>;

  addMessage(message: ChatMessage): void;
  getLastUserMessage(): ChatMessage | undefined;
  getLastAssistantMessage(): ChatMessage | undefined;
}

export interface ChatConfig {
  includeTimeContext?: boolean;
  includeWeatherContext?: boolean;
  includeLocationContext?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class ChatMessageModel implements ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status: MessageStatus;
  metadata?: Record<string, any>;
  isDeleted?: boolean;

  constructor(data: Partial<ChatMessage>) {
    this.id = data.id || uuidv4();
    this.sessionId = data.sessionId || "";
    this.role = data.role || MessageRole.USER;
    this.content = data.content || "";
    this.timestamp = data.timestamp || new Date().toISOString();
    this.status = data.status || MessageStatus.PENDING;
    this.metadata = data.metadata || {};
    this.isDeleted = data.isDeleted || false;
  }
}

export class ChatSessionModel implements ChatSession {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  chatHistory: ChatMessage[];
  metadata?: Record<string, any>;

  constructor(data: Partial<ChatSession>) {
    this.id = data.id || uuidv4();
    this.userId = data.userId || "";
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.title = data.title;
    this.chatHistory = data.chatHistory || [];
    this.metadata = data.metadata || {};
  }

  addMessage(message: ChatMessage): void {
    this.chatHistory.push(message);
    this.updatedAt = new Date().toISOString();
  }

  getLastUserMessage(): ChatMessage | undefined {
    return [...this.chatHistory]
      .reverse()
      .find((msg) => msg.role === MessageRole.USER && !msg.isDeleted);
  }

  getLastAssistantMessage(): ChatMessage | undefined {
    return [...this.chatHistory]
      .reverse()
      .find((msg) => msg.role === MessageRole.ASSISTANT && !msg.isDeleted);
  }
}
