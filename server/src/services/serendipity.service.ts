import { aiService } from "./ai.service";
import { ContextService, contextService } from "./context.service";
import { MemoryService, memoryService } from "./memory.service";
import { mongoVectorDbService } from "./mongo-vector-db.service";
import { socialMediaService } from "./social/social-media.service";
import { summaryService } from "./summary.service";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

/**
 * Interface for serendipity suggestion
 */
export interface SerendipitySuggestion {
  id: string;
  userId: string;
  content: string;
  type: string;
  relevanceScore: number;
  reasoning: string;
  createdAt: Date;
  expiresAt: Date;
  seen: boolean;
  actedOn: boolean;
  metadata: Record<string, any>;
}

/**
 * Interface for generation parameters
 */
export interface GenerationParams {
  maxSuggestions: number;
  creativity: number;
  priorityTypes: string[];
  minRelevanceScore: number;
}

/**
 * Creates the MongoDB schema for serendipity suggestions
 */
const SerendipitySuggestionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  type: { type: String, required: true, index: true },
  relevanceScore: { type: Number, required: true, min: 0, max: 1 },
  reasoning: String,
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true, index: true },
  seen: { type: Boolean, default: false },
  actedOn: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

// Create TTL index on expiresAt
SerendipitySuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Create model
const SerendipitySuggestionModel = mongoose.model(
  "SerendipitySuggestion",
  SerendipitySuggestionSchema
);

/**
 * Service for generating and managing serendipitous suggestions for users
 */
export class SerendipityService {
  private contextService: ContextService;
  private memoryService: MemoryService;

  // Default suggestion types
  private suggestionTypes = [
    "memory-recall",
    "content-recommendation",
    "learning-opportunity",
    "productivity-tip",
    "social-connection",
    "health-wellbeing",
    "creative-prompt",
    "reflection-question",
  ];

  constructor() {
    this.contextService = contextService;
    this.memoryService = memoryService;

    // Start scheduled cleanup
    setInterval(() => this.cleanupExpiredSuggestions(), 12 * 60 * 60 * 1000); // Twice a day
  }

  /**
   * Generate serendipitous suggestions based on user context and memories
   */
  async generateSuggestions(
    userId: string,
    params: Partial<GenerationParams> = {}
  ): Promise<SerendipitySuggestion[]> {
    // Set default parameters
    const finalParams: GenerationParams = {
      maxSuggestions: params.maxSuggestions || 3,
      creativity: params.creativity || 0.7,
      priorityTypes: params.priorityTypes || this.suggestionTypes,
      minRelevanceScore: params.minRelevanceScore || 0.6,
    };

    // Get user context
    const context = await this.contextService.getContext(userId);

    // Get relevant memories
    const memories = await this.memoryService.getRelevantMemories(
      userId,
      "", // No specific query, just get important memories
      10
    );

    // Get vector embeddings for recent interactions
    const recentVectorDocs = await mongoVectorDbService.searchSimilar(
      userId,
      "", // No specific query, just get recent docs
      "chat-message",
      5
    );

    // Build prompt for AI
    const prompt = `Generate ${finalParams.maxSuggestions} serendipitous suggestions for the user based on their context and memories.
Each suggestion should be relevant, timely, and valuable.

User Context:
${JSON.stringify(context, null, 2)}

Important Memories:
${memories.map((m) => `- ${m.text} (Importance: ${m.importance})`).join("\n")}

Recent Interactions:
${recentVectorDocs.map((r) => `- ${r.document.text}`).join("\n")}

Focus on these suggestion types: ${finalParams.priorityTypes.join(", ")}
Creativity level: ${finalParams.creativity} (0.0-1.0)

For each suggestion, provide:
1. Content: The actual suggestion text
2. Type: One of the suggestion types
3. Relevance: A score between 0-1 indicating how relevant this is
4. Reasoning: Why this suggestion is relevant now
5. Expiry: When this suggestion should expire (in hours)

Format as JSON array.`;

    try {
      // Generate suggestions with AI
      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        {
          temperature: finalParams.creativity,
          max_tokens: 1500,
          model: "gpt-4-turbo-preview", // Use appropriate model
        },
        "You are an AI specialized in creating personalized serendipitous suggestions for users based on their context and memories. Format output as valid JSON array."
      );

      let aiSuggestions;
      try {
        aiSuggestions = JSON.parse(response.text);
        if (!Array.isArray(aiSuggestions)) {
          aiSuggestions = [aiSuggestions]; // Handle case where AI returns a single object
        }
      } catch (error) {
        console.error("Error parsing AI suggestions:", error);
        return [];
      }

      // Process and store AI suggestions
      const validSuggestions = aiSuggestions
        .filter(
          (sugg) =>
            sugg.content &&
            sugg.type &&
            sugg.relevance >= finalParams.minRelevanceScore
        )
        .map((sugg) => {
          // Calculate expiry time (default to 24 hours if not provided)
          const expiryHours = sugg.expiry || 24;
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + expiryHours);

          // Create suggestion document
          const suggestion = new SerendipitySuggestionModel({
            userId,
            content: sugg.content,
            type: sugg.type,
            relevanceScore: sugg.relevance,
            reasoning: sugg.reasoning || "",
            createdAt: new Date(),
            expiresAt,
            seen: false,
            actedOn: false,
            metadata: {
              generationParams: finalParams,
              sourceContext: context.map((c) => c.type),
              sourceMemories: memories.length,
            },
          });

          // Save to database
          suggestion.save();

          // Also add to vector database for semantic search
          mongoVectorDbService.addDocument(
            userId,
            sugg.content,
            "serendipity-suggestion",
            suggestion._id.toString(),
            {
              type: sugg.type,
              relevanceScore: sugg.relevance,
              reasoning: sugg.reasoning,
            }
          );

          return {
            id: suggestion._id.toString(),
            userId,
            content: sugg.content,
            type: sugg.type,
            relevanceScore: sugg.relevance,
            reasoning: sugg.reasoning || "",
            createdAt: suggestion.createdAt,
            expiresAt,
            seen: false,
            actedOn: false,
            metadata: suggestion.metadata,
          };
        });

      return validSuggestions;
    } catch (error) {
      console.error("Error generating serendipity suggestions:", error);
      return [];
    }
  }

  /**
   * Get active suggestions for a user
   */
  async getSuggestions(
    userId: string,
    options: {
      onlyUnseen?: boolean;
      types?: string[];
      limit?: number;
    } = {}
  ): Promise<SerendipitySuggestion[]> {
    try {
      // Build query
      const query: any = {
        userId,
        expiresAt: { $gt: new Date() },
      };

      if (options.onlyUnseen) {
        query.seen = false;
      }

      if (options.types && options.types.length > 0) {
        query.type = { $in: options.types };
      }

      // Fetch from database
      const suggestions = await SerendipitySuggestionModel.find(query)
        .sort({ relevanceScore: -1, createdAt: -1 })
        .limit(options.limit || 10)
        .exec();

      return suggestions.map((sugg) => ({
        id: sugg._id.toString(),
        userId: sugg.userId,
        content: sugg.content,
        type: sugg.type,
        relevanceScore: sugg.relevanceScore,
        reasoning: sugg.reasoning,
        createdAt: sugg.createdAt,
        expiresAt: sugg.expiresAt,
        seen: sugg.seen,
        actedOn: sugg.actedOn,
        metadata: sugg.metadata,
      }));
    } catch (error) {
      console.error("Error getting serendipity suggestions:", error);
      return [];
    }
  }

  /**
   * Mark a suggestion as seen
   */
  async markSuggestionAsSeen(suggestionId: string): Promise<boolean> {
    try {
      const result = await SerendipitySuggestionModel.updateOne(
        { _id: suggestionId },
        { $set: { seen: true } }
      ).exec();

      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error marking suggestion as seen:", error);
      return false;
    }
  }

  /**
   * Mark a suggestion as acted on
   */
  async markSuggestionAsActedOn(suggestionId: string): Promise<boolean> {
    try {
      const result = await SerendipitySuggestionModel.updateOne(
        { _id: suggestionId },
        { $set: { actedOn: true } }
      ).exec();

      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error marking suggestion as acted on:", error);
      return false;
    }
  }

  /**
   * Delete a suggestion
   */
  async deleteSuggestion(suggestionId: string): Promise<boolean> {
    try {
      const result = await SerendipitySuggestionModel.deleteOne({
        _id: suggestionId,
      }).exec();

      // Also delete from vector DB if it exists
      await mongoVectorDbService.deleteUserDocuments(
        "", // We don't need userId since we're deleting by sourceId
        "serendipity-suggestion"
      );

      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting suggestion:", error);
      return false;
    }
  }

  /**
   * Update suggestion metadata
   */
  async updateSuggestionMetadata(
    suggestionId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      const result = await SerendipitySuggestionModel.updateOne(
        { _id: suggestionId },
        { $set: { metadata } }
      ).exec();

      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error updating suggestion metadata:", error);
      return false;
    }
  }

  /**
   * Clean up expired suggestions
   */
  private async cleanupExpiredSuggestions(): Promise<void> {
    try {
      const now = new Date();

      // Find expired suggestions
      const expiredSuggestions = await SerendipitySuggestionModel.find({
        expiresAt: { $lt: now },
      }).exec();

      // Log results
      console.log(
        `Cleaning up ${expiredSuggestions.length} expired serendipity suggestions`
      );

      // The TTL index should handle deletion automatically,
      // but we'll also clean up vector DB entries
      for (const suggestion of expiredSuggestions) {
        try {
          await mongoVectorDbService.deleteUserDocuments(
            suggestion.userId,
            "serendipity-suggestion"
          );
        } catch (error) {
          console.error(
            `Error cleaning up vector DB for suggestion ${suggestion._id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error cleaning up expired suggestions:", error);
    }
  }

  /**
   * Record user feedback on a suggestion
   */
  async recordFeedback(
    suggestionId: string,
    feedback: {
      rating: number;
      comment?: string;
      actedOn: boolean;
    }
  ): Promise<boolean> {
    try {
      // Find the suggestion
      const suggestion =
        await SerendipitySuggestionModel.findById(suggestionId).exec();

      if (!suggestion) {
        return false;
      }

      // Update the suggestion
      suggestion.actedOn = feedback.actedOn;
      suggestion.metadata = {
        ...suggestion.metadata,
        feedback: {
          rating: feedback.rating,
          comment: feedback.comment,
          timestamp: new Date(),
        },
      };

      await suggestion.save();

      // Add as a memory if it was valuable (rating > 3 on a 1-5 scale)
      if (feedback.rating > 3) {
        await this.memoryService.addMemory(
          suggestion.userId,
          `Serendipity suggestion: ${suggestion.content}`,
          "REFLECTION",
          "serendipity",
          {
            suggestionType: suggestion.type,
            rating: feedback.rating,
            actedOn: feedback.actedOn,
          }
        );
      }

      return true;
    } catch (error) {
      console.error("Error recording suggestion feedback:", error);
      return false;
    }
  }

  /**
   * Find connections between social media and personal data
   */
  async findCrossContextConnections(userId: string): Promise<any[]> {
    try {
      // Get social media summary
      const socialSummary =
        await socialMediaService.generateSocialSummary(userId);

      // Get user summary from summary service
      const userSummary = await summaryService.generateUserSummary(
        userId,
        "global",
        false // Use async mode
      );

      // Get current context
      const currentContext = await this.contextService.generateContext(
        true,
        true
      );

      // Build prompt for AI
      const prompt = `
        Find interesting connections between the user's social media activity and their personal data.
        
        SOCIAL MEDIA CONTEXT:
        ${socialSummary || "No social media data available."}
        
        USER CONTEXT:
        ${userSummary || "No user data available."}
        
        CURRENT CONTEXT:
        ${currentContext || "No current context available."}
        
        Generate 1-3 interesting connections that could provide value to the user.
        Format your response as a JSON array of objects with "title", "description", and "type" fields.
      `;

      // Generate connections with AI
      const response = await aiService.generateResponse(prompt);

      if (!response || !response.text) {
        return [];
      }

      // Parse JSON from the response
      try {
        const connections = JSON.parse(response.text);
        return Array.isArray(connections) ? connections : [connections];
      } catch (parseError) {
        console.error("Error parsing cross-context connections:", parseError);
        return [];
      }
    } catch (error) {
      console.error("Error generating cross-context connections:", error);
      return [];
    }
  }
}

// Export a singleton instance for use in other files
export const serendipityService = new SerendipityService();
