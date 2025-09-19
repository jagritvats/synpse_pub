import { v4 as uuidv4 } from "uuid";
import { databaseService } from "../config/mongodb";
import SessionModel, { ISession } from "../models/session.model"; // Import Mongoose model and interface

// Define Session interface locally for clarity if ISession import has issues
// interface Session extends ISession {}

// Use ISession directly
type Session = ISession;

// Constant for the global session ID prefix
const GLOBAL_USER_SESSION_PREFIX = "global-";

interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  sessionsByDate: Record<string, number>;
}

class SessionService {
  private sessionTimeout = 30 * 24 * 60 * 60 * 1000; // 30 days
  private maxSessionsPerUser = 10; // Excludes global session
  private analyticsEnabled = true;
  // In-memory storage as fallback only
  private sessionsFallback: Map<string, Session> = new Map();

  constructor() {
    this.startSessionCleanup();
    console.log("SessionService initialized. Using MongoDB for persistence.");
  }

  private startSessionCleanup() {
    setInterval(
      async () => {
        try {
          await this.cleanupExpiredSessions();
        } catch (error) {
          console.error("Error cleaning up sessions:", error);
        }
      },
      60 * 60 * 1000
    );
  }

  // Cleans up expired sessions from the database
  private async cleanupExpiredSessions() {
    if (!databaseService.isConnected()) {
      console.warn("DB disconnected, skipping session cleanup.");
      return;
    }
    const expirationTime = new Date(Date.now() - this.sessionTimeout);
    try {
      const result = await SessionModel.deleteMany({
        lastActivity: { $lt: expirationTime },
        _id: { $not: { $regex: `^${GLOBAL_USER_SESSION_PREFIX}` } }, // Don't expire global sessions
      });
      if (result.deletedCount && result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} expired sessions.`);
      }
    } catch (error) {
      console.error("Database error during session cleanup:", error);
    }
  }

  // --- Global Session Handling ---

  // Generates the predictable global session ID for a user
  public getGlobalSessionId(userId: string): string {
    return `${GLOBAL_USER_SESSION_PREFIX}${userId}`;
  }

  // Ensures the global session exists for a user, creates if not found
  async ensureGlobalSession(userId: string): Promise<Session> {
    const globalSessionId = this.getGlobalSessionId(userId);
    let session = await this.getSession(globalSessionId); // Use getSession which handles DB/fallback

    if (!session) {
      console.log(`Global session ${globalSessionId} not found, creating...`);
      const sessionData: Partial<Session> = {
        _id: globalSessionId,
        userId: userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { title: "Global", isGlobal: true },
      };

      if (databaseService.isConnected()) {
        try {
          session = await SessionModel.create(sessionData);
          console.log(`Global session ${globalSessionId} created in DB.`);
        } catch (dbError) {
          console.error("DB error creating global session:", dbError);
          // Fallback to in-memory if DB fails
          this.sessionsFallback.set(globalSessionId, sessionData as Session);
          session = sessionData as Session;
        }
      } else {
        console.warn(
          "DB disconnected, creating global session in fallback memory."
        );
        this.sessionsFallback.set(globalSessionId, sessionData as Session);
        session = sessionData as Session;
      }
    }
    return session;
  }

  // --- CRUD Operations (DB primary, fallback secondary) ---

  async createSession(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<Session> {
    const sessionId = uuidv4(); // Regular non-global session
    console.log(`Attempting to create session ${sessionId} for user ${userId}`);

    if (databaseService.isConnected()) {
      // Check max sessions in DB (excluding global)
      const userSessionCount = await SessionModel.countDocuments({
        userId,
        _id: { $not: { $regex: `^${GLOBAL_USER_SESSION_PREFIX}` } },
      });

      if (userSessionCount >= this.maxSessionsPerUser) {
        console.warn(
          `User ${userId} reached max sessions (${this.maxSessionsPerUser}). Ending oldest.`
        );
        const oldestSession = await SessionModel.findOne({
          userId,
          _id: { $not: { $regex: `^${GLOBAL_USER_SESSION_PREFIX}` } },
        }).sort({ lastActivity: 1 });

        if (oldestSession) {
          await this.endSession(oldestSession._id); // endSession handles DB/fallback update
        }
      }
    }
    // Note: Max session check/cleanup only runs if DB is connected.

    const sessionData: Partial<Session> = {
      _id: sessionId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata,
    };

    let createdSession: Session;
    if (databaseService.isConnected()) {
      try {
        createdSession = await SessionModel.create(sessionData);
        console.log(`Session ${sessionId} created in DB.`);
        // Also update fallback map for consistency during potential brief disconnects
        this.sessionsFallback.set(sessionId, createdSession);
      } catch (dbError) {
        console.error(`DB error creating session ${sessionId}:`, dbError);
        // If DB fails, rely solely on fallback map for this session
        this.sessionsFallback.set(sessionId, sessionData as Session);
        createdSession = sessionData as Session;
        console.warn(
          `Session ${sessionId} created in fallback memory due to DB error.`
        );
      }
    } else {
      console.warn("DB disconnected, creating session in fallback memory.");
      this.sessionsFallback.set(sessionId, sessionData as Session);
      createdSession = sessionData as Session;
    }
    return createdSession;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    if (databaseService.isConnected()) {
      try {
        const session = await SessionModel.findById(sessionId).lean(); // Use lean for plain JS object
        if (session) {
          // Check if expired - potentially redundant if cleanup job runs often
          // if (Date.now() - session.lastActivity.getTime() > this.sessionTimeout && !sessionId.startsWith(GLOBAL_USER_SESSION_PREFIX)) {
          //   await this.endSession(sessionId);
          //   return null;
          // }
          // Update fallback cache
          this.sessionsFallback.set(sessionId, session as Session);
          return session as Session;
        }
      } catch (dbError) {
        console.error(`DB error getting session ${sessionId}:`, dbError);
        // Fall through to check fallback if DB error occurs
      }
    }

    // Fallback check
    console.warn(
      `DB disconnected or session ${sessionId} not found in DB, checking fallback.`
    );
    const fallbackSession = this.sessionsFallback.get(sessionId);
    if (fallbackSession) {
      // Check expiry in fallback too
      if (
        Date.now() - fallbackSession.lastActivity.getTime() >
          this.sessionTimeout &&
        !sessionId.startsWith(GLOBAL_USER_SESSION_PREFIX)
      ) {
        console.log(`Fallback session ${sessionId} expired, removing.`);
        this.sessionsFallback.delete(sessionId);
        return null;
      }
      return fallbackSession;
    }

    return null; // Not found in DB or fallback
  }

  // Updates activity time in DB and fallback
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const updateTime = new Date();
    let updated = false;
    if (databaseService.isConnected()) {
      try {
        const result = await SessionModel.updateOne(
          { _id: sessionId },
          { $set: { lastActivity: updateTime } }
        );
        if (result.modifiedCount > 0) {
          updated = true;
        }
      } catch (dbError) {
        console.error(
          `DB error updating activity for session ${sessionId}:`,
          dbError
        );
        // Continue to update fallback even if DB fails
      }
    }

    // Update fallback map regardless of DB status (if session exists there)
    const fallbackSession = this.sessionsFallback.get(sessionId);
    if (fallbackSession) {
      fallbackSession.lastActivity = updateTime;
      this.sessionsFallback.set(sessionId, fallbackSession);
      updated = true; // Consider it updated if fallback was updated
    } else if (updated) {
      // If updated in DB but not in fallback, fetch and cache
      this.getSession(sessionId).catch((e) =>
        console.error("Failed to cache session after DB activity update")
      );
    }

    if (!updated) {
      console.warn(`Session ${sessionId} not found for activity update.`);
    }
    return updated;
  }

  // Updates session metadata in DB and fallback
  async updateSessionMetadata(
    sessionId: string,
    metadataUpdates: Record<string, any>
  ): Promise<Session | null> {
    let updatedSession: Session | null = null;

    if (databaseService.isConnected()) {
      try {
        // Fetch the session first to merge metadata correctly
        const session = await SessionModel.findById(sessionId);
        if (!session) {
          console.warn(
            `Session ${sessionId} not found in DB for metadata update.`
          );
          // Still check fallback below
        } else {
          // Merge new metadata with existing
          const newMetadata = {
            ...(session.metadata || {}),
            ...metadataUpdates,
          };
          session.metadata = newMetadata;
          session.lastActivity = new Date(); // Update activity time
          updatedSession = await session.save();
          console.log(`Session ${sessionId} metadata updated in DB.`);
        }
      } catch (dbError) {
        console.error(
          `DB error updating metadata for session ${sessionId}:`,
          dbError
        );
        // Fall through to update fallback if DB fails but session might exist in fallback
      }
    }

    // Update fallback map (if session exists or was just updated in DB)
    const fallbackSession =
      this.sessionsFallback.get(sessionId) ||
      (updatedSession ? updatedSession : null);
    if (fallbackSession) {
      // Ensure metadata object exists
      fallbackSession.metadata = fallbackSession.metadata || {};
      // Merge updates
      fallbackSession.metadata = {
        ...fallbackSession.metadata,
        ...metadataUpdates,
      };
      fallbackSession.lastActivity = new Date();
      this.sessionsFallback.set(sessionId, fallbackSession);
      // If DB failed but fallback updated, return the fallback version
      if (!updatedSession) updatedSession = fallbackSession;
      console.log(`Session ${sessionId} metadata updated in fallback memory.`);
    } else if (updatedSession) {
      // If updated in DB but not initially in fallback, add it now
      this.sessionsFallback.set(sessionId, updatedSession);
    }

    if (!updatedSession) {
      console.warn(
        `Session ${sessionId} not found anywhere for metadata update.`
      );
    }
    return updatedSession;
  }

  // Marks session ended in DB (sets endTime) and removes from fallback
  async endSession(sessionId: string): Promise<boolean> {
    const endTime = new Date();
    let ended = false;
    if (databaseService.isConnected()) {
      try {
        const result = await SessionModel.updateOne(
          { _id: sessionId },
          { $set: { endTime: endTime, lastActivity: endTime } }
        );
        if (result.modifiedCount > 0) {
          ended = true;
          console.log(`Session ${sessionId} marked ended in DB.`);
        }
      } catch (dbError) {
        console.error(`DB error ending session ${sessionId}:`, dbError);
      }
    }

    // Always remove from fallback map when ended
    if (this.sessionsFallback.has(sessionId)) {
      this.sessionsFallback.delete(sessionId);
      console.log(`Session ${sessionId} removed from fallback memory.`);
      ended = true; // Consider ended if removed from fallback
    }

    if (!ended) {
      console.warn(`Session ${sessionId} not found to end.`);
    }
    return ended;
  }

  // Gets sessions for a user - DB primary, fallback secondary
  public async getUserSessions(userId: string): Promise<Session[]> {
    // Ensure global session exists for the user first
    await this.ensureGlobalSession(userId);

    let dbSessions: Session[] = [];
    if (databaseService.isConnected()) {
      try {
        dbSessions = (await SessionModel.find({ userId }).lean()) as Session[];
        // Update fallback cache with fetched sessions
        dbSessions.forEach((session) =>
          this.sessionsFallback.set(session._id, session)
        );
      } catch (dbError) {
        console.error(`DB error getting sessions for user ${userId}:`, dbError);
        // Fall through to return fallback if DB fails
      }
    } else {
      console.warn(
        `DB disconnected, returning sessions from fallback for user ${userId}.`
      );
    }

    // If DB failed or disconnected, return only from fallback
    if (!databaseService.isConnected() || dbSessions.length === 0) {
      const fallbackSessions = Array.from(
        this.sessionsFallback.values()
      ).filter((session) => session.userId === userId);
      // Ensure the global session is included if only using fallback
      const globalSessionId = this.getGlobalSessionId(userId);
      if (!fallbackSessions.some((s) => s._id === globalSessionId)) {
        const globalFallback = this.sessionsFallback.get(globalSessionId);
        if (globalFallback) fallbackSessions.push(globalFallback);
      }
      return fallbackSessions;
    }

    return dbSessions;
  }

  // Removed saveSession, logSessionCreation, getAllSessions as direct DB ops are used
  // Deprecated analytics methods remain unchanged for now
  /**
   * @deprecated Analytics functionality needs proper implementation
   */
  async getSessionAnalytics(
    options: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
    } = {}
  ): Promise<SessionAnalytics> {
    console.warn("getSessionAnalytics is deprecated and needs implementation.");
    // Return dummy data as placeholder
    return {
      totalSessions: 0,
      activeSessions: 0,
      averageSessionDuration: 0,
      sessionsByDate: {},
    };
  }

  /**
   * @deprecated Analytics functionality needs proper implementation
   */
  private groupSessionsByDate(
    analytics: any[] // Use any[] until the structure from getAnalytics is clear
  ): Record<string, number> {
    console.warn("groupSessionsByDate is deprecated and needs implementation.");
    // Return empty object as placeholder
    return {};
  }

  private async saveAnalytics(analytics: any): Promise<void> {
    // Implement analytics storage logic here
    console.log("Saving analytics:", analytics);
  }

  /**
   * Search for sessions by userId pattern (regex)
   * Used to find sessions that match a pattern, e.g., all telegram users
   */
  public async searchSessionsByUserIdPattern(
    pattern: string
  ): Promise<Session[]> {
    try {
      if (!databaseService.isConnected()) {
        console.warn("DB disconnected, fallback search in memory storage.");
        // Search in memory - basic regex test
        const regex = new RegExp(pattern);
        const sessions = Array.from(this.sessionsFallback.values()).filter(
          (session) => regex.test(session.userId)
        );
        return sessions;
      }

      // Create a regular expression for MongoDB
      const sessions = await SessionModel.find({
        userId: { $regex: pattern },
      }).lean();

      // Also update the fallback cache
      sessions.forEach((session) => {
        this.sessionsFallback.set(session._id, session as Session);
      });

      return sessions as Session[];
    } catch (error) {
      console.error("Error searching sessions by userId pattern:", error);
      return [];
    }
  }

  /**
   * Update a session with new metadata
   */
  async updateSession(
    sessionId: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const updateTime = new Date();
    let updated = false;

    if (databaseService.isConnected()) {
      try {
        // Use updateOne directly to avoid type issues with Mongoose documents
        const result = await SessionModel.updateOne(
          { _id: sessionId },
          {
            $set: {
              metadata: metadata || {},
              lastActivity: updateTime,
            },
          }
        );

        if (result.modifiedCount > 0) {
          updated = true;
          console.log(`Session ${sessionId} updated in DB.`);

          // Update in-memory fallback with only the essential fields
          const existingSession = this.sessionsFallback.get(sessionId);
          if (existingSession) {
            // Create a new fallback session object with updated fields
            const updatedFallback = {
              _id: existingSession._id,
              userId: existingSession.userId,
              createdAt: existingSession.createdAt,
              lastActivity: updateTime,
              metadata: metadata || existingSession.metadata || {},
              // Preserve other essential fields
              ipAddress: existingSession.ipAddress,
              userAgent: existingSession.userAgent,
              endTime: existingSession.endTime,
            } as Session;

            this.sessionsFallback.set(sessionId, updatedFallback);
          }
        }
      } catch (dbError) {
        console.error(`DB error updating session ${sessionId}:`, dbError);
      }
    } else {
      // Fallback to in-memory if DB is not connected
      const fallbackSession = this.sessionsFallback.get(sessionId);
      if (fallbackSession) {
        // Create a new fallback session object with updated fields
        const updatedFallback = {
          _id: fallbackSession._id,
          userId: fallbackSession.userId,
          createdAt: fallbackSession.createdAt,
          lastActivity: updateTime,
          metadata: metadata || fallbackSession.metadata || {},
          // Preserve other essential fields
          ipAddress: fallbackSession.ipAddress,
          userAgent: fallbackSession.userAgent,
          endTime: fallbackSession.endTime,
        } as Session;

        this.sessionsFallback.set(sessionId, updatedFallback);
        updated = true;
        console.log(`Session ${sessionId} updated in fallback memory.`);
      }
    }

    return updated;
  }

  /**
   * Delete a session
   * Permanent deletion (versus endSession which only marks as ended)
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    let deleted = false;

    // Don't allow deletion of global sessions
    if (sessionId.startsWith(GLOBAL_USER_SESSION_PREFIX)) {
      console.warn(
        `Attempted to delete global session ${sessionId}. Operation denied.`
      );
      return false;
    }

    if (databaseService.isConnected()) {
      try {
        const result = await SessionModel.deleteOne({ _id: sessionId });
        if (result.deletedCount > 0) {
          deleted = true;
          console.log(`Session ${sessionId} deleted from DB.`);
        }
      } catch (dbError) {
        console.error(`DB error deleting session ${sessionId}:`, dbError);
      }
    }

    // Always remove from fallback map when deleted
    if (this.sessionsFallback.has(sessionId)) {
      this.sessionsFallback.delete(sessionId);
      console.log(`Session ${sessionId} removed from fallback memory.`);
      deleted = true; // Consider deleted if removed from fallback
    }

    if (!deleted) {
      console.warn(`Session ${sessionId} not found to delete.`);
    }

    return deleted;
  }
}

// Export a singleton instance
export const sessionService = new SessionService();
