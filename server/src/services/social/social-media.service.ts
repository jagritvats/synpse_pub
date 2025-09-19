import {
  MemorySource,
  MemoryType,
  MemoryImportance,
} from "../../models/memory.model";
import { memoryService } from "../memory.service";
import { aiService } from "../ai.service";

export interface SocialMediaPost {
  id: string;
  platform: string;
  content: string;
  author: string;
  timestamp: string;
  url?: string;
  likes?: number;
  shares?: number;
  comments?: number;
  metadata?: Record<string, any>;
}

export interface SocialMediaProfile {
  id: string;
  platform: string;
  username: string;
  displayName?: string;
  bio?: string;
  profileUrl?: string;
  avatarUrl?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isVerified?: boolean;
  metadata?: Record<string, any>;
}

export interface SocialMediaConnection {
  userId: string;
  platform: string;
  profileId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  isActive: boolean;
  lastSyncedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Base service for social media integrations
 */
class SocialMediaService {
  // Store user connections to social platforms
  private connections: Map<string, SocialMediaConnection[]> = new Map();

  /**
   * Add a social media connection for a user
   */
  addConnection(connection: SocialMediaConnection): void {
    const userId = connection.userId;
    const userConnections = this.connections.get(userId) || [];

    // Remove any existing connection to the same platform
    const filteredConnections = userConnections.filter(
      (conn) => conn.platform !== connection.platform
    );

    // Add the new connection
    filteredConnections.push(connection);
    this.connections.set(userId, filteredConnections);
  }

  /**
   * Get all social media connections for a user
   */
  getUserConnections(userId: string): SocialMediaConnection[] {
    return this.connections.get(userId) || [];
  }

  /**
   * Get a specific social media connection
   */
  getConnection(
    userId: string,
    platform: string
  ): SocialMediaConnection | undefined {
    const userConnections = this.connections.get(userId) || [];
    return userConnections.find((conn) => conn.platform === platform);
  }

  /**
   * Remove a social media connection
   */
  removeConnection(userId: string, platform: string): boolean {
    const userConnections = this.connections.get(userId) || [];
    const filteredConnections = userConnections.filter(
      (conn) => conn.platform !== platform
    );

    if (filteredConnections.length === userConnections.length) {
      return false; // No connection was removed
    }

    this.connections.set(userId, filteredConnections);
    return true;
  }

  /**
   * Check if a user has connected a specific platform
   */
  isConnected(userId: string, platform: string): boolean {
    const connection = this.getConnection(userId, platform);
    return !!connection && connection.isActive;
  }

  /**
   * Process social media posts to extract memories
   */
  async processPostsForMemories(
    userId: string,
    posts: SocialMediaPost[],
    platform: string
  ): Promise<void> {
    if (posts.length === 0) return;

    // Combine post content for analysis
    const postContent = posts
      .map((post) => `Post: ${post.content}`)
      .join("\n\n");

    // Use AI to extract key information from posts
    const prompt = `
      Analyze these social media posts and extract 2-3 key pieces of information that would be 
      important to remember about the user's interests, preferences, or activities.
      Focus on recurring themes, strong opinions, or significant events.
      Format each memory as a single sentence.
      
      Posts:
      ${postContent}
      
      Key information (respond with information only, no preamble or explanation):
    `;

    try {
      const response = await aiService.generateResponse(prompt);

      // Parse the response and create memories
      response.text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .forEach((content) => {
          memoryService.createMemory({
            userId,
            type: MemoryType.MEDIUM_TERM,
            content: content.trim(),
            source: MemorySource.SOCIAL_MEDIA,
            importance: MemoryImportance.MEDIUM,
            // Medium-term memories expire in 30 days
            expires: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            metadata: {
              platform,
              extractedFrom: "social_posts",
              postIds: posts.map((post) => post.id),
              extractionDate: new Date().toISOString(),
            },
          });
        });
    } catch (error) {
      console.error("Error extracting memories from social posts:", error);
    }
  }

  /**
   * Generate a summary of a user's social media activity
   */
  async generateSocialSummary(
    userId: string,
    platform?: string
  ): Promise<string> {
    // Get all memories from social media
    const memories = memoryService
      .getUserMemories(userId)
      .filter(
        (memory) =>
          memory.source === MemorySource.SOCIAL_MEDIA &&
          (!platform || memory.metadata?.platform === platform)
      );

    if (memories.length === 0) {
      return platform
        ? `No information available from ${platform}.`
        : "No information available from social media.";
    }

    const memoryContent = memories.map((m) => m.content).join("\n");

    // Generate a summary using AI
    const prompt = `
      Generate a brief summary of this user's social media activity and interests
      based on the following extracted information. Focus on key themes, interests,
      and patterns. Keep it concise (2-3 sentences).
      
      Extracted information:
      ${memoryContent}
      
      Summary:
    `;

    try {
      const response = await aiService.generateResponse(prompt);
      return response.text.trim();
    } catch (error) {
      console.error("Error generating social summary:", error);
      return "Unable to generate social media summary at this time.";
    }
  }

  /**
   * Find connections between social media interests and current context
   * This implements part of the "Serendipity Algorithm"
   */
  async findSerendipitousConnections(
    userId: string,
    context: string
  ): Promise<string[]> {
    // Get social media memories
    const socialMemories = memoryService
      .getUserMemories(userId)
      .filter((memory) => memory.source === MemorySource.SOCIAL_MEDIA);

    if (socialMemories.length === 0) {
      return [];
    }

    const memoryContent = socialMemories.map((m) => m.content).join("\n");

    // Use AI to find non-obvious connections
    const prompt = `
      Find 1-2 non-obvious, interesting connections between the user's social media interests
      and the current context. These should be surprising but relevant connections that the
      user might not immediately think of themselves.
      
      User's social media interests and activities:
      ${memoryContent}
      
      Current context:
      ${context}
      
      Non-obvious connections (respond with connections only, one per line):
    `;

    try {
      const response = await aiService.generateResponse(prompt);
      return response.text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.trim());
    } catch (error) {
      console.error("Error finding serendipitous connections:", error);
      return [];
    }
  }
}

// Create a singleton instance
export const socialMediaService = new SocialMediaService();
