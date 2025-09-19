import { ContextType } from "./context-type.enum";import { ContextDuration } from "./context-duration.enum";
import { ActivityType } from "../models/activity.model";

/**
 * Interface for context data with type information
 */
export interface Context {
  /**
   * Unique identifier for this context item
   */
  id: string;

  /**
   * User ID this context belongs to
   */
  userId: string;

  /**
   * The type of context
   */
  type: ContextType;

  /**
   * Duration for which this context is relevant
   */
  duration: ContextDuration;

  /**
   * The actual context data
   */
  data: any;

  /**
   * Timestamp when this context was created
   */
  createdAt: string;

  /**
   * Timestamp when this context expires (if applicable)
   */
  expiresAt?: string;

  /**
   * Source of the context (e.g., "user-input", "system", "api")
   */
  source: string;

  /**
   * Optional metadata for additional context information
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for time-related context
 */
export interface TimeContext {
  localTime: string;
  timeOfDay: string;
  dayOfWeek: string;
  date: string;
  timestamp: number;
}

/**
 * Interface for weather-related context
 */
export interface WeatherContext {
  temperature: number;
  condition: string;
  location: string;
  humidity?: number;
  windSpeed?: number;
}

/**
 * Interface for location-related context
 */
export interface LocationContext {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
  placeType?: string;
  placeDescription?: string;
}

/**
 * Interface for emotion-related context
 */
export interface EmotionContext {
  primaryEmotion: string;
  secondaryEmotion?: string;
  intensity: number; // 1-10 scale
  detectionMethod:
    | "text-analysis"
    | "sentiment-analysis"
    | "user-reported"
    | "facial-recognition";
  trigger?: string;
}

/**
 * Interface for companion emotion context
 */
export interface CompanionEmotionContext {
  emotion: string;
  intensity: number; // 1-10 scale
  reason: string;
  duration?: string;
}

/**
 * Interface for user notes or tasks
 */
export interface UserNotesContext {
  title: string;
  content: string;
  priority?: number; // 1-10 scale
  dueDate?: string;
  reminderTime?: string;
  tags?: string[];
  completed?: boolean;
}

/**
 * Interface for recurring thought patterns
 */
export interface ThoughtLoopContext {
  pattern: string;
  intensity: number; // 1-10 scale
  triggers: string[];
  category?: string;
  recommendedAction?: string;
}

/**
 * Interface for engagement suggestions
 */
export interface EngagementSuggestionContext {
  suggestionId: string;
  suggestionType: string;
  content: string;
  relevance: number; // 0-1 scale
  urgency: number; // 1-10 scale
  expirationTime?: string;
}

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
 * Interface for action-related context
 */
export interface ActionContext {
  recentActions: Array<{
    id: string;
    name: string;
    executedAt: Date;
    success: boolean;
  }>;
  suggestedActions: Array<{
    id: string;
    name: string;
    description: string;
    score: number;
    suggestedParameters?: Record<string, any>;
  }>;
  availableActions: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

/**
 * Interface for activity-related context
 */
export interface ActivityContext {
  activityId: string;
  activityType: ActivityType;
  activityName: string;
  state: {
    type: string;
    data: any;
  };
  startedAt: Date;
  parameters?: Record<string, any>;
}
