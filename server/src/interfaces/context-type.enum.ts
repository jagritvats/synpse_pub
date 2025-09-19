/** * Enum representing different types of context that can be used in the system * Based on NestJS implementation: server/src/core/interfaces/context-type.enum.ts */
export enum ContextType {
  /**
   * Time-based context (time of day, day of week, etc.)
   */
  TIME = "time",

  /**
   * Weather-based context (current weather, forecast, etc.)
   */
  WEATHER = "weather",

  /**
   * Location-based context (user's current location, etc.)
   */
  LOCATION = "location",

  /**
   * Calendar-based context (upcoming meetings, events, etc.)
   */
  CALENDAR = "calendar",

  /**
   * User preferences and settings
   */
  PREFERENCES = "preferences",

  /**
   * User's recent interactions with the system
   */
  RECENT_INTERACTIONS = "recent_interactions",

  /**
   * News and current events
   */
  NEWS = "news",

  /**
   * User's emotional state and sentiment
   */
  EMOTION = "emotion",

  /**
   * User's social media activity
   */
  SOCIAL_MEDIA = "social_media",

  /**
   * User's productivity tools (todo lists, notes, etc.)
   */
  PRODUCTIVITY = "productivity",

  /**
   * Custom context provided by plugins or extensions
   */
  CUSTOM = "custom",

  /**
   * Activity-related context (roleplay, games, etc.)
   */
  ACTIVITY = "activity",

  /**
   * AI meta-thinking about the user and its own goals
   */
  AI_THINKING = "ai_thinking",
}
