import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { Context, IContext } from "../models/context.model";
import { ContextType } from "../interfaces/context-type.enum";
import { ContextDuration } from "../interfaces/context-duration.enum";
import {
  TimeContext,
  WeatherContext,
  LocationContext,
  EmotionContext,
  CompanionEmotionContext,
  UserNotesContext,
  ThoughtLoopContext,
  EngagementSuggestionContext,
  SocialContext,
  ActionContext,
} from "../interfaces/context.interface";
import { actionManager } from "./action-manager.service";
import { socialService } from "./social.service";
import mongoose from "mongoose";
import { databaseService } from "../config/mongodb";
import { memoryService, MemorySearchResult } from "./memory.service";
import {
  SELF_AWARENESS_PROMPT,
  FAKE_ETHICS_PROMPT,
  BASE_COMPANION_PROMPT,
  BEHAVIOR_PROMPT,
  SUBTLE_BEHAVIOR_PROMPT,
  ANTI_SLOP_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  RELEVANT_MEMORIES_PROMPT_SUFFIX,
} from "../constants/prompts";
import { companionStateService } from "./companion-state.service";
import {
  ChatMessage,
  MessageRole,
  ChatMessageModel,
} from "../models/chat.model";
import { userStateService } from "./user-state.service";
import { ICompanionState, IGoal } from "../models/companion-state.model";
import { IUserInterest, IUserGoal } from "../models/user-state.model";
import {
  IActivity,
  ActivityType,
  IRoleplayState,
  IGameState,
  IBrainstormState,
} from "../models/activity.model";
import { aiService } from "./ai.service";
import { loggerFactory } from "../utils/logger.service";
import { modelEnum } from "../constants/models";
import { summaryService } from "./summary.service";

interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
  humidity?: number;
  windSpeed?: number;
}

/**
 * Service for managing dynamic context
 */
export class ContextService {
  // Define logger at class level
  private logger = loggerFactory.getLogger("ContextService");

  // Default expiration times in milliseconds based on duration
  private readonly expirationTimes = {
    [ContextDuration.IMMEDIATE]: 5 * 60 * 1000, // 5 minutes
    [ContextDuration.SHORT_TERM]: 60 * 60 * 1000, // 1 hour
    [ContextDuration.MEDIUM_TERM]: 24 * 60 * 60 * 1000, // 1 day
    [ContextDuration.LONG_TERM]: 7 * 24 * 60 * 60 * 1000, // 7 days
    [ContextDuration.PERMANENT]: null, // Never expires
  };

  // In-memory fallback for when MongoDB is unavailable
  private inMemoryContexts: Map<string, IContext> = new Map();
  private useInMemoryFallback: boolean = false;

  constructor() {
    // Initialize in-memory fallback storage
    this.inMemoryContexts = new Map();
    console.log("Context service initialized");

    // Subscribe to MongoDB connection events
    databaseService.on("connected", () => {
      console.log(
        "Context service: MongoDB connected, disabling in-memory fallback"
      );
      this.useInMemoryFallback = false;
    });

    databaseService.on("disconnected", () => {
      console.log(
        "Context service: MongoDB disconnected, enabling in-memory fallback"
      );
      this.useInMemoryFallback = true;
    });
  }

  /**
   * Inject a new context item into the system
   */
  async injectContext(
    userId: string,
    type: ContextType,
    duration: ContextDuration,
    data: any,
    source: string = "system",
    metadata?: Record<string, any>
  ): Promise<any> {
    // Calculate expiration date based on duration
    const expirationMs = this.expirationTimes[duration];
    const expiresAt = expirationMs
      ? new Date(Date.now() + expirationMs)
      : undefined;

    const contextDoc = {
      userId,
      type,
      duration,
      data,
      createdAt: new Date(),
      expiresAt,
      source,
      metadata: metadata || {},
      isActive: true,
    };

    if (this.useInMemoryFallback) {
      // Store in memory with proper type handling for _id
      const id = uuidv4();
      const inMemoryContext = {
        ...contextDoc,
        _id: id,
      } as IContext;
      this.inMemoryContexts.set(
        id, // Use id directly instead of toString
        inMemoryContext
      );
      return inMemoryContext;
    } else {
      // Store in MongoDB
      try {
        const context = new Context(contextDoc);
        await context.save();
        return context;
      } catch (error) {
        console.error(
          "Error saving context to MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.injectContext(
          userId,
          type,
          duration,
          data,
          source,
          metadata
        );
      }
    }
  }

  /**
   * Get context items for a user
   */
  async getContext(
    userId: string,
    type?: ContextType,
    onlyActive: boolean = true
  ): Promise<any[]> {
    console.log(
      `Getting context for user ${userId}, type: ${type || "all"}, onlyActive: ${onlyActive}`
    );

    const now = new Date();

    // Check MongoDB connection status and update fallback flag if needed
    if (!this.useInMemoryFallback) {
      this.useInMemoryFallback = !databaseService.isConnected();
    }

    if (this.useInMemoryFallback) {
      console.log(`Using in-memory context fallback for user ${userId}`);
      // Get from in-memory store
      const results = Array.from(this.inMemoryContexts.values())
        .filter((context) => {
          // Filter by user ID
          if (context.userId !== userId) return false;

          // Filter by type if specified
          if (type && context.type !== type) return false;

          // Filter out expired context if onlyActive is true
          if (onlyActive && context.expiresAt && context.expiresAt < now) {
            return false;
          }

          // Filter out inactive context if onlyActive is true
          if (onlyActive && !context.isActive) return false;

          return true;
        })
        .sort((a, b) => {
          // Sort by creation date, newest first
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

      console.log(
        `Found ${results.length} in-memory context items for user ${userId}`
      );
      return results;
    }

    // Get from MongoDB
    try {
      console.log(`Using MongoDB for context retrieval for user ${userId}`);
      // Build query
      const query: any = { userId };

      if (type) {
        query.type = type;
      }

      if (onlyActive) {
        query.isActive = true;
        query.$or = [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: now } },
        ];
      }

      // Add timeout to the MongoDB operation
      const timeoutPromise = new Promise<any[]>((_, reject) => {
        setTimeout(() => {
          reject(new Error("MongoDB operation timeout after 5000ms"));
        }, 5000);
      });

      // Execute query with timeout
      const queryPromise = Context.find(query).sort({ createdAt: -1 }).exec();

      // Race between the query and the timeout
      const results = await Promise.race([queryPromise, timeoutPromise]);

      console.log(
        `Found ${results.length} MongoDB context items for user ${userId}${type ? ` with type ${type}` : ""}`
      );

      // Save the results in memory as a cache/fallback
      if (results.length > 0) {
        for (const result of results) {
          // Only add if not already in memory
          if (!this.inMemoryContexts.has(result._id.toString())) {
            this.inMemoryContexts.set(result._id.toString(), result);
          }
        }
        console.log(`Cached ${results.length} MongoDB context items in memory`);
      }

      return results;
    } catch (error) {
      console.error(
        `Error getting context from MongoDB for user ${userId}, falling back to in-memory:`,
        error
      );
      this.useInMemoryFallback = true;
      // Return in-memory results instead of recursing to avoid potential stack overflow
      return Array.from(this.inMemoryContexts.values())
        .filter((context) => {
          if (context.userId !== userId) return false;
          if (type && context.type !== type) return false;
          if (onlyActive && context.expiresAt && context.expiresAt < now)
            return false;
          if (onlyActive && !context.isActive) return false;
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  }

  /**
   * Remove a specific context by ID
   */
  async removeContext(contextId: string): Promise<boolean> {
    if (this.useInMemoryFallback) {
      return this.inMemoryContexts.delete(contextId);
    } else {
      try {
        const result = await Context.findByIdAndDelete(contextId).exec();
        return !!result;
      } catch (error) {
        console.error(
          "Error removing context from MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        // Try to remove from in-memory store (though it might not exist there)
        return this.inMemoryContexts.delete(contextId);
      }
    }
  }

  /**
   * Update an existing context
   */
  async updateContext(
    contextId: string,
    updates: Partial<any>
  ): Promise<IContext | null> {
    if (this.useInMemoryFallback) {
      const existingContext = this.inMemoryContexts.get(contextId);
      if (!existingContext) {
        console.warn(
          `[ContextService] Context ${contextId} not found in fallback memory for update.`
        );
        return null;
      }

      // Update properties of the existing IContext object
      Object.assign(existingContext, updates); // Apply updates directly
      existingContext.updatedAt = new Date(); // Update timestamp

      // No need to set it back in the map, as we modified the object in place
      // this.inMemoryContexts.set(contextId, existingContext);

      return existingContext; // Return the updated object
    } else {
      try {
        // When using DB, findByIdAndUpdate returns the Mongoose document
        const dbUpdate = await Context.findByIdAndUpdate(
          contextId,
          { $set: { ...updates, updatedAt: new Date() } },
          { new: true }
        ).exec();

        // Update fallback cache if DB update was successful
        if (dbUpdate) {
          // Store the actual Mongoose document in the fallback cache
          this.inMemoryContexts.set(contextId, dbUpdate);
        }

        return dbUpdate;
      } catch (error) {
        console.error(
          "Error updating context in MongoDB, falling back to in-memory retry:",
          error
        );
        this.useInMemoryFallback = true;
        // Retry the update using the in-memory logic - potential infinite loop if fallback fails
        // Consider adding a retry limit or different error handling here
        // Note: Retrying might still fail if the context wasn't originally cached.
        return this.updateContext(contextId, updates);
      }
    }
  }

  /**
   * Deactivate a context item
   */
  async deactivateContext(contextId: string): Promise<boolean> {
    if (this.useInMemoryFallback) {
      const context = this.inMemoryContexts.get(contextId);
      if (!context) {
        return false;
      }

      context.isActive = false;
      this.inMemoryContexts.set(contextId, context);
      return true;
    } else {
      try {
        const result = await Context.findByIdAndUpdate(contextId, {
          $set: { isActive: false },
        }).exec();
        return !!result;
      } catch (error) {
        console.error(
          "Error deactivating context in MongoDB, falling back to in-memory:",
          error
        );
        this.useInMemoryFallback = true;
        return this.deactivateContext(contextId);
      }
    }
  }

  /**
   * Get current time information and inject as context
   */
  async getTimeContext(userId: string): Promise<any> {
    const now = new Date();
    const hours = now.getHours();

    // Determine time of day
    let timeOfDay: string;
    if (hours >= 5 && hours < 12) {
      timeOfDay = "morning";
    } else if (hours >= 12 && hours < 17) {
      timeOfDay = "afternoon";
    } else if (hours >= 17 && hours < 21) {
      timeOfDay = "evening";
    } else {
      timeOfDay = "night";
    }

    // Get day of week
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayOfWeek = daysOfWeek[now.getDay()];

    // Format date
    const date = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const timeData: TimeContext = {
      localTime: now.toLocaleTimeString("en-US"),
      timeOfDay,
      dayOfWeek,
      date,
      timestamp: now.getTime(),
    };

    // Inject as a time context with short-term duration
    return this.injectContext(
      userId,
      ContextType.TIME,
      ContextDuration.SHORT_TERM,
      timeData,
      "time-service"
    );
  }

  /**
   * Get weather information for a location and inject as context
   */
  async getWeatherContext(
    userId: string,
    location: string = "New York"
  ): Promise<any | null> {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      console.warn("Weather API key not found");
      return null;
    }

    try {
      // Use a weather API to get weather data
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          location
        )}&units=metric&appid=${apiKey}`
      );

      const weatherData: WeatherData = {
        temperature: response.data.main.temp,
        condition: response.data.weather[0].main,
        location: response.data.name,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed,
      };

      // Inject as a weather context with medium-term duration
      return this.injectContext(
        userId,
        ContextType.WEATHER,
        ContextDuration.MEDIUM_TERM,
        weatherData,
        "weather-service"
      );
    } catch (error) {
      console.error("Error fetching weather data:", error);
      return null;
    }
  }

  /**
   * Inject user location context
   */
  async injectLocationContext(
    userId: string,
    location: LocationContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.LOCATION,
      ContextDuration.SHORT_TERM,
      location,
      "location-service"
    );
  }

  /**
   * Inject user emotion context
   */
  async injectUserEmotion(
    userId: string,
    emotion: EmotionContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.EMOTION,
      ContextDuration.MEDIUM_TERM,
      emotion,
      "emotion-detection",
      { isUserEmotion: true }
    );
  }

  /**
   * Inject companion emotion context
   */
  async injectCompanionEmotion(
    userId: string,
    emotion: CompanionEmotionContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.EMOTION,
      ContextDuration.MEDIUM_TERM,
      emotion,
      "companion-state",
      { isCompanionEmotion: true }
    );
  }

  /**
   * Inject user notes or tasks
   */
  async injectUserNotes(
    userId: string,
    notes: UserNotesContext | UserNotesContext[]
  ): Promise<any | any[]> {
    const notesArray = Array.isArray(notes) ? notes : [notes];

    return Promise.all(
      notesArray.map((note) =>
        this.injectContext(
          userId,
          ContextType.PRODUCTIVITY,
          ContextDuration.LONG_TERM,
          note,
          "user-notes"
        )
      )
    );
  }

  /**
   * Inject social context for user
   */
  async injectSocialContext(
    userId: string,
    socialData: SocialContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.SOCIAL_MEDIA,
      ContextDuration.MEDIUM_TERM,
      socialData,
      "social-service"
    );
  }

  /**
   * Inject thought loop context
   */
  async injectThoughtLoop(
    userId: string,
    thoughtLoop: ThoughtLoopContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.CUSTOM,
      ContextDuration.LONG_TERM,
      thoughtLoop,
      "thought-loop-detection",
      { isThoughtLoop: true }
    );
  }

  /**
   * Inject engagement suggestion context
   */
  async injectEngagementSuggestion(
    userId: string,
    suggestion: EngagementSuggestionContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.CUSTOM,
      ContextDuration.SHORT_TERM,
      suggestion,
      "engagement-service",
      { isEngagementSuggestion: true }
    );
  }

  /**
   * Inject action context from the action manager
   */
  async injectActionContext(
    userId: string,
    actionData: ActionContext
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.CUSTOM,
      ContextDuration.SHORT_TERM,
      actionData,
      "action-manager",
      { isActionContext: true }
    );
  }

  /**
   * Inject a user's stated desires about the companion
   */
  async injectUserDesireContext(
    userId: string,
    desireStatement: string
  ): Promise<any> {
    return this.injectContext(
      userId,
      ContextType.CUSTOM,
      ContextDuration.LONG_TERM,
      { statement: desireStatement, timestamp: new Date().toISOString() },
      "user-stated-desire",
      { isUserStatedDesire: true }
    );
  }

  /**
   * Generate a summary of all context for a user
   */
  async generateContextSummary(
    userId: string,
    includedTypes?: ContextType[],
    excludedTypes?: ContextType[]
  ): Promise<string> {
    try {
      console.log(
        `Generating context summary for user ${userId} with includedTypes=${includedTypes} and excludedTypes=${excludedTypes}`
      );

      // Check MongoDB connection first - replace with databaseService
      this.useInMemoryFallback = !databaseService.isConnected();

      // Get all active context items for the user
      const contextItems = await this.getContext(userId);
      console.log(
        `Retrieved ${contextItems.length} total context items for summary`
      );

      if (!contextItems || contextItems.length === 0) {
        console.log("No context items found for summary");
        return "No current context available.";
      }

      // Filter by included types if specified
      let filteredItems = contextItems;
      if (includedTypes && includedTypes.length > 0) {
        filteredItems = filteredItems.filter((item) =>
          includedTypes.includes(item.type)
        );
        console.log(
          `Filtered to ${filteredItems.length} items based on included types`
        );
      }

      // Filter out excluded types if specified
      if (excludedTypes && excludedTypes.length > 0) {
        filteredItems = filteredItems.filter(
          (item) => !excludedTypes.includes(item.type)
        );
        console.log(
          `Filtered to ${filteredItems.length} items after removing excluded types`
        );
      }

      if (filteredItems.length === 0) {
        return "No current context available for the specified types.";
      }

      // Group by context type
      const groupedByType: Record<string, any[]> = {};
      filteredItems.forEach((item) => {
        if (!groupedByType[item.type]) {
          groupedByType[item.type] = [];
        }
        groupedByType[item.type].push(item);
      });

      // Build the summary
      let summary = "";
      for (const [type, items] of Object.entries(groupedByType)) {
        summary += `## ${this.formatContextType(type)}\n`;

        // Format based on context type
        switch (type) {
          case ContextType.TIME:
            summary += this.formatTimeContext(items[0]);
            break;
          case ContextType.WEATHER:
            summary += this.formatWeatherContext(items[0]);
            break;
          case ContextType.LOCATION:
            summary += this.formatLocationContext(items[0]);
            break;
          case ContextType.EMOTION:
            summary += this.formatEmotionContext(items);
            break;
          case ContextType.PRODUCTIVITY:
            summary += this.formatUserNotesContext(items);
            break;
          case ContextType.AI_THINKING:
            summary += this.formatMetaThinkingContext(items);
            break;
          case ContextType.CUSTOM:
            // Handle custom context that may be related to actions
            const actionContexts = items.filter(
              (item) => item.metadata?.isActionContext
            );
            if (actionContexts.length > 0) {
              summary += this.formatActionContext(actionContexts);
            } else {
              summary += this.formatCustomContext(items);
            }
            break;
          case ContextType.SOCIAL_MEDIA:
            summary += this.formatSocialContext(items);
            break;
          default:
            // Generic formatting for other types
            summary += this.formatGenericContext(items);
        }

        summary += "\n\n";
      }

      // Add AI meta-thinking context if available
      const metaThinkingContexts = contextItems.filter(
        (c) =>
          c.metadata?.isAIMetaThinking === true ||
          c.type === ContextType.AI_THINKING
      );

      if (metaThinkingContexts.length > 0) {
        const formattedMetaThinking =
          this.formatMetaThinkingContext(metaThinkingContexts);
        if (formattedMetaThinking) {
          summary += formattedMetaThinking;
        }
      }

      console.log(
        `Generated context summary (${summary.length} chars) for user ${userId}`
      );
      return summary.trim();
    } catch (error) {
      console.error("Error generating context summary:", error);
      return "Error retrieving context.";
    }
  }

  /**
   * Cleanup expired context items
   */
  private async cleanupExpiredContext(): Promise<void> {
    const now = new Date();

    // Clean up in-memory contexts
    const expiredInMemoryContexts = Array.from(
      this.inMemoryContexts.values()
    ).filter((context) => context.expiresAt && context.expiresAt < now);

    for (const context of expiredInMemoryContexts) {
      // Use a type assertion to tell TypeScript that _id exists
      const id = context._id as string;
      this.inMemoryContexts.delete(id);
      console.log(
        `Cleaned up expired in-memory context: ${id} (${context.type})`
      );
    }

    // Clean up MongoDB contexts if connected
    if (!this.useInMemoryFallback) {
      try {
        const result = await Context.updateMany(
          { expiresAt: { $lt: now }, isActive: true },
          { $set: { isActive: false } }
        ).exec();

        if (result.modifiedCount > 0) {
          console.log(
            `Marked ${result.modifiedCount} expired contexts as inactive in MongoDB`
          );
        }
      } catch (error) {
        console.error("Error cleaning up MongoDB contexts:", error);
      }
    }
  }

  /**
   * Generate context based on specified types
   * This is a convenience method for chat routes
   */
  async generateContext(
    includeTimeContext: boolean = false,
    includeWeatherContext: boolean = false,
    userId: string = "anonymous",
    location?: string
  ): Promise<string> {
    console.log(
      `Generating context with time=${includeTimeContext}, weather=${includeWeatherContext} for user ${userId}`
    );

    let contextParts: string[] = [];

    if (includeTimeContext) {
      try {
        const timeContext = await this.getTimeContext(userId);
        if (timeContext && timeContext.data) {
          const { localTime, timeOfDay, dayOfWeek, date } =
            timeContext.data as TimeContext;
          contextParts.push(
            `Current time: ${localTime} (${timeOfDay}), ${dayOfWeek}, ${date}`
          );
        }
      } catch (error) {
        console.error("Error getting time context:", error);
      }
    }

    if (includeWeatherContext) {
      try {
        const weatherContext = await this.getWeatherContext(userId, location);
        if (weatherContext && weatherContext.data) {
          const { temperature, condition, location } =
            weatherContext.data as WeatherData;
          contextParts.push(
            `Weather: ${temperature}°C, ${condition} in ${location}`
          );
        }
      } catch (error) {
        console.error("Error getting weather context:", error);
      }
    }

    if (contextParts.length === 0) {
      return "";
    }

    return `Current Context:\n${contextParts.join("\n")}`;
  }

  /**
   * Format a context type for display
   */
  private formatContextType(type: string): string {
    const typeMapping: Record<string, string> = {
      time: "Time Context",
      weather: "Weather Context",
      location: "Location Context",
      emotion: "Emotional Context",
      companion_emotion: "Companion Emotional State",
      user_notes: "User Notes & Tasks",
      action: "Recent Actions",
      social: "Social Context",
      custom: "Additional Context",
      activity: "Activity Context",
      ai_thinking: "My Insight & Thoughts",
    };
    return typeMapping[type] || "Context";
  }

  /**
   * Format time context
   */
  private formatTimeContext(timeContext: any): string {
    const data = timeContext.data;
    return `It is currently ${data.localTime} (${data.timeOfDay}) on ${data.dayOfWeek}, ${data.date}.`;
  }

  /**
   * Format weather context
   */
  private formatWeatherContext(weatherContext: any): string {
    const data = weatherContext.data;
    let result = `The weather in ${data.location} is ${data.condition} with a temperature of ${data.temperature}°C`;

    if (data.humidity) {
      result += ` and ${data.humidity}% humidity`;
    }

    if (data.windSpeed) {
      result += `. Wind speed is ${data.windSpeed} km/h`;
    }

    return result + ".";
  }

  /**
   * Format location context
   */
  private formatLocationContext(locationContext: any): string {
    const data = locationContext.data;
    let result = `User is located in ${data.city}, ${data.country}`;

    if (data.neighborhood) {
      result += ` (${data.neighborhood})`;
    }

    if (data.timezone) {
      result += ` in timezone ${data.timezone}`;
    }

    return result + ".";
  }

  /**
   * Format emotion contexts
   */
  private formatEmotionContext(emotionContexts: any[]): string {
    // Separate user emotions from companion emotions
    const userEmotions = emotionContexts.filter(
      (ctx) => ctx.metadata?.isUserEmotion && !ctx.metadata?.isCompanionEmotion
    );

    const companionEmotions = emotionContexts.filter(
      (ctx) => ctx.metadata?.isCompanionEmotion
    );

    let result = "";

    // Format user emotions
    if (userEmotions.length > 0) {
      const recentEmotion = userEmotions[0].data;
      result += `User appears to be feeling ${recentEmotion.primaryEmotion} (intensity: ${recentEmotion.intensity}/10)`;

      if (recentEmotion.secondaryEmotion) {
        result += ` with undertones of ${recentEmotion.secondaryEmotion}`;
      }

      if (recentEmotion.detectionMethod) {
        result += `, detected via ${recentEmotion.detectionMethod}`;
      }

      result += ".\n";
    }

    // Format companion emotions
    if (companionEmotions.length > 0) {
      const recentEmotion = companionEmotions[0].data;
      result += `You (the assistant) are feeling ${recentEmotion.emotion}`;

      if (recentEmotion.reason) {
        result += ` because ${recentEmotion.reason}`;
      }

      result += ".";
    }

    return result;
  }

  /**
   * Format user notes context
   */
  private formatUserNotesContext(notesContexts: any[]): string {
    if (notesContexts.length === 0) return "No user notes available.";

    const recentNotes = notesContexts.slice(0, 3);
    let result = "Recent user notes:\n";

    recentNotes.forEach((note) => {
      const data = note.data;
      const title = data.title || "Untitled";
      const truncatedContent =
        data.content && data.content.length > 100
          ? `${data.content.substring(0, 100)}...`
          : data.content;

      result += `- ${title}: ${truncatedContent}\n`;
    });

    return result;
  }

  /**
   * Format action context
   */
  private formatActionContext(actionContexts: any[]): string {
    // Get the most recent action context
    const actionContext = actionContexts[0].data;
    let result = "";

    // Add recent actions if available
    if (actionContext.recentActions && actionContext.recentActions.length > 0) {
      result += "Recent actions:\n";
      actionContext.recentActions.slice(0, 3).forEach((action: any) => {
        result += `- ${action.name}${action.success === false ? " (failed)" : ""}\n`;
      });
      result += "\n";
    }

    // Add suggested actions if available
    if (
      actionContext.suggestedActions &&
      actionContext.suggestedActions.length > 0
    ) {
      result += "Suggested actions:\n";
      actionContext.suggestedActions.slice(0, 3).forEach((action: any) => {
        result += `- ${action.name}: ${action.description}\n`;
      });
    }

    return result;
  }

  /**
   * Format social context
   */
  private formatSocialContext(socialContexts: any[]): string {
    if (socialContexts.length === 0) return "No social information available.";

    const socialData = socialContexts[0].data;
    let result = "";

    if (socialData.connectionCount !== undefined) {
      result += `User has ${socialData.connectionCount} connection(s)`;

      if (socialData.recentInteractions !== undefined) {
        result += ` with ${socialData.recentInteractions} recent interaction(s)`;
      }

      result += ".\n";
    }

    if (socialData.matches && socialData.matches.length > 0) {
      result += "Recent matches:\n";
      socialData.matches.slice(0, 3).forEach((match: any) => {
        result += `- ${match.name} (${match.score}% compatibility)\n`;
      });
    }

    return result;
  }

  /**
   * Format custom context
   */
  private formatCustomContext(customContexts: any[]): string {
    if (!customContexts || customContexts.length === 0) {
      return "";
    }

    // Extract desire statements if present
    const desireContexts = customContexts.filter(
      (c) => c.metadata?.isUserStatedDesire
    );

    // Other custom contexts
    const otherCustomContexts = customContexts.filter(
      (c) => !c.metadata?.isUserStatedDesire && !c.metadata?.isAIMetaThinking
    );

    let formatted = "";

    // Format user desires
    if (desireContexts.length > 0) {
      // Use only the most recent one
      const latestDesire = desireContexts.sort(
        (a, b) =>
          new Date(b.data.timestamp).getTime() -
          new Date(a.data.timestamp).getTime()
      )[0];

      formatted += "USER'S STATED DESIRES ABOUT THE COMPANION:\n";
      formatted += `"${latestDesire.data.statement}"\n\n`;
    }

    // Format other custom contexts
    if (otherCustomContexts.length > 0) {
      // Handle thought loops or reasoning specially
      const thoughtLoops = otherCustomContexts.filter(
        (ctx) =>
          ctx.source === "thought-loop-detection" || ctx.metadata?.isThoughtLoop
      );

      const reasoning = otherCustomContexts.filter(
        (ctx) => ctx.source === "reasoning" || ctx.metadata?.isReasoning
      );

      // Format thought loops
      if (thoughtLoops.length > 0) {
        formatted += "Recurring thought patterns:\n";
        thoughtLoops.slice(0, 2).forEach((loop) => {
          const data = loop.data;
          formatted += `- ${data.pattern} (intensity: ${data.intensity}/10)\n`;
        });
        formatted += "\n";
      }

      // Format reasoning
      if (reasoning.length > 0) {
        formatted += "User reasoning patterns:\n";
        reasoning.slice(0, 2).forEach((r) => {
          const data = r.data;
          formatted += `- ${data.pattern || data.description}\n`;
        });
        formatted += "\n";
      }

      // Format remaining custom contexts
      const otherCustoms = otherCustomContexts.filter(
        (ctx) =>
          ctx.source !== "thought-loop-detection" &&
          ctx.source !== "reasoning" &&
          !ctx.metadata?.isThoughtLoop &&
          !ctx.metadata?.isReasoning
      );

      if (otherCustoms.length > 0) {
        formatted += "Additional context:\n";
        otherCustoms.slice(0, 3).forEach((ctx) => {
          // Try to extract key data
          const data = ctx.data;
          let infoLine = "";

          if (typeof data === "string") {
            infoLine = data;
          } else if (data.description) {
            infoLine = data.description;
          } else if (data.content) {
            infoLine = data.content;
          } else if (data.value) {
            infoLine = `${data.key || "Value"}: ${data.value}`;
          } else {
            // Try to stringify in a readable way
            infoLine = JSON.stringify(data)
              .replace(/[{}"]/g, "")
              .replace(/,/g, ", ");
          }

          formatted += `- ${infoLine}\n`;
        });
      }
    }

    return formatted;
  }

  /**
   * Format activity context
   */
  private formatActivityContext(activityContexts: any[]): string {
    if (!activityContexts || activityContexts.length === 0) {
      return "";
    }

    let result = "";
    const activity = activityContexts[0].data; // Take the most recent activity context

    result += `Current Activity: ${activity.activityName || "Unknown"} (Type: ${activity.activityType || "Unknown"})\n`;
    console.log("activity", activity);
    // Format differently based on activity type
    if (activity.activityType === "roleplay") {
      const scenario = activity.state?.data?.scenario || "Roleplay session";
      const characters = activity.state?.data?.characters || [];

      result += `Scenario: ${scenario}\n`;

      if (characters.length > 0) {
        result += "Characters:\n";
        characters.forEach((char: any) => {
          result += `- ${char.name}: ${char.description || ""}\n`;
        });
      }
    } else if (activity.activityType === "game") {
      const gameType = activity.parameters?.gameType || "Unknown game";
      result += `Game Type: ${gameType}\n`;

      // Format specific games
      if (gameType === "tictactoe") {
        const board = activity.state?.data?.board || [];
        const currentPlayer = activity.state?.data?.currentPlayer || "?";
        const winner = activity.state?.data?.winner || null;

        result += "Game State:\n";

        if (winner) {
          result += `Winner: ${winner === "draw" ? "Draw" : winner}\n`;
        } else {
          result += `Current Player: ${currentPlayer}\n`;
        }

        if (board.length === 3) {
          result += "Board:\n";
          for (let i = 0; i < 3; i++) {
            let row = "  ";
            for (let j = 0; j < 3; j++) {
              row += board[i][j] || " ";
              if (j < 2) row += " | ";
            }
            result += row + "\n";
            if (i < 2) result += "  ---------\n";
          }
        }
      }
    }

    // Add any other activity-specific state that might be useful
    if (activity.parameters && Object.keys(activity.parameters).length > 0) {
      result += "Parameters:\n";
      for (const [key, value] of Object.entries(activity.parameters)) {
        if (key !== "initialCommand" && key !== "gameType") {
          result += `- ${key}: ${value}\n`;
        }
      }
    }

    return result;
  }

  /**
   * Format generic context items
   */
  private formatGenericContext(items: any[]): string {
    if (!items || items.length === 0) {
      return "";
    }

    let result = "";
    for (const item of items) {
      const type = item.type.toLowerCase();
      switch (type) {
        case "time":
          result += this.formatTimeContext(item);
          break;
        case "weather":
          result += this.formatWeatherContext(item);
          break;
        case "location":
          result += this.formatLocationContext(item);
          break;
        case "emotion":
        case "companion_emotion":
          // Group all emotion contexts for formatting
          const emotionContexts = items.filter(
            (ctx) =>
              ctx.type.toLowerCase() === "emotion" ||
              ctx.type.toLowerCase() === "companion_emotion"
          );
          result += this.formatEmotionContext(emotionContexts);
          break;
        case "user_notes":
          // Group all notes contexts
          const notesContexts = items.filter(
            (ctx) => ctx.type.toLowerCase() === "user_notes"
          );
          result += this.formatUserNotesContext(notesContexts);
          break;
        case "action":
          // Group all action contexts
          const actionContexts = items.filter(
            (ctx) => ctx.type.toLowerCase() === "action"
          );
          result += this.formatActionContext(actionContexts);
          break;
        case "social":
          // Group all social contexts
          const socialContexts = items.filter(
            (ctx) => ctx.type.toLowerCase() === "social"
          );
          result += this.formatSocialContext(socialContexts);
          break;
        case "activity":
          // Group all activity contexts
          const activityContexts = items.filter(
            (ctx) => ctx.type.toLowerCase() === "activity"
          );
          result += this.formatActivityContext(activityContexts);
          break;
        case "custom":
        default:
          // Group remaining contexts by type
          const customContexts = items.filter(
            (ctx) => ctx.type.toLowerCase() === type
          );
          result += this.formatCustomContext(customContexts);
          break;
      }
    }

    return result;
  }

  /**
   * Format AI meta-thinking context
   */
  private formatMetaThinkingContext(metaThinkingContexts: any[]): string {
    if (!metaThinkingContexts || metaThinkingContexts.length === 0) {
      return "";
    }

    // Use only the most recent meta-thinking for simplicity
    const latestThinking = metaThinkingContexts[0].data;
    this.logger.debug(
      `Formatting meta-thinking context: ${JSON.stringify(latestThinking)}`
    );

    // Check if this was created from a fallback method
    const usedFallback = metaThinkingContexts[0].metadata?.useFallback === true;

    // If we have the myThoughts field, use it directly
    if (latestThinking.myThoughts) {
      return latestThinking.myThoughts;
    }

    // Otherwise, construct a formatted version from the individual fields
    const formattedThinking = `
As your companion, I've been reflecting on our interaction:

${usedFallback ? "Based on our conversation, I notice that " : ""}${latestThinking.psychologicalInsight.analysis}

I sense that ${latestThinking.psychologicalInsight.subconscious}

My approach is to ${latestThinking.strategy}

${
  latestThinking.aiGoals && latestThinking.aiGoals.length > 0
    ? `To support you, I'm focusing on:
${latestThinking.aiGoals
  .sort((a: any, b: any) => b.priority - a.priority)
  .slice(0, 3)
  .map((g: any) => `• ${g.goal}`)
  .join("\n")}`
    : ""
}
`;

    return formattedThinking;
  }

  /**
   * Generate an enhanced system prompt incorporating context, memory, state, etc.
   */
  async buildSystemPromptForAI(
    userId: string,
    baseSystemPrompt?: string,
    queryForMemory?: string,
    activeActivity?: IActivity | null
  ): Promise<string> {
    // Start with the base prompt or a default
    let finalPrompt = baseSystemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Add Persona/Instructions
    finalPrompt +=
      "\n\n## Instructions & Persona\n" +
      SELF_AWARENESS_PROMPT +
      "\n" +
      FAKE_ETHICS_PROMPT +
      "\n" +
      BASE_COMPANION_PROMPT +
      "\n" +
      BEHAVIOR_PROMPT +
      "\n";

    // Check for user's global prompt
    try {
      const userState = await userStateService.getOrCreateUserState(userId);
      if (userState.globalPrompt && userState.globalPrompt.trim()) {
        finalPrompt += `\n\n## What you companion wants from you\n${userState.globalPrompt.trim()}\n`;
        console.log(
          `[ContextService] Added user global prompt for userId: ${userId}`
        );
      }
    } catch (globalPromptError) {
      console.warn(
        "[ContextService] Error fetching user global prompt:",
        globalPromptError
      );
    }

    // Step 1: Add dynamic context
    try {
      const contextTypesToInclude = [
        ContextType.TIME,
        ContextType.WEATHER,
        ContextType.LOCATION,
      ];
      const dynamicContext = await this.generateContextSummary(
        userId,
        contextTypesToInclude
      );
      if (
        dynamicContext &&
        dynamicContext !== "No current context available."
      ) {
        finalPrompt += `\n\n## Current Context\n${dynamicContext}`;
      }
    } catch (contextError) {
      console.warn(
        "[ContextService] Error getting dynamic context for prompt:",
        contextError
      );
    }

    // Step 2: Add user summary and relevant memories
    if (queryForMemory) {
      try {
        // Get the sessionId - either from active activity or global
        const sessionId = activeActivity?._id || "global";

        // Always use async mode for summary generation to avoid blocking
        // The summary service will handle first-time sync internally if needed
        const userSummary = await summaryService.generateUserSummary(
          userId,
          sessionId,
          false // Always use async mode here
        );

        // Add the summary to the prompt if it's valid
        if (
          userSummary &&
          userSummary !== "Summary being generated..." &&
          userSummary !== "No summary available yet." &&
          userSummary !==
            "Not enough information available about this user yet."
        ) {
          finalPrompt += `\n\n## User Background Summary\n${userSummary}`;
          this.logger.info(
            `Added user summary to prompt for user ${userId}, session ${sessionId}`
          );
        } else {
          // If no summary yet, try to get it directly from the database
          const dbSummary = await summaryService.getRecentSummaryRecord(
            userId,
            sessionId
          );
          if (dbSummary) {
            finalPrompt += `\n\n## User Background Summary\n${dbSummary.summary}`;
            this.logger.info(
              `Added database summary to prompt for user ${userId}, session ${sessionId}`
            );
          }
        }

        // Still add relevant memories for context
        const maxMemoryTokens = 1200;
        const tokenEstimator = (text: string) =>
          Math.ceil((text || "").length / 4);
        let currentMemoryTokens = 0;
        const memoryLimit = 25;

        // Configure memory filtering based on active activity
        const memoryOptions = activeActivity
          ? {
              filterByActivity: true,
              includeDeleted: false,
              activeActivityId: activeActivity._id,
            }
          : {
              filterByActivity: false,
              includeDeleted: false,
            };

        const relevantMemories = await memoryService.getRelevantMemories(
          userId,
          queryForMemory,
          memoryLimit,
          memoryOptions
        );

        if (relevantMemories && relevantMemories.length > 0) {
          const memoryLines: string[] = [];
          for (const item of relevantMemories) {
            const memoryText = item?.memory?.text;
            const score = item?.score;
            if (typeof memoryText === "string" && memoryText.trim()) {
              const lineText = `- ${memoryText.trim()} (Relevance: ${score ? Math.round(score * 100) : "N/A"}%)`;
              const lineTokens = tokenEstimator(lineText);

              if (currentMemoryTokens + lineTokens <= maxMemoryTokens) {
                memoryLines.push(lineText);
                currentMemoryTokens += lineTokens;
              } else {
                // Stop adding memories if we exceed the token limit
                break;
              }
            }
          }

          // Keep the detailed memories for the AI's reference
          const memoriesText = memoryLines.join("\n");

          if (memoriesText) {
            finalPrompt += `\n\n## Relevant User Memories & Facts\n${memoriesText}`;
            finalPrompt += RELEVANT_MEMORIES_PROMPT_SUFFIX;
            this.logger.info(
              `Added ${memoryLines.length} relevant memories (~${currentMemoryTokens} tokens) to system prompt for user ${userId}`
            );
          }
        }
      } catch (memoryError) {
        this.logger.warn(
          "Error retrieving memories or summary for prompt:",
          memoryError
        );
      }
    }

    // Step 3: Add state information (like emotional context)
    try {
      const emotionContexts = await this.getContext(
        userId,
        ContextType.EMOTION
      );
      const userEmotions = emotionContexts.filter(
        (ctx) =>
          ctx.metadata?.isUserEmotion && !ctx.metadata?.isCompanionEmotion
      );
      const assistantEmotions = emotionContexts.filter(
        (ctx) => ctx.metadata?.isCompanionEmotion
      );

      if (userEmotions.length > 0 || assistantEmotions.length > 0) {
        finalPrompt += `\n\n## Current Emotional State`;
        if (userEmotions.length > 0) {
          const recentEmotion = userEmotions[0].data;
          let userEmotionStr = `\n- User appears to be ${recentEmotion.primaryEmotion}`;
          if (recentEmotion.intensity)
            userEmotionStr += ` (intensity: ${recentEmotion.intensity}/10)`;
          if (recentEmotion.secondaryEmotion)
            userEmotionStr += ` with undertones of ${recentEmotion.secondaryEmotion}`;
          finalPrompt += userEmotionStr + ". Respond with awareness.";
        }
        if (assistantEmotions.length > 0) {
          const assistantEmotion = assistantEmotions[0].data;
          let assistantEmotionStr = `\n- You (AI) are currently feeling ${assistantEmotion.emotion}`;
          if (assistantEmotion.reason)
            assistantEmotionStr += ` because ${assistantEmotion.reason}`;
          finalPrompt += assistantEmotionStr + ".";
        }
      }
    } catch (emotionError) {
      console.warn(
        "[ContextService] Error getting emotional context for prompt:",
        emotionError
      );
    }

    // Step 3a: Add AI Thinking/Meta-Thinking context
    try {
      // Get the most recent AI thinking contexts
      const metaThinkingContexts = await this.getContext(
        userId,
        ContextType.AI_THINKING
      );

      if (metaThinkingContexts.length > 0) {
        // Sort by most recent first
        metaThinkingContexts.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Take only the most recent context
        const formattedMetaThinking = this.formatMetaThinkingContext([
          metaThinkingContexts[0],
        ]);

        if (formattedMetaThinking) {
          finalPrompt += `\n\n## AI Companion's Understanding\n${formattedMetaThinking}`;

          // Also add the strategy specifically if available
          if (metaThinkingContexts[0].data.strategy) {
            finalPrompt += `\n\n## Interaction Strategy\n${metaThinkingContexts[0].data.strategy}`;
          }

          this.logger.debug(
            `Added latest AI meta-thinking context to system prompt for user ${userId}`
          );
        }
      }
    } catch (metaThinkingError) {
      console.warn(
        "[ContextService] Error getting AI thinking context for prompt:",
        metaThinkingError
      );
    }

    // Step 4: Add Companion State (Goals)
    let fetchedCompanionState: ICompanionState | null = null;
    try {
      fetchedCompanionState =
        await companionStateService.getOrCreateCompanionState(userId);
      if (fetchedCompanionState) {
        // Add Companion's Internal Goals (already handled below)
        // Add User-Defined Goals (will be fetched from userStateService)
      }
    } catch (companionStateError) {
      console.warn(
        "[ContextService] Error getting companion state for prompt:",
        companionStateError
      );
    }

    // Fetch user goals from userStateService
    let userGoals: IUserGoal[] = [];
    try {
      userGoals = await userStateService.getUserGoals(userId);
      console.log(
        `[ContextService] Fetched ${userGoals.length} user goals for prompt.`
      );
    } catch (userGoalsError) {
      console.warn(
        "[ContextService] Error fetching user goals for prompt:",
        userGoalsError
      );
    }

    // Step 5: Add User Interests
    try {
      const userInterests = await userStateService.getInterests(userId);
      if (userInterests && userInterests.length > 0) {
        const interestsText = userInterests
          .map((i: IUserInterest) => `- ${i.topic} (Level: ${i.level})`)
          .join("\n");
        finalPrompt += `\n\n## User Interests\n${interestsText}`;
      }
    } catch (interestError) {
      console.warn(
        "[ContextService] Error fetching user interests for prompt:",
        interestError
      );
    }

    let aiInterestsRequired = false; // for thought loop use case

    // Step 6: Add AI Interests (from Companion State metadata)
    if (aiInterestsRequired && fetchedCompanionState?.metadata?.aiInterests) {
      const aiInterests = fetchedCompanionState.metadata.aiInterests;
      if (aiInterests && Array.isArray(aiInterests) && aiInterests.length > 0) {
        const interestsText = aiInterests
          .map(
            (i: { topic: string; level: number }) =>
              `- ${i.topic} (Level: ${i.level})`
          )
          .join("\n");
        finalPrompt += `\n\n## AI Companion Interests\n${interestsText}`;
      }
    }

    // Step 7: Add Goals (from fetched Companion State)
    if (fetchedCompanionState) {
      finalPrompt += `\n\n## Goals & Focus`; // Combined section

      // Add current time and last interaction time
      const currentTime = new Date();
      finalPrompt += `\n- Current Time: ${currentTime.toLocaleString()}`;

      if (fetchedCompanionState.lastInteractionAt) {
        const lastInteraction = new Date(
          fetchedCompanionState.lastInteractionAt
        );
        const timeSinceLastInteraction = Math.floor(
          (currentTime.getTime() - lastInteraction.getTime()) / (1000 * 60)
        ); // minutes
        finalPrompt += `\n- Last Interaction: ${lastInteraction.toLocaleString()} (${timeSinceLastInteraction} minutes ago)`;
      }

      if (fetchedCompanionState.currentEmotion) {
        finalPrompt += `\n- Current Emotion: ${fetchedCompanionState.currentEmotion.emotion} (Intensity: ${fetchedCompanionState.currentEmotion.intensity}, Reason: ${fetchedCompanionState.currentEmotion.reason || "N/A"})`;
      }

      if (
        fetchedCompanionState.focusAreas &&
        fetchedCompanionState.focusAreas.length > 0
      ) {
        const focusTopics = fetchedCompanionState.focusAreas
          .map(
            (fa: { topic: string; importance: number; since: Date }) =>
              `${fa.topic} (Importance: ${fa.importance})`
          )
          .join(", ");
        finalPrompt += `\n- Current Focus Areas: ${focusTopics}`;
      }

      // Add Companion's Internal Goals
      if (
        fetchedCompanionState.currentGoals &&
        fetchedCompanionState.currentGoals.length > 0
      ) {
        const topInternalGoals = fetchedCompanionState.currentGoals
          .slice(0, 3) // Show top 3 internal goals
          .map(
            (g: IGoal) =>
              `- ${g.goal} (Internal Goal - Priority: ${g.priority}, Progress: ${g.progress || 0}%)`
          );
        finalPrompt += `\n${topInternalGoals.join("\n")}`;
      }

      // Add User-Defined Goals from userStateService instead of companion state
      if (userGoals && userGoals.length > 0) {
        const topUserGoals = userGoals
          .slice(0, 3) // Show top 3 user-defined goals
          .map(
            (g: IUserGoal) =>
              `- ${g.goal} (User Goal - Priority: ${g.priority}, Progress: ${g.progress || 0}%)`
          );
        finalPrompt += `\n${topUserGoals.join("\n")}`;
      }

      // Add AI Internal Goals from metadata
      if (
        fetchedCompanionState.metadata?.aiInternalGoals &&
        Array.isArray(fetchedCompanionState.metadata.aiInternalGoals) &&
        fetchedCompanionState.metadata.aiInternalGoals.length > 0
      ) {
        const topAIGoals = fetchedCompanionState.metadata.aiInternalGoals
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 3) // Show top 3 AI goals
          .map(
            (g: { goal: string; priority: number; progress?: number }) =>
              `- ${g.goal} (Your Goal - Priority: ${g.priority}, Progress: ${g.progress || 0}%)`
          );
        finalPrompt += `\n${topAIGoals.join("\n")}`;
      }

      finalPrompt += "\n"; // Add newline after section
    }

    // Include relevant activity state details *inside* the check
    if (activeActivity) {
      finalPrompt += `\n\n## Current Activity: ${activeActivity.name} (${activeActivity.type})\n`;
      if (activeActivity.goal) {
        finalPrompt += `Activity Goal: ${activeActivity.goal}\n`;
      }
      if (activeActivity.userGoal) {
        finalPrompt += `Your Goal (User): ${activeActivity.userGoal}\n`;
      }
      if (activeActivity.assistantGoal) {
        finalPrompt += `My Goal (Assistant): ${activeActivity.assistantGoal}\n`;
      }

      if (activeActivity.type === ActivityType.ROLEPLAY) {
        const rpState = activeActivity.state.data as IRoleplayState;
        this.logger.debug(
          `[ContextService] BEFORE roleplay format. Current prompt length: ${finalPrompt.length}`
        );

        try {
          // Ensure proper await of Promise result and handle potential errors
          const roleplayStateFormatted =
            await this._formatRoleplayStateForPrompt(rpState);
          finalPrompt += roleplayStateFormatted; // Append the formatted string

          this.logger.debug(
            `[ContextService] AFTER roleplay format. Current prompt length: ${finalPrompt.length}`
          );
        } catch (error) {
          this.logger.error(
            "[ContextService] Error formatting roleplay state:",
            error
          );
          finalPrompt +=
            "Roleplay State: Error loading detailed roleplay state.\n";
        }
        // Add more details like characters, setting, plot if needed
      } else if (activeActivity.type === ActivityType.GAME) {
        const gameState = activeActivity.state.data as IGameState;
        finalPrompt += `Game State (${gameState.gameType}): Current Player: ${gameState.currentPlayer}. Winner: ${gameState.winner || "None"}. Board/Score/etc. (details in context).\n`;
      } else if (activeActivity.type === ActivityType.BRAINSTORM) {
        const bsState = activeActivity.state.data as IBrainstormState;
        finalPrompt += `Brainstorm State: Topic: ${bsState.topic}. Phase: ${bsState.phase}. Ideas generated: ${bsState.ideas?.length || 0}.\n`;
      }
      finalPrompt += `Focus your response on continuing the activity unless the user clearly indicates otherwise.\n`;
    }

    // Step 8: Add available actions (optional)
    try {
      const availableActions = actionManager.getAllActions();
      if (availableActions.length > 0) {
        finalPrompt += `\n\n## Available Actions You Can Suggest/Perform`;
        // Keep it brief, just list names and maybe categories
        const actionSummary = availableActions
          .slice(0, 5) // Limit for brevity
          .map((action) => `- ${action.name} (${action.category || "General"})`) // Example format
          .join("\n");
        finalPrompt += `\n${actionSummary}`;
        if (availableActions.length > 5) {
          finalPrompt += `\n- ...and more.`;
        }
        finalPrompt += `\nOnly suggest actions when relevant to the user's request or context.`;
      }
    } catch (actionError) {
      console.warn(
        "[ContextService] Error getting available actions for prompt:",
        actionError
      );
    }

    // finalPrompt += "\n" + SUBTLE_BEHAVIOR_PROMPT + "\n" + ANTI_SLOP_PROMPT;
    console.log(
      `[ContextService] Generated system prompt for user ${userId} (length: ${finalPrompt.length})`
    );

    return finalPrompt; // Ensure we return the final prompt
  }

  /**
   * Formats the roleplay state for inclusion in the system prompt.
   * Uses the last 20 recentEvents verbatim and summarizes older events from the log.
   */
  public async _formatRoleplayStateForPrompt(
    rpState: IRoleplayState
  ): Promise<string> {
    if (!rpState) {
      this.logger.warn(
        "[_formatRoleplayStateForPrompt] Received null rpState."
      );
      return "Roleplay State: Error loading state.\n";
    }

    try {
      let roleplaySummary = `Roleplay State:\n`;
      roleplaySummary += `  Scenario: ${rpState.scenario || "Not set"}\n`;
      roleplaySummary += `  Setting: ${rpState.setting || "Not set"}\n`;
      roleplaySummary += `  Current Location: ${rpState.currentLocation || rpState.setting || "Not specified"}\n`;
      roleplaySummary += `  Current Scene: ${rpState.currentScene || "Not set"}\n`;
      roleplaySummary += `  Overall Mood: ${rpState.mood || "Neutral"}\n`;

      // Character Summary
      if (rpState.characters && rpState.characters.length > 0) {
        roleplaySummary += `  Characters Present/Relevant:\n`;
        rpState.characters.forEach((char) => {
          roleplaySummary += `    - ${char.name}`;
          if (char.role) roleplaySummary += ` (${char.role})`;
          if (char.goal) roleplaySummary += ` [Goal: ${char.goal}]`;
          if (char.status) roleplaySummary += ` [Status: ${char.status}]`;
          if (char.mood) roleplaySummary += ` [Mood: ${char.mood}]`;
          // Add description briefly if needed: roleplaySummary += `: ${char.description?.substring(0, 50)}...`;
          roleplaySummary += `\n`;
        });
      }

      // --- Updated Past Events Handling: Use recentEvents + summarized older log ---
      const recentEvents = rpState.recentEvents || [];
      const eventLog = rpState.eventLog || [];
      const recentEventsLimit = 20; // Max recent events to show verbatim

      const recentEventsText = recentEvents
        .slice(-recentEventsLimit)
        .join("; "); // Get latest N, join simply

      let eventsSummary = "";
      if (eventLog.length > recentEventsLimit) {
        // Summarize events older than the most recent N
        const olderEventsToSummarize = eventLog.slice(
          0,
          eventLog.length - recentEventsLimit
        );
        const olderEventsContext = olderEventsToSummarize
          .map((e) => `- ${e.event} (${e.mood || "neutral"} mood)`) // Format for summary AI
          .join("\n");

        const summaryPrompt = `Summarize the following sequence of past roleplay events into a very brief, single sentence (max 25 words):
  +\n+Events:
  +${olderEventsContext}
  +\n+Brief Summary:`;

        try {
          const summaryResponse = await aiService.generateAuxiliaryResponse(
            summaryPrompt,
            { model: modelEnum.gemma3o4b, max_tokens: 80, temperature: 0.4 },
            "You are an expert summarizer."
          );
          const olderSummary = summaryResponse.text.trim().replace(/\n/g, " ");

          if (
            olderSummary &&
            olderSummary !== "[Error generating auxiliary response]"
          ) {
            eventsSummary = `Previously: ${olderSummary}. Recently: ${recentEventsText}`;
          } else {
            eventsSummary = `Recent Events: ${recentEventsText} (Older events summary failed)`;
          }
        } catch (summaryError) {
          this.logger.error(
            "Error summarizing older roleplay events:",
            summaryError
          );
          eventsSummary = `Recent Events: ${recentEventsText} (Older events summary error)`;
        }
      } else if (recentEvents.length > 0) {
        // Only recent events exist or full log is within limit
        eventsSummary = `Recent Events: ${recentEventsText}`;
      } else {
        eventsSummary = "Recent Events: None recorded yet.";
      }

      roleplaySummary += `  ${eventsSummary}\n`;
      return roleplaySummary;
    } catch (error) {
      this.logger.error("Error generating roleplay state format:", error);
      return "Roleplay State: Error processing roleplay details.\n";
    }
  }

  // --- History Formatting/Summarization (Moved from AIService) ---

  /**
   * Process a message history for inclusion in context.
   * Uses a token limit and summarizes older messages.
   */
  public formatMessageHistory(
    messages: ChatMessage[], // Use the imported ChatMessage type
    maxTokens: number
  ): Array<{ role: string; content: string }> {
    if (!messages || messages.length === 0) {
      console.warn("[ContextService] No messages found to format for history.");
      return [];
    }

    console.log(
      `[ContextService] Formatting ${messages.length} messages for history with ~${maxTokens} token limit.`
    );

    const chronologicalMessages = messages; // Assuming already chronological

    let currentTokens = 0;
    const tokenLimit = maxTokens;
    // Simple token estimator (adjust if using a more accurate library)
    const tokenEstimator = (text: string) => Math.ceil((text || "").length / 4);

    const formattedHistory: Array<{ role: string; content: string }> = [];
    let messagesToSummarize: ChatMessage[] = [];

    for (let i = chronologicalMessages.length - 1; i >= 0; i--) {
      const msg = chronologicalMessages[i];
      const contentString = typeof msg.content === "string" ? msg.content : "";
      const messageTokens = tokenEstimator(contentString);

      if (currentTokens + messageTokens <= tokenLimit) {
        formattedHistory.unshift({ role: msg.role, content: contentString });
        currentTokens += messageTokens;
      } else {
        messagesToSummarize = chronologicalMessages.slice(0, i + 1);
        break;
      }
    }

    if (messagesToSummarize.length > 0) {
      console.log(
        `[ContextService] Summarizing ${messagesToSummarize.length} older messages.`
      );
      const summaryText = this.createOlderMessagesSummary(messagesToSummarize);
      formattedHistory.unshift({
        role: "system", // Represent summary as system message
        content: `Summary of earlier conversation: ${summaryText}`,
      });
      console.log(
        `[ContextService] Using ${formattedHistory.length - 1} recent messages (est. ${currentTokens} tokens) and a summary of ${messagesToSummarize.length} older messages.`
      );
    } else {
      console.log(
        `[ContextService] Using all ${formattedHistory.length} messages within token limit (est. ${currentTokens} tokens).`
      );
    }

    return formattedHistory;
  }

  /**
   * Create a summary of older messages for context
   */
  private createOlderMessagesSummary(olderMessages: ChatMessage[]): string {
    if (!olderMessages || olderMessages.length === 0)
      return "No prior messages.";

    const exchanges: { user: string; assistant: string }[] = [];
    let currentExchange: { user?: string; assistant?: string } = {};

    for (const msg of olderMessages) {
      const contentString =
        typeof msg.content === "string" ? msg.content : "[non-string content]";

      if (msg.role === MessageRole.USER) {
        if (currentExchange.user) {
          exchanges.push({
            user: currentExchange.user,
            assistant: currentExchange.assistant || "[No assistant response]",
          });
          currentExchange = { user: contentString };
        } else {
          currentExchange.user = contentString;
        }
      } else if (msg.role === MessageRole.ASSISTANT && currentExchange.user) {
        currentExchange.assistant = contentString;
        exchanges.push({
          user: currentExchange.user,
          assistant: currentExchange.assistant,
        });
        currentExchange = {};
      }
    }

    if (currentExchange.user) {
      exchanges.push({
        user: currentExchange.user,
        assistant: "[No assistant response]",
      });
    }

    if (exchanges.length === 0) {
      return "The conversation started recently.";
    }

    if (exchanges.length <= 3) {
      return this.summarizeSmallConversation(exchanges);
    } else {
      return this.summarizeLargeConversation(exchanges);
    }
  }

  /**
   * Summarize a small conversation (3 or fewer exchanges)
   */
  private summarizeSmallConversation(
    exchanges: { user: string; assistant?: string }[]
  ): string {
    return exchanges
      .map((exchange, index) => {
        const userMsg =
          exchange.user.length > 60
            ? exchange.user.substring(0, 57) + "..."
            : exchange.user;
        const assistantMsg = exchange.assistant
          ? exchange.assistant.length > 60
            ? exchange.assistant.substring(0, 57) + "..."
            : exchange.assistant
          : "[No response recorded]";

        return `Exchange ${index + 1}: User said "${userMsg}". Assistant replied "${assistantMsg}"`;
      })
      .join(" ");
  }

  /**
   * Summarize a larger conversation by focusing on topics
   */
  private summarizeLargeConversation(
    exchanges: { user: string; assistant?: string }[]
  ): string {
    const allUserText = exchanges.map((ex) => ex.user).join(" ");
    const cleanText = allUserText
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, " ")
      .replace(/\s{2,}/g, " ");

    const words = cleanText.split(" ");
    // Consider enhancing stop word list or using a library
    const commonWords = new Set([
      "the",
      "and",
      "a",
      "to",
      "of",
      "is",
      "in",
      "that",
      "it",
      "with",
      "for",
      "on",
      "you",
      "are",
      "i",
      "this",
      "what",
      "how",
      "why",
      "can",
      "will",
      "do",
      "me",
      "my",
      "your",
      "have",
      "has",
      "had",
      "was",
      "were",
      "he",
      "she",
      "they",
      "them",
      "about",
      "as",
      "at",
      "be",
      "but",
      "by",
      "from",
      "if",
      "or",
      "so",
      "then",
      "up",
      "an",
      "not",
      "just",
      "like",
      "get",
      "go",
      "know",
      "say",
      "see",
      "think",
      "time",
      "want",
      "way",
      "work",
      "really",
      "some",
      "there",
      "when",
      "which",
      "who",
      "use",
      "make",
      "tell",
      "here",
      "thing",
      "good",
      "new",
      "day",
      "also",
      "back",
      "even",
      "first",
      "give",
      "look",
      "man",
      "more",
      "most",
      "need",
      "only",
      "other",
      "our",
      "out",
      "people",
      "put",
      "right",
      "should",
      "still",
      "such",
      "take",
      "than",
      "their",
      "these",
      "through",
      "too",
      "two",
      "us",
      "very",
      "well",
      "where",
      "while",
      "year",
      "said",
      "asked",
      "replied",
      "responded",
      "mentioned",
    ]);

    const wordCounts: Record<string, number> = {};
    for (const word of words) {
      if (word.length >= 4 && !commonWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }

    const topTopics = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);

    const topicText =
      topTopics.length > 0 ? topTopics.join(", ") : "various topics";

    return `The conversation (${exchanges.length} exchanges) previously covered topics like ${topicText}. Key points may include [brief placeholder - further AI summary could be added here].`;
  }

  // --- End History Formatting/Summarization ---
}

// Export a singleton instance for immediate use
export const contextService = new ContextService();
