export type MessageStatus =  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  metadata?: {
    weather?: string;
    location?: string;
    context?: string[];
    reactions?: {
      user: string[];
      ai: {
        conscious: string[];
        unconscious: string[];
      };
    };
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  chatHistory: ChatMessage[];
  metadata?: {
    summary?: string;
    tags?: string[];
    context?: any;
  };
}

export interface IChatHandler {
  handleMessage(message: string, sessionId: string): Promise<ChatMessage>;
  getSession(sessionId: string): Promise<ChatSession>;
  summarizeSession(sessionId: string): Promise<string>;
  searchMessages(sessionId: string, query: string): Promise<ChatMessage[]>;
  getTypingStatus(sessionId: string): any; // Observable<{sessionId: string; isTyping: boolean}>
  getMessageStatus(messageId: string): any; // Observable<{messageId: string; status: MessageStatus}>
}
