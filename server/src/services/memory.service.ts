import { v4 as uuidv4 } from "uuid";
import { vectorDbService } from "./vector-db.service";
import { Memory, IMemory } from "../models/memory.model";
// Import the enums but rename them to avoid conflicts
import {
  MemoryType as ModelMemoryType,
  MemoryCategory as ModelMemoryCategory,
} from "../models/memory.model";
import { VectorDocument } from "../models/vector-document.model";
import mongoose from "mongoose";
import { databaseService } from "../config/mongodb";
import { aiService } from "./ai.service";
import { modelEnum } from "../constants/models";
import { summaryService } from "./summary.service";

/**
 * Plain interface for memory data (without Mongoose Document fields)
 * Used for in-memory fallback representation.
 */
interface PlainMemoryData {
  _id: string; // Use _id consistent with DB
  id?: string; // Optional id if needed elsewhere
  userId: string;
  text: string;
  type: ModelMemoryType;
  source: string;
  metadata: Record<string, any>;
  importance: number;
  category: ModelMemoryCategory;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  expiresAt?: Date;
  isDeleted?: boolean;
}

/**
 * Interface for memory search results
 */
export interface MemorySearchResult {
  memory: IMemory;
  score: number;
}

/**
 * Memory types supported by the application
 */
export enum MemoryType {
  SHORT_TERM = ModelMemoryType.SHORT_TERM,
  MEDIUM_TERM = ModelMemoryType.MEDIUM_TERM,
  LONG_TERM = ModelMemoryType.LONG_TERM,
  PERMANENT = ModelMemoryType.PERMANENT,
}

/**
 * Memory categories for better organization and retrieval
 */
export enum MemoryCategory {
  CONVERSATION = "conversation",
  FACT = ModelMemoryCategory.FACT,
  PREFERENCE = ModelMemoryCategory.PREFERENCE,
  BEHAVIOR = ModelMemoryCategory.BEHAVIOR,
  RELATIONSHIP = "relationship",
  INTEREST = ModelMemoryCategory.INTEREST,
  CUSTOM = ModelMemoryCategory.CUSTOM,
}

/**
 * Service for managing user memories and knowledge
 */
export class MemoryService {
  private memoryExpirations: Record<MemoryType, number> = {
    [MemoryType.SHORT_TERM]: 60 * 60 * 1000, // 1 hour
    [MemoryType.MEDIUM_TERM]: 7 * 24 * 60 * 60 * 1000, // 7 days
    [MemoryType.LONG_TERM]: 90 * 24 * 60 * 60 * 1000, // 90 days
    [MemoryType.PERMANENT]: 0, // Never expires
  };

  // In-memory fallback storage for memories
  private inMemoryMemories: Map<string, PlainMemoryData[]> = new Map();

  private memoryDecayRate = 0.1; // 10% decay per day
  private maxMemoriesPerUser = 1000;
  private memoryPruningInterval = 24 * 60 * 60 * 1000; // 24 hours

  // Configuration for activity memory filtering
  private enableActivityMemoryFiltering: boolean = true; // Default to true

  constructor() {
    console.log("Initializing memory service");
    // Subscribe to database connection events
    databaseService.on("connected", () => {
      console.log("Memory service detected MongoDB connection");
    });

    databaseService.on("disconnected", () => {
      console.log(
        "Memory service detected MongoDB disconnection - will use in-memory fallback"
      );
    });

    // Comment out pruning for now
    // this.startMemoryPruning();
  }

  /* // Commenting out prune logic as it depends on non-existent methods
  private startMemoryPruning() {
    setInterval(async () => {
      try {
        await this.pruneMemories();
      } catch (error) {
        console.error("Error pruning memories:", error);
      }
    }, this.memoryPruningInterval);
  }

  private async pruneMemories() {
    // Needs implementation of getAllUsers and deleteMemories (plural)
    // const users = await this.getAllUsers();
    // for (const user of users) {
    //   const memories = await this.getMemories(user.id);
    //   if (memories.length > this.maxMemoriesPerUser) {
    //     const sortedMemories = memories.sort((a, b) => ...);
    //     const memoriesToDelete = sortedMemories.slice(this.maxMemoriesPerUser);
    //     await this.deleteMemories(memoriesToDelete.map((m) => m.id));
    //   }
    // }
    console.warn("Memory pruning is currently disabled.");
  }
  */

  private async decayMemoryImportance(memory: IMemory) {
    const daysSinceCreation = Math.floor(
      (Date.now() - (memory.createdAt?.getTime() ?? Date.now())) /
        (24 * 60 * 60 * 1000)
    );
    const initialImportance = memory.importance ?? 5;
    const decayedImportance =
      initialImportance * Math.pow(1 - this.memoryDecayRate, daysSinceCreation);
    return Math.max(decayedImportance, 0.1); // Minimum importance of 0.1
  }

  /**
   * Configure activity memory filtering behavior
   */
  setActivityMemoryFiltering(enabled: boolean): void {
    this.enableActivityMemoryFiltering = enabled;
    console.log(
      `Activity memory filtering ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Get activity memory filtering configuration status
   */
  isActivityMemoryFilteringEnabled(): boolean {
    return this.enableActivityMemoryFiltering;
  }

  /**
   * Add a new memory for a user
   */
  async addMemory(
    userId: string,
    text: string,
    type: MemoryType = MemoryType.MEDIUM_TERM,
    source: string = "user",
    metadata: Record<string, any> = {},
    importance: number = 5,
    category: MemoryCategory = MemoryCategory.FACT
  ): Promise<IMemory> {
    try {
      // Check MongoDB connection first
      if (!databaseService.isConnected()) {
        console.warn(
          "MongoDB not connected during addMemory - using in-memory fallback"
        );

        // Add to in-memory storage
        const memoryId = uuidv4();
        const memory: PlainMemoryData = {
          _id: memoryId,
          userId,
          text,
          type: this.mapToModelType(type),
          source,
          metadata,
          importance,
          category: this.mapToModelCategory(category),
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
          isDeleted: false,
        };

        if (!this.inMemoryMemories.has(userId)) {
          this.inMemoryMemories.set(userId, []);
        }

        this.inMemoryMemories.get(userId)?.push(memory);
        return memory as IMemory;
      }

      // Calculate expiration date based on memory type
      const expirationMs = this.memoryExpirations[type];
      const expiresAt = expirationMs
        ? new Date(Date.now() + expirationMs)
        : undefined;

      // Map our service enum values to the model enum values if needed
      const modelCategory = this.mapToModelCategory(category);
      const modelType = this.mapToModelType(type);

      // Create the memory document
      const memoryDoc = new Memory({
        userId,
        text,
        type: modelType,
        source,
        metadata,
        importance,
        category: modelCategory,
        expiresAt,
        createdAt: new Date(),
        accessCount: 0,
      });

      const savedMemory = await memoryDoc.save();

      // Add to vector database for semantic search
      try {
        const vectorDoc = new VectorDocument({
          userId,
          text,
          // In production, you would generate a real embedding here using an embedding model
          embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
          metadata: {
            memoryId: savedMemory._id,
            type: modelType,
            category: modelCategory,
            importance,
          },
          type: "memory",
          sourceId: savedMemory._id,
        });

        await vectorDoc.save();
      } catch (error) {
        console.error("Error adding memory to vector database:", error);
      }

      console.log(`Added memory for user ${userId}: ${savedMemory._id}`);
      return savedMemory.toObject() as IMemory;
    } catch (error) {
      console.error("Error adding memory:", error);
      throw error;
    }
  }

  /**
   * Map service MemoryCategory to model ModelMemoryCategory
   */
  private mapToModelCategory(category: MemoryCategory): ModelMemoryCategory {
    switch (category) {
      case MemoryCategory.FACT:
        return ModelMemoryCategory.FACT;
      case MemoryCategory.PREFERENCE:
        return ModelMemoryCategory.PREFERENCE;
      case MemoryCategory.BEHAVIOR:
        return ModelMemoryCategory.BEHAVIOR;
      case MemoryCategory.INTEREST:
        return ModelMemoryCategory.INTEREST;
      case MemoryCategory.CUSTOM:
        return ModelMemoryCategory.CUSTOM;
      case MemoryCategory.CONVERSATION:
        // Handle categories that don't directly map
        return ModelMemoryCategory.CUSTOM;
      case MemoryCategory.RELATIONSHIP:
        // Handle categories that don't directly map
        return ModelMemoryCategory.CUSTOM;
      default:
        return ModelMemoryCategory.CUSTOM;
    }
  }

  /**
   * Map service MemoryType to model ModelMemoryType
   */
  private mapToModelType(type: MemoryType): ModelMemoryType {
    switch (type) {
      case MemoryType.SHORT_TERM:
        return ModelMemoryType.SHORT_TERM;
      case MemoryType.MEDIUM_TERM:
        return ModelMemoryType.MEDIUM_TERM;
      case MemoryType.LONG_TERM:
        return ModelMemoryType.LONG_TERM;
      case MemoryType.PERMANENT:
        return ModelMemoryType.PERMANENT;
      default:
        return ModelMemoryType.MEDIUM_TERM;
    }
  }

  /**
   * Get all memories for a user
   */
  async getUserMemories(userId: string, type?: MemoryType): Promise<IMemory[]> {
    const query: any = { userId };

    if (type) {
      query.type = this.mapToModelType(type);
    }

    // Get memories, sorted by importance and date
    const memories = await Memory.find(query)
      .sort({ importance: -1, createdAt: -1 })
      .lean()
      .exec();
    return memories as IMemory[];
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId: string): Promise<IMemory | null> {
    const memory = await Memory.findById(memoryId).lean().exec();
    return memory as IMemory | null;
  }

  /**
   * Update a memory's properties
   */
  async updateMemory(
    memoryId: string,
    updates: Partial<IMemory>
  ): Promise<IMemory | null> {
    // Update the memory in MongoDB
    const updatedMemory = await Memory.findByIdAndUpdate(
      memoryId,
      { $set: updates },
      { new: true }
    )
      .lean()
      .exec();

    if (!updatedMemory) {
      return null;
    }

    // If the text changed, update the vector database
    if (updates.text) {
      try {
        // Find the vector document for this memory
        const vectorDoc = await VectorDocument.findOne({
          type: "memory",
          sourceId: memoryId,
        }).exec();

        if (vectorDoc) {
          vectorDoc.text = updates.text;
          // In production, you would regenerate the embedding here
          vectorDoc.embedding = Array.from(
            { length: 384 },
            () => Math.random() * 2 - 1
          );
          await vectorDoc.save();
        }
      } catch (error) {
        console.error("Error updating memory in vector database:", error);
      }
    }

    return updatedMemory as IMemory | null;
  }

  /**
   * Hard delete a memory by ID
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      // Delete from MongoDB
      const result = await Memory.findByIdAndDelete(memoryId).exec();

      if (!result) {
        return false;
      }

      // Delete from vector database
      await VectorDocument.deleteOne({
        type: "memory",
        sourceId: memoryId,
      }).exec();

      return true;
    } catch (error) {
      console.error("Error deleting memory:", error);
      return false;
    }
  }

  /**
   * Soft delete a memory by ID (mark as deleted)
   */
  async softDeleteMemory(memoryId: string): Promise<boolean> {
    try {
      // Mark memory as deleted
      const result = await Memory.findByIdAndUpdate(
        memoryId,
        { isDeleted: true },
        { new: true }
      ).exec();

      if (!result) {
        return false;
      }

      // Mark related vector document as deleted
      await VectorDocument.updateOne(
        {
          type: "memory",
          sourceId: memoryId,
        },
        { isDeleted: true }
      ).exec();

      return true;
    } catch (error) {
      console.error("Error soft-deleting memory:", error);
      return false;
    }
  }

  /**
   * Restore a soft-deleted memory
   */
  async restoreMemory(memoryId: string): Promise<boolean> {
    try {
      // Mark memory as not deleted
      const result = await Memory.findByIdAndUpdate(
        memoryId,
        { isDeleted: false },
        { new: true }
      ).exec();

      if (!result) {
        return false;
      }

      // Mark related vector document as not deleted
      await VectorDocument.updateOne(
        {
          type: "memory",
          sourceId: memoryId,
        },
        { isDeleted: false }
      ).exec();

      return true;
    } catch (error) {
      console.error("Error restoring memory:", error);
      return false;
    }
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllUserMemories(userId: string): Promise<number> {
    try {
      // Delete from MongoDB
      const deleteResult = await Memory.deleteMany({ userId }).exec();

      // Delete from vector database
      await VectorDocument.deleteMany({
        userId,
        type: "memory",
      }).exec();

      return deleteResult.deletedCount || 0;
    } catch (error) {
      console.error("Error deleting user memories:", error);
      return 0;
    }
  }

  /**
   * Get relevant memories based on a query
   */
  async getRelevantMemories(
    userId: string,
    query: string,
    limit: number = 5,
    options: {
      activeActivityId?: string;
      filterByActivity?: boolean;
      activityRelevanceBoost?: number;
      includeDeleted?: boolean;
    } = {}
  ): Promise<MemorySearchResult[]> {
    try {
      // Default values for options
      let filterByActivity =
        options.filterByActivity ?? this.enableActivityMemoryFiltering;
      const activityRelevanceBoost = options.activityRelevanceBoost ?? 0.5;
      const activeActivityId = options.activeActivityId;
      const includeDeleted = options.includeDeleted ?? false;

      // If activity filtering is disabled globally, override the option
      if (!this.enableActivityMemoryFiltering) {
        filterByActivity = false;
      }

      // Get all user memories or filter by activity
      let memories: IMemory[] = [];

      // First, get activity summaries regardless of other filters
      // These are always relevant and should be included
      const activitySummariesQuery: any = {
        userId,
        source: "activity-summary-service",
      };

      // Only filter out deleted memories if includeDeleted is false
      if (!includeDeleted) {
        activitySummariesQuery.isDeleted = { $ne: true };
      }

      const activitySummaries = await Memory.find(activitySummariesQuery)
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      // Get regular memories (possibly filtered by activity)
      let regularMemoriesQuery: any = {
        userId,
      };

      // Only filter out deleted memories if includeDeleted is false
      if (!includeDeleted) {
        regularMemoriesQuery.isDeleted = { $ne: true };
      }

      if (filterByActivity && activeActivityId) {
        // Filter to only include memories related to this activity
        console.debug(
          `[MemoryService] Filtering memories for activity ${activeActivityId}`
        );
        regularMemoriesQuery["$or"] = [
          { "metadata.activityId": activeActivityId },
          { source: "activity-summary-service" }, // Always include summaries
        ];
      } else if (filterByActivity) {
        // Filter to only include non-activity memories
        console.debug(
          `[MemoryService] Filtering out activity-related memories for normal session`
        );
        regularMemoriesQuery["$or"] = [
          { "metadata.activityId": { $exists: false } },
          { source: "activity-summary-service" }, // Always include summaries
        ];
      } else {
        console.debug(
          `[MemoryService] Activity memory filtering disabled, including all memories`
        );
      }

      const regularMemories = await Memory.find(regularMemoriesQuery)
        .sort({ importance: -1, createdAt: -1 })
        .lean()
        .exec();

      // Combine both sets
      memories = [...activitySummaries, ...regularMemories];

      if (memories.length === 0) {
        return [];
      }

      // Perform basic keyword matching
      const keywords = query.toLowerCase().split(/\s+/);

      // Calculate relevance scores based on keyword matches
      const results = memories.map((memory: IMemory) => {
        const text = memory.text.toLowerCase();
        let score = 0;

        // Check for keyword matches
        keywords.forEach((keyword) => {
          if (keyword.length > 3 && text.includes(keyword)) {
            score += 0.2;
          }
        });

        // Add importance-based score
        score += (memory.importance || 5) / 20;

        // Boost activity-summary-service memories
        if (memory.source === "activity-summary-service") {
          score += 0.2; // Always boost summaries
        }

        // Add activity context boost if applicable
        if (
          activeActivityId &&
          memory.metadata?.activityId === activeActivityId
        ) {
          score += activityRelevanceBoost;
        } else if (
          filterByActivity &&
          activeActivityId &&
          memory.metadata?.activityId &&
          memory.metadata.activityId !== activeActivityId
        ) {
          // Reduce score for memories from other activities
          score *= 0.5;
        }

        return { memory, score };
      });

      // Filter out low-scoring results and sort by score
      return results
        .filter((result) => result.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error("Error getting relevant memories:", error);
      return [];
    }
  }

  /**
   * Add a memory based on AI-generated insight
   */
  async addAIGeneratedMemory(
    userId: string,
    text: string,
    type: MemoryType = MemoryType.MEDIUM_TERM,
    category: MemoryCategory = MemoryCategory.FACT,
    importance: number = 7,
    relatedMemories: string[] = []
  ): Promise<IMemory> {
    return this.addMemory(
      userId,
      text,
      type,
      "ai-generated",
      {
        relatedMemories,
        isAIGenerated: true,
        confidence: 0.85,
      },
      importance,
      category
    );
  }

  /**
   * Record memory access - updates lastAccessed and accessCount
   */
  async recordMemoryAccess(memoryId: string): Promise<IMemory | null> {
    const memory = await Memory.findByIdAndUpdate(
      memoryId,
      {
        $set: { lastAccessed: new Date() },
        $inc: { accessCount: 1 },
      },
      { new: true }
    )
      .lean()
      .exec();
    return memory as IMemory | null;
  }

  /**
   * Cleanup expired memories that might have missed TTL index
   */
  private async cleanupExpiredMemories(): Promise<void> {
    try {
      const now = new Date();
      const result = await Memory.deleteMany({
        expiresAt: { $lt: now },
      }).exec();

      if (result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} expired memories`);
      }
    } catch (error) {
      console.error("Error cleaning up expired memories:", error);
    }
  }

  /**
   * Get memories by userId and optional type
   */
  async getMemories(
    userId: string,
    type?: MemoryType,
    onlyActive: boolean = true
  ): Promise<IMemory[]> {
    try {
      // Check if MongoDB is connected
      if (!databaseService.isConnected()) {
        console.warn(
          "MongoDB not connected - using in-memory fallback for getMemories"
        );

        // Return from in-memory storage
        const userMemories = this.inMemoryMemories.get(userId) || [];

        // Filter the PlainMemoryData array
        return userMemories.filter((memory: PlainMemoryData) => {
          if (type && memory.type !== type) return false;
          if (onlyActive && memory.isDeleted === true) return false; // Check against true
          return true;
        }) as IMemory[];
      }

      // MongoDB is connected, use it
      const query: any = { userId };

      if (type) {
        query.type = this.mapToModelType(type);
      }

      if (onlyActive) {
        query.isDeleted = { $ne: true };
      }

      // Execute query
      const results = await Memory.find(query)
        .sort({ importance: -1, createdAt: -1 })
        .lean()
        .exec();

      return results as IMemory[];
    } catch (error) {
      console.error("Error getting memories:", error);
      return [];
    }
  }

  /* // Commenting out searchMemories as calculateSimilarity is not implemented
  async searchMemories(
    userId: string,
    query: string,
    options: {
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<IMemory[]> { // Use IMemory
    // ... implementation ...
  }

  private async calculateSemanticSimilarity(
    query: string,
    content: string
  ): Promise<number> {
    // Needs implementation in aiService
    // const similarity = await aiService.calculateSimilarity(query, content);
    // return similarity;
    console.warn("calculateSemanticSimilarity is not implemented.");
    return 0; // Placeholder
  }
  */

  /**
   * Generates a concise summary of the user based on their memories.
   * This now forwards to the dedicated summaryService to avoid duplication.
   */
  async generateUserSummary(userId: string): Promise<string> {
    console.log(
      `Forwarding user summary request to summaryService for user ${userId}`
    );
    try {
      // Forward to the summary service to avoid duplication
      return await summaryService.generateUserSummary(
        userId,
        "global",
        false // Use async mode by default
      );
    } catch (error) {
      console.error(`Error generating user summary for ${userId}:`, error);
      return "Error generating summary."; // Return error indicator
    }
  }

  /**
   * @stub - Placeholder for retrieving memories specifically associated with an activity.
   * Needs proper implementation (e.g., filtering by activityId in metadata).
   */
  async getActivityMemories(
    userId: string,
    activityId: string,
    query: string,
    limit: number = 10,
    includeDeleted: boolean = false
  ): Promise<MemorySearchResult[]> {
    console.debug(
      `[MemoryService.getActivityMemories] Getting memories for activity ${activityId}, query: ${query.substring(0, 50)}...`
    );
    try {
      // Build the query
      const memoryQuery: any = {
        userId: userId,
        "metadata.activityId": activityId, // Query nested field
      };

      // Only filter out deleted memories if includeDeleted is false
      if (!includeDeleted) {
        memoryQuery.isDeleted = { $ne: true };
      }

      // Fetch memories associated with the activity ID
      const activityMemories = await Memory.find(memoryQuery)
        .sort({ createdAt: -1 }) // Fetch recent ones first
        .limit(limit * 2) // Fetch more initially for better relevance filtering
        .lean()
        .exec();

      if (!activityMemories || activityMemories.length === 0) {
        return [];
      }

      // Perform basic keyword matching for relevance scoring
      const keywords = query.toLowerCase().split(/\s+/);
      const results = activityMemories.map((memory: IMemory) => {
        const text = memory.text.toLowerCase();
        let score = 0;

        // Keyword matching score
        keywords.forEach((keyword) => {
          if (keyword.length > 2 && text.includes(keyword)) {
            score += 0.2;
          }
        });

        // Add importance-based score (normalized)
        score += (memory.importance || 5) / 20; // Max 0.5 from importance

        // Add recency boost (e.g., within last hour)
        const memoryTime = memory.createdAt?.getTime() || 0;
        if (Date.now() - memoryTime < 60 * 60 * 1000) {
          score += 0.1;
        }

        return { memory, score };
      });

      // Filter out very low-scoring results and sort by final score
      return results
        .filter((result) => result.score > 0.1) // Basic threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error(
        `Error getting activity memories for ${activityId}:`,
        error
      );
      return []; // Ensure return in catch block
    }
  }
}

export const memoryService = new MemoryService();

// Removed conflicting re-export
// export { ModelMemoryType as MemoryType, ModelMemoryCategory as MemoryCategory };
