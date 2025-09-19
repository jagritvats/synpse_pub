import {
  ChatSession,
  ChatSessionModel,
  ChatMessage,
  MessageRole,
} from "../models/chat.model";

/**
 * Service for managing chat sessions
 */
class ChatSessionManager {
  // In-memory storage for sessions - in production this would use a database
  private sessions: Map<string, ChatSession> = new Map();

  /**
   * @deprecated Session creation should be handled by SessionService for persistence.
   * This method only creates an in-memory representation.
   */
  // createSession(userId: string): ChatSession {
  //   const session = new ChatSessionModel({ userId });
  //   // Generate a default title based on existing sessions for the user
  //   const userSessionCount = this.getUserSessions(userId).length;
  //   session.title = `Chat ${userSessionCount + 1} 💖`; // Start count from 1
  //   this.sessions.set(session.id, session);
  //   return session;
  // }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId
    );
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: ChatMessage): ChatSession | undefined {
    const session = this.getSession(sessionId);
    if (!session) return undefined;

    session.addMessage(message);
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get active (non-deleted) messages for a session
   */
  getActiveMessages(sessionId: string): ChatMessage[] {
    const session = this.getSession(sessionId);
    if (!session) return [];

    return session.chatHistory.filter((message) => !message.isDeleted);
  }

  /**
   * Soft delete a message in a session
   */
  softDeleteMessage(sessionId: string, messageId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const message = session.chatHistory.find((m) => m.id === messageId);
    if (!message) return false;

    message.isDeleted = true;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    return true;
  }

  /**
   * Restore a soft-deleted message in a session
   */
  restoreMessage(sessionId: string, messageId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const message = session.chatHistory.find((m) => m.id === messageId);
    if (!message) return false;

    message.isDeleted = false;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    return true;
  }

  /**
   * Update a session's title
   */
  updateSessionTitle(
    sessionId: string,
    title: string
  ): ChatSession | undefined {
    const session = this.getSession(sessionId);
    if (!session) return undefined;

    session.title = title;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Delete all sessions for a user
   */
  deleteUserSessions(userId: string): number {
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Initializes the state for a new chat session.
   * Optionally accepts initial data like title from a persistent source.
   */
  initializeSession(
    sessionId: string,
    userId: string,
    initialData?: { title?: string }
  ): void {
    if (!this.sessions.has(sessionId)) {
      // Create a new ChatSessionModel instance if it doesn't exist
      const session = new ChatSessionModel({
        id: sessionId,
        userId,
        title: initialData?.title || `Chat Session`, // Use provided title or a default
        chatHistory: [], // Ensure history starts empty
      });
      this.sessions.set(sessionId, session);
      // console.log(`Initialized chat state for session: ${sessionId}`); // Reduce noise
    }
  }

  /**
   * Ends a chat session by removing its state from memory.
   */
  endSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`Ended chat state for session: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Get the number of messages in a session
   */
  getSessionMessageCount(sessionId: string): number {
    const session = this.getSession(sessionId);
    return session ? session.chatHistory.length : 0;
  }

  /**
   * Clears the chat history for a specific session in memory.
   */
  clearSessionHistory(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.chatHistory = []; // Clear the array
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    console.log(`Cleared in-memory chat history for session: ${sessionId}`);
    return true;
  }
}

// Create a singleton instance
export const chatSessionManager = new ChatSessionManager();
