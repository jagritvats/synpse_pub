import axios from "axios";import {
  SocialMediaPost,
  SocialMediaProfile,
  SocialMediaConnection,
} from "./social-media.service";
import { socialMediaService } from "./social-media.service";
import { memoryService } from "../memory.service";

/**
 * Service for Twitter/X integration
 */
class TwitterService {
  private API_BASE_URL = "https://api.twitter.com/2";

  /**
   * Connect a user's Twitter account
   */
  async connectAccount(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: string
  ): Promise<SocialMediaConnection> {
    try {
      // Get user profile to verify the token and get the profile ID
      const profile = await this.getUserProfile(accessToken);

      // Create connection
      const connection: SocialMediaConnection = {
        userId,
        platform: "twitter",
        profileId: profile.id,
        accessToken,
        refreshToken,
        expiresAt,
        isActive: true,
        lastSyncedAt: new Date().toISOString(),
        metadata: {
          username: profile.username,
          displayName: profile.displayName,
        },
      };

      // Store connection
      socialMediaService.addConnection(connection);

      return connection;
    } catch (error) {
      console.error("Error connecting Twitter account:", error);
      throw new Error(
        `Failed to connect Twitter account: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get a user's Twitter profile
   */
  async getUserProfile(accessToken: string): Promise<SocialMediaProfile> {
    try {
      const response = await axios.get(`${this.API_BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          "user.fields":
            "id,name,username,profile_image_url,description,public_metrics,verified",
        },
      });

      const userData = response.data.data;

      return {
        id: userData.id,
        platform: "twitter",
        username: userData.username,
        displayName: userData.name,
        bio: userData.description,
        profileUrl: `https://twitter.com/${userData.username}`,
        avatarUrl: userData.profile_image_url,
        followerCount: userData.public_metrics?.followers_count,
        followingCount: userData.public_metrics?.following_count,
        postCount: userData.public_metrics?.tweet_count,
        isVerified: userData.verified,
        metadata: {
          rawData: userData,
        },
      };
    } catch (error) {
      console.error("Error getting Twitter profile:", error);
      throw new Error(
        `Failed to get Twitter profile: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get a user's recent tweets
   */
  async getUserTweets(
    userId: string,
    count: number = 20
  ): Promise<SocialMediaPost[]> {
    const connection = socialMediaService.getConnection(userId, "twitter");
    if (!connection || !connection.isActive) {
      throw new Error("Twitter account not connected");
    }

    try {
      const response = await axios.get(
        `${this.API_BASE_URL}/users/${connection.profileId}/tweets`,
        {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            max_results: count,
            "tweet.fields": "created_at,public_metrics",
          },
        }
      );

      const tweets = response.data.data || [];

      return tweets.map((tweet: any) => ({
        id: tweet.id,
        platform: "twitter",
        content: tweet.text,
        author: connection.metadata?.username || "unknown",
        timestamp: tweet.created_at,
        url: `https://twitter.com/${connection.metadata?.username}/status/${tweet.id}`,
        likes: tweet.public_metrics?.like_count,
        shares: tweet.public_metrics?.retweet_count,
        comments: tweet.public_metrics?.reply_count,
        metadata: {
          rawData: tweet,
        },
      }));
    } catch (error) {
      console.error("Error getting Twitter posts:", error);
      throw new Error(
        `Failed to get Twitter posts: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get tweets from the user's timeline (home feed)
   */
  async getTimelineTweets(
    userId: string,
    count: number = 20
  ): Promise<SocialMediaPost[]> {
    const connection = socialMediaService.getConnection(userId, "twitter");
    if (!connection || !connection.isActive) {
      throw new Error("Twitter account not connected");
    }

    try {
      const response = await axios.get(
        `${this.API_BASE_URL}/users/${connection.profileId}/timelines/reverse_chronological`,
        {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            max_results: count,
            "tweet.fields": "created_at,public_metrics,author_id",
            expansions: "author_id",
            "user.fields": "username,name",
          },
        }
      );

      const tweets = response.data.data || [];
      const users = (response.data.includes?.users || []).reduce(
        (acc: any, user: any) => {
          acc[user._id] = user;
          return acc;
        },
        {}
      );

      return tweets.map((tweet: any) => {
        const author = users[tweet.author_id] || {};

        return {
          id: tweet.id,
          platform: "twitter",
          content: tweet.text,
          author: author.username || "unknown",
          timestamp: tweet.created_at,
          url: `https://twitter.com/${author.username}/status/${tweet.id}`,
          likes: tweet.public_metrics?.like_count,
          shares: tweet.public_metrics?.retweet_count,
          comments: tweet.public_metrics?.reply_count,
          metadata: {
            authorId: tweet.author_id,
            authorName: author.name,
            rawData: tweet,
          },
        };
      });
    } catch (error) {
      console.error("Error getting Twitter timeline:", error);
      throw new Error(
        `Failed to get Twitter timeline: ${(error as Error).message}`
      );
    }
  }

  /**
   * Sync a user's Twitter data and extract memories
   */
  async syncUserData(userId: string): Promise<void> {
    if (!socialMediaService.isConnected(userId, "twitter")) {
      throw new Error("Twitter account not connected");
    }

    try {
      // Get user's tweets
      const tweets = await this.getUserTweets(userId, 50);

      // Process tweets for memories
      await socialMediaService.processPostsForMemories(
        userId,
        tweets,
        "twitter"
      );

      // Get timeline tweets
      const timelineTweets = await this.getTimelineTweets(userId, 50);

      // Process timeline for interests
      await this.processTimelineForInterests(userId, timelineTweets);

      // Update last synced timestamp
      const connection = socialMediaService.getConnection(userId, "twitter");
      if (connection) {
        connection.lastSyncedAt = new Date().toISOString();
        socialMediaService.addConnection(connection);
      }
    } catch (error) {
      console.error("Error syncing Twitter data:", error);
      throw new Error(
        `Failed to sync Twitter data: ${(error as Error).message}`
      );
    }
  }

  /**
   * Process timeline tweets to extract user interests
   */
  private async processTimelineForInterests(
    userId: string,
    tweets: SocialMediaPost[]
  ): Promise<void> {
    // This would use AI to analyze the timeline and extract interests
    // For now, we'll just use the social media service's post processing
    await socialMediaService.processPostsForMemories(
      userId,
      tweets,
      "twitter_timeline"
    );
  }
}

// Create a singleton instance
export const twitterService = new TwitterService();
