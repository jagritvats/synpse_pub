import mongoose from "mongoose";import { v4 as uuidv4 } from "uuid";
import { aiService } from "./ai.service";
import { memoryService } from "./memory.service";
import { MemoryType, MemoryCategory } from "../models/memory.model";

/**
 * Social profile schema for MongoDB
 */
const SocialProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  bio: { type: String },
  interests: [String],
  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
  connectionCount: { type: Number, default: 0 },
  recentInteractions: { type: Number, default: 0 },
  personalityTraits: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  matching: {
    enabled: { type: Boolean, default: false },
    lookingFor: [String],
    matchCriteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    availableForMatching: { type: Boolean, default: false },
    recentMatches: [
      {
        userId: String,
        name: String,
        matchScore: Number,
        timestamp: Date,
        interacted: { type: Boolean, default: false },
      },
    ],
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

SocialProfileSchema.index({ userId: 1 });
SocialProfileSchema.index({ "matching.availableForMatching": 1 });
SocialProfileSchema.index({ interests: 1 });

/**
 * Social connection schema for MongoDB
 */
const SocialConnectionSchema = new mongoose.Schema({
  userA: { type: String, required: true },
  userB: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "connected", "rejected", "blocked"],
    default: "pending",
  },
  initiatedBy: { type: String, required: true },
  connectionStrength: { type: Number, default: 0 }, // 0-10 scale
  lastInteraction: { type: Date },
  interactionCount: { type: Number, default: 0 },
  sharedInterests: [String],
  createdAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

SocialConnectionSchema.index({ userA: 1, userB: 1 }, { unique: true });
SocialConnectionSchema.index({ userA: 1, status: 1 });
SocialConnectionSchema.index({ userB: 1, status: 1 });

// Define models
const SocialProfile = mongoose.model("SocialProfile", SocialProfileSchema);
const SocialConnection = mongoose.model(
  "SocialConnection",
  SocialConnectionSchema
);

/**
 * Interface for social context
 */
export interface SocialContext {
  recentInteractions: number;
  connectionCount: number;
  pendingConnectionRequests?: number;
  topConnections?: Array<{
    name: string;
    connectionStrength: number;
    lastInteractionDays: number;
  }>;
  matches?: Array<{
    name: string;
    matchScore: number;
    interests: string[];
  }>;
}

/**
 * Service for managing social interactions and matchmaking
 */
class SocialService {
  private inMemorySocialProfiles: Map<string, any> = new Map();
  private inMemorySocialConnections: Map<string, any> = new Map();
  private useInMemoryFallback: boolean = false;

  constructor() {
    // Check MongoDB connectivity
    this.checkMongoConnection();

    // Run matchmaking process periodically
    setInterval(() => this.runMatchmaking(), 12 * 60 * 60 * 1000); // Twice daily

    // Update connection strengths periodically
    setInterval(() => this.updateConnectionStrengths(), 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Check MongoDB connection and set fallback mode if unavailable
   */
  private async checkMongoConnection(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) {
        console.warn(
          "MongoDB not connected, using in-memory social service fallback"
        );
        this.useInMemoryFallback = true;
      } else {
        this.useInMemoryFallback = false;
      }
    } catch (error) {
      console.error("Error checking MongoDB connection:", error);
      this.useInMemoryFallback = true;
    }

    // Re-check connection periodically
    setTimeout(() => this.checkMongoConnection(), 5 * 60 * 1000);
  }

  /**
   * Create or update a user's social profile
   */
  async updateSocialProfile(
    userId: string,
    profileData: {
      name: string;
      bio?: string;
      interests?: string[];
      preferences?: Record<string, any>;
      personalityTraits?: string[];
      matching?: {
        enabled?: boolean;
        lookingFor?: string[];
        matchCriteria?: Record<string, any>;
        availableForMatching?: boolean;
      };
    }
  ): Promise<any> {
    if (this.useInMemoryFallback) {
      // Use in-memory storage
      const existingProfile = this.inMemorySocialProfiles.get(userId);

      if (existingProfile) {
        // Update existing profile
        const updatedProfile = {
          ...existingProfile,
          ...profileData,
          updatedAt: new Date(),
          matching: {
            ...existingProfile.matching,
            ...(profileData.matching || {}),
          },
        };
        this.inMemorySocialProfiles.set(userId, updatedProfile);
        return updatedProfile;
      } else {
        // Create new profile
        const newProfile = {
          userId,
          name: profileData.name,
          bio: profileData.bio || "",
          interests: profileData.interests || [],
          preferences: profileData.preferences || {},
          connectionCount: 0,
          recentInteractions: 0,
          personalityTraits: profileData.personalityTraits || [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          matching: {
            enabled: profileData.matching?.enabled || false,
            lookingFor: profileData.matching?.lookingFor || [],
            matchCriteria: profileData.matching?.matchCriteria || {},
            availableForMatching:
              profileData.matching?.availableForMatching || false,
            recentMatches: [],
          },
          metadata: {},
        };
        this.inMemorySocialProfiles.set(userId, newProfile);
        return newProfile;
      }
    } else {
      try {
        // Use MongoDB
        const updateData = {
          ...profileData,
          updatedAt: new Date(),
        };

        if (profileData.matching) {
          updateData.matching = {
            $set: profileData.matching,
          };
        }

        // Try to update existing profile
        let profile = await SocialProfile.findOneAndUpdate(
          { userId },
          { $set: updateData },
          { new: true }
        ).exec();

        // If no profile exists, create new one
        if (!profile) {
          profile = new SocialProfile({
            userId,
            ...profileData,
            connectionCount: 0,
            recentInteractions: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
          });
          await profile.save();
        }

        return profile;
      } catch (error) {
        console.error(
          "Error updating social profile in MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.updateSocialProfile(userId, profileData);
      }
    }
  }

  /**
   * Get a user's social profile
   */
  async getSocialProfile(userId: string): Promise<any | null> {
    if (this.useInMemoryFallback) {
      return this.inMemorySocialProfiles.get(userId) || null;
    } else {
      try {
        return await SocialProfile.findOne({ userId }).exec();
      } catch (error) {
        console.error(
          "Error getting social profile from MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.getSocialProfile(userId);
      }
    }
  }

  /**
   * Create a connection request between two users
   */
  async createConnectionRequest(
    initiatingUserId: string,
    targetUserId: string,
    message?: string
  ): Promise<any> {
    if (initiatingUserId === targetUserId) {
      throw new Error("Cannot connect with yourself");
    }

    // Get both users' profiles to make sure they exist
    const initiatorProfile = await this.getSocialProfile(initiatingUserId);
    const targetProfile = await this.getSocialProfile(targetUserId);

    if (!initiatorProfile) {
      throw new Error("Initiating user profile not found");
    }

    if (!targetProfile) {
      throw new Error("Target user profile not found");
    }

    // Find shared interests
    const sharedInterests = initiatorProfile.interests.filter(
      (interest: string) => targetProfile.interests.includes(interest)
    );

    if (this.useInMemoryFallback) {
      // Generate a unique key for the connection
      const connectionKey = [initiatingUserId, targetUserId].sort().join("_");

      // Check if connection already exists
      const existingConnection =
        this.inMemorySocialConnections.get(connectionKey);
      if (existingConnection) {
        throw new Error("Connection already exists");
      }

      // Create new connection
      const newConnection = {
        userA:
          initiatingUserId < targetUserId ? initiatingUserId : targetUserId,
        userB:
          initiatingUserId < targetUserId ? targetUserId : initiatingUserId,
        status: "pending",
        initiatedBy: initiatingUserId,
        connectionStrength: 0,
        interactionCount: 0,
        sharedInterests,
        createdAt: new Date(),
        metadata: { initialMessage: message },
      };

      this.inMemorySocialConnections.set(connectionKey, newConnection);

      // Update connection counts
      const initiatorProfileUpdate =
        this.inMemorySocialProfiles.get(initiatingUserId);
      initiatorProfileUpdate.recentInteractions += 1;
      this.inMemorySocialProfiles.set(initiatingUserId, initiatorProfileUpdate);

      return newConnection;
    } else {
      try {
        // Check if connection already exists
        const existingConnection = await SocialConnection.findOne({
          $or: [
            { userA: initiatingUserId, userB: targetUserId },
            { userA: targetUserId, userB: initiatingUserId },
          ],
        }).exec();

        if (existingConnection) {
          throw new Error("Connection already exists");
        }

        // Create new connection
        const newConnection = new SocialConnection({
          userA:
            initiatingUserId < targetUserId ? initiatingUserId : targetUserId,
          userB:
            initiatingUserId < targetUserId ? targetUserId : initiatingUserId,
          status: "pending",
          initiatedBy: initiatingUserId,
          sharedInterests,
          metadata: { initialMessage: message },
        });

        await newConnection.save();

        // Update initiator's interaction count
        await SocialProfile.updateOne(
          { userId: initiatingUserId },
          { $inc: { recentInteractions: 1 } }
        ).exec();

        return newConnection;
      } catch (error) {
        console.error(
          "Error creating connection in MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.createConnectionRequest(
          initiatingUserId,
          targetUserId,
          message
        );
      }
    }
  }

  /**
   * Accept a connection request
   */
  async acceptConnection(
    userId: string,
    connectionUserId: string
  ): Promise<boolean> {
    if (this.useInMemoryFallback) {
      const connectionKey = [userId, connectionUserId].sort().join("_");
      const connection = this.inMemorySocialConnections.get(connectionKey);

      if (
        !connection ||
        connection.status !== "pending" ||
        connection.initiatedBy === userId
      ) {
        return false;
      }

      connection.status = "connected";
      connection.lastInteraction = new Date();
      this.inMemorySocialConnections.set(connectionKey, connection);

      // Update connection counts for both users
      const userProfileA = this.inMemorySocialProfiles.get(userId);
      const userProfileB = this.inMemorySocialProfiles.get(connectionUserId);

      if (userProfileA) {
        userProfileA.connectionCount += 1;
        userProfileA.recentInteractions += 1;
        this.inMemorySocialProfiles.set(userId, userProfileA);
      }

      if (userProfileB) {
        userProfileB.connectionCount += 1;
        userProfileB.recentInteractions += 1;
        this.inMemorySocialProfiles.set(connectionUserId, userProfileB);
      }

      return true;
    } else {
      try {
        // Find the pending connection
        const connection = await SocialConnection.findOne({
          $or: [
            { userA: userId, userB: connectionUserId },
            { userA: connectionUserId, userB: userId },
          ],
          status: "pending",
          initiatedBy: connectionUserId,
        }).exec();

        if (!connection) {
          return false;
        }

        // Update connection status
        connection.status = "connected";
        connection.lastInteraction = new Date();
        await connection.save();

        // Update connection counts for both users
        await SocialProfile.updateOne(
          { userId },
          { $inc: { connectionCount: 1, recentInteractions: 1 } }
        ).exec();

        await SocialProfile.updateOne(
          { userId: connectionUserId },
          { $inc: { connectionCount: 1, recentInteractions: 1 } }
        ).exec();

        // Create memory for both users
        const userProfile = await this.getSocialProfile(userId);
        const connectionProfile = await this.getSocialProfile(connectionUserId);

        if (userProfile && connectionProfile) {
          await memoryService.addMemory(
            userId,
            `Connected with ${connectionProfile.name}`,
            MemoryType.LONG_TERM,
            "social-service",
            { connectionId: connection._id, type: "new-connection" },
            6,
            MemoryCategory.RELATIONSHIP
          );

          await memoryService.addMemory(
            connectionUserId,
            `Connected with ${userProfile.name}`,
            MemoryType.LONG_TERM,
            "social-service",
            { connectionId: connection._id, type: "new-connection" },
            6,
            MemoryCategory.RELATIONSHIP
          );
        }

        return true;
      } catch (error) {
        console.error(
          "Error accepting connection in MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.acceptConnection(userId, connectionUserId);
      }
    }
  }

  /**
   * Get all connections for a user
   */
  async getUserConnections(
    userId: string,
    status?: string,
    limit: number = 50
  ): Promise<any[]> {
    if (this.useInMemoryFallback) {
      const connections = Array.from(this.inMemorySocialConnections.values())
        .filter(
          (conn) =>
            (conn.userA === userId || conn.userB === userId) &&
            (!status || conn.status === status)
        )
        .slice(0, limit);

      // Enhance connections with user info
      return Promise.all(
        connections.map(async (conn) => {
          const otherUserId = conn.userA === userId ? conn.userB : conn.userA;
          const otherProfile = this.inMemorySocialProfiles.get(otherUserId);

          return {
            ...conn,
            otherUser: otherProfile
              ? {
                  userId: otherUserId,
                  name: otherProfile.name,
                  bio: otherProfile.bio,
                }
              : { userId: otherUserId },
          };
        })
      );
    } else {
      try {
        const query: any = {
          $or: [{ userA: userId }, { userB: userId }],
        };

        if (status) {
          query.status = status;
        }

        const connections = await SocialConnection.find(query)
          .sort({ lastInteraction: -1 })
          .limit(limit)
          .exec();

        // Enhance connections with user info
        return Promise.all(
          connections.map(async (conn) => {
            const otherUserId = conn.userA === userId ? conn.userB : conn.userA;
            const otherProfile = await SocialProfile.findOne({
              userId: otherUserId,
            }).exec();

            return {
              userA: conn.userA,
              userB: conn.userB,
              status: conn.status,
              initiatedBy: conn.initiatedBy,
              connectionStrength: conn.connectionStrength,
              lastInteraction: conn.lastInteraction,
              interactionCount: conn.interactionCount,
              sharedInterests: conn.sharedInterests,
              createdAt: conn.createdAt,
              metadata: conn.metadata,
              otherUser: otherProfile
                ? {
                    userId: otherUserId,
                    name: otherProfile.name,
                    bio: otherProfile.bio,
                  }
                : { userId: otherUserId },
            };
          })
        );
      } catch (error) {
        console.error(
          "Error getting user connections from MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.getUserConnections(userId, status, limit);
      }
    }
  }

  /**
   * Get pending connection requests for a user
   */
  async getPendingConnectionRequests(userId: string): Promise<any[]> {
    return this.getUserConnections(userId, "pending");
  }

  /**
   * Record an interaction between connected users
   */
  async recordInteraction(
    userA: string,
    userB: string,
    interactionType: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    if (this.useInMemoryFallback) {
      const connectionKey = [userA, userB].sort().join("_");
      const connection = this.inMemorySocialConnections.get(connectionKey);

      if (!connection || connection.status !== "connected") {
        return false;
      }

      // Update connection
      connection.lastInteraction = new Date();
      connection.interactionCount += 1;
      connection.metadata = {
        ...connection.metadata,
        lastInteractionType: interactionType,
        lastInteractionMetadata: metadata,
      };

      this.inMemorySocialConnections.set(connectionKey, connection);

      // Update recent interactions count for both users
      const profileA = this.inMemorySocialProfiles.get(userA);
      const profileB = this.inMemorySocialProfiles.get(userB);

      if (profileA) {
        profileA.recentInteractions += 1;
        this.inMemorySocialProfiles.set(userA, profileA);
      }

      if (profileB) {
        profileB.recentInteractions += 1;
        this.inMemorySocialProfiles.set(userB, profileB);
      }

      return true;
    } else {
      try {
        // Find the connection
        const connection = await SocialConnection.findOne({
          $or: [
            { userA, userB },
            { userA: userB, userB: userA },
          ],
          status: "connected",
        }).exec();

        if (!connection) {
          return false;
        }

        // Update connection
        connection.lastInteraction = new Date();
        connection.interactionCount += 1;
        connection.metadata = {
          ...connection.metadata,
          lastInteractionType: interactionType,
          lastInteractionMetadata: metadata,
        };

        await connection.save();

        // Update recent interactions count for both users
        await SocialProfile.updateMany(
          { userId: { $in: [userA, userB] } },
          { $inc: { recentInteractions: 1 } }
        ).exec();

        return true;
      } catch (error) {
        console.error(
          "Error recording interaction in MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.recordInteraction(userA, userB, interactionType, metadata);
      }
    }
  }

  /**
   * Get social data for user context
   */
  async getUserSocialData(userId: string): Promise<SocialContext | null> {
    try {
      // Get user profile
      const profile = await this.getSocialProfile(userId);
      if (!profile) {
        return null;
      }

      // Get connections
      const connections = await this.getUserConnections(
        userId,
        "connected",
        10
      );

      // Get pending requests
      const pendingRequests = await this.getPendingConnectionRequests(userId);

      // Calculate top connections by strength
      const topConnections = connections
        .sort((a, b) => b.connectionStrength - a.connectionStrength)
        .slice(0, 3)
        .map((conn) => {
          // Calculate days since last interaction
          const daysSinceLastInteraction = conn.lastInteraction
            ? Math.round(
                (Date.now() - new Date(conn.lastInteraction).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0;

          return {
            name: conn.otherUser.name,
            connectionStrength: conn.connectionStrength,
            lastInteractionDays: daysSinceLastInteraction,
          };
        });

      // Get matches if matching is enabled
      let matches = [];
      if (
        profile.matching &&
        profile.matching.enabled &&
        profile.matching.recentMatches
      ) {
        matches = profile.matching.recentMatches
          .filter((m: any) => !m.interacted)
          .slice(0, 3)
          .map((match: any) => ({
            name: match.name,
            matchScore: match.matchScore,
            interests: match.interests || [],
          }));
      }

      // Construct social context
      const socialContext: SocialContext = {
        connectionCount: profile.connectionCount || 0,
        recentInteractions: profile.recentInteractions || 0,
        pendingConnectionRequests: pendingRequests.length,
        topConnections: topConnections.length > 0 ? topConnections : undefined,
        matches: matches.length > 0 ? matches : undefined,
      };

      return socialContext;
    } catch (error) {
      console.error("Error getting user social data:", error);
      return null;
    }
  }

  /**
   * Run matchmaking algorithm to find potential matches
   */
  private async runMatchmaking(): Promise<void> {
    if (this.useInMemoryFallback) {
      // Get profiles available for matching
      const matchingProfiles = Array.from(
        this.inMemorySocialProfiles.values()
      ).filter(
        (profile) =>
          profile.matching &&
          profile.matching.enabled &&
          profile.matching.availableForMatching
      );

      if (matchingProfiles.length < 2) {
        console.log("Not enough profiles available for matching");
        return;
      }

      // For each profile, find potential matches
      for (const profile of matchingProfiles) {
        // Find potential matches
        const potentialMatches = matchingProfiles
          .filter(
            (match) =>
              match.userId !== profile.userId &&
              !this.areUsersConnected(profile.userId, match.userId)
          )
          .map((match) => {
            const matchScore = this.calculateMatchScore(profile, match);

            return {
              userId: match.userId,
              name: match.name,
              matchScore,
              interests: match.interests,
              timestamp: new Date(),
            };
          })
          .filter((match) => match.matchScore > 0.5) // Only consider good matches
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 5); // Only keep top 5 matches

        // Update profile with new matches
        profile.matching.recentMatches = potentialMatches;
        this.inMemorySocialProfiles.set(profile.userId, profile);
      }
    } else {
      try {
        // Get profiles available for matching
        const matchingProfiles = await SocialProfile.find({
          "matching.enabled": true,
          "matching.availableForMatching": true,
        }).exec();

        if (matchingProfiles.length < 2) {
          console.log("Not enough profiles available for matching");
          return;
        }

        // For each profile, find potential matches
        for (const profile of matchingProfiles) {
          // Get existing connections to exclude them
          const connections = await this.getUserConnections(profile.userId);
          const connectedUserIds = connections.map((conn) =>
            conn.userA === profile.userId ? conn.userB : conn.userA
          );

          // Find potential matches
          const potentialMatches = matchingProfiles
            .filter(
              (match) =>
                match.userId !== profile.userId &&
                !connectedUserIds.includes(match.userId)
            )
            .map((match) => {
              const matchScore = this.calculateMatchScore(profile, match);

              return {
                userId: match.userId,
                name: match.name,
                matchScore,
                interests: match.interests,
                timestamp: new Date(),
                interacted: false,
              };
            })
            .filter((match) => match.matchScore > 0.5) // Only consider good matches
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 5); // Only keep top 5 matches

          // Update profile with new matches
          profile.matching.recentMatches = potentialMatches;
          await profile.save();

          console.log(
            `Found ${potentialMatches.length} matches for user ${profile.userId}`
          );
        }
      } catch (error) {
        console.error("Error running matchmaking:", error);
      }
    }
  }

  /**
   * Calculate match score between two profiles
   * This is a simple implementation that could be enhanced with AI
   */
  private calculateMatchScore(profileA: any, profileB: any): number {
    // Calculate interest overlap
    const interestsA = new Set(profileA.interests || []);
    const interestsB = new Set(profileB.interests || []);

    const sharedInterests = [...interestsA].filter((interest) =>
      interestsB.has(interest)
    );
    const interestScore =
      sharedInterests.length /
      Math.max(Math.max(interestsA.size, interestsB.size), 1);

    // Calculate criteria match
    let criteriaScore = 1; // Default perfect match

    if (
      profileA.matching.lookingFor &&
      profileA.matching.lookingFor.length > 0
    ) {
      const matchesLookingFor = profileA.matching.lookingFor.some(
        (criteria: string) => profileB.personalityTraits.includes(criteria)
      );

      if (!matchesLookingFor) {
        criteriaScore *= 0.5; // Reduce score if doesn't match criteria
      }
    }

    // Calculate personality compatibility (simplified)
    const traitsA = new Set(profileA.personalityTraits || []);
    const traitsB = new Set(profileB.personalityTraits || []);

    const sharedTraits = [...traitsA].filter((trait) => traitsB.has(trait));
    const traitScore =
      sharedTraits.length > 0
        ? 0.8 + (0.2 * sharedTraits.length) / Math.max(traitsA.size, 1)
        : 0.5;

    // Calculate final score (weighted average)
    return interestScore * 0.5 + criteriaScore * 0.3 + traitScore * 0.2;
  }

  /**
   * Check if users are already connected
   */
  private areUsersConnected(userA: string, userB: string): boolean {
    if (this.useInMemoryFallback) {
      const connectionKey = [userA, userB].sort().join("_");
      return this.inMemorySocialConnections.has(connectionKey);
    } else {
      // This should be implemented with a MongoDB query,
      // but since it's used in a loop during matchmaking, we'll defer to the DB query in getUserConnections
      return false;
    }
  }

  /**
   * Update connection strengths based on interaction data
   */
  private async updateConnectionStrengths(): Promise<void> {
    if (this.useInMemoryFallback) {
      // Simple algorithm for connection strength:
      // - Base value determined by shared interests
      // - Increased by interaction frequency
      // - Decays with time

      for (const [
        key,
        connection,
      ] of this.inMemorySocialConnections.entries()) {
        if (connection.status !== "connected") continue;

        // Base strength from shared interests
        let strength = Math.min(connection.sharedInterests.length * 0.5, 4);

        // Add for interactions (max 5 points from this)
        strength += Math.min(connection.interactionCount * 0.2, 5);

        // Decay based on time since last interaction
        if (connection.lastInteraction) {
          const daysSinceInteraction =
            (Date.now() - new Date(connection.lastInteraction).getTime()) /
            (1000 * 60 * 60 * 24);
          strength *= Math.pow(0.95, Math.min(daysSinceInteraction, 30)); // Decay by 5% per day, max 30 days
        }

        // Cap at 0-10 range
        connection.connectionStrength = Math.max(0, Math.min(10, strength));
        this.inMemorySocialConnections.set(key, connection);
      }
    } else {
      try {
        // Get all connections
        const connections = await SocialConnection.find({
          status: "connected",
        }).exec();

        for (const connection of connections) {
          // Base strength from shared interests
          let strength = Math.min(connection.sharedInterests.length * 0.5, 4);

          // Add for interactions (max 5 points from this)
          strength += Math.min(connection.interactionCount * 0.2, 5);

          // Decay based on time since last interaction
          if (connection.lastInteraction) {
            const daysSinceInteraction =
              (Date.now() - connection.lastInteraction.getTime()) /
              (1000 * 60 * 60 * 24);
            strength *= Math.pow(0.95, Math.min(daysSinceInteraction, 30)); // Decay by 5% per day, max 30 days
          }

          // Cap at 0-10 range and update
          connection.connectionStrength = Math.max(0, Math.min(10, strength));
          await connection.save();
        }

        console.log(
          `Updated connection strengths for ${connections.length} connections`
        );
      } catch (error) {
        console.error("Error updating connection strengths:", error);
      }
    }
  }
}

// Singleton instance
export const socialService = new SocialService();
