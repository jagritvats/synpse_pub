/** * Interface for a serendipity suggestion
 * Based on NestJS implementation: ../server/src/modules/serendipity
 */
export interface SerendipitySuggestion {
  /**
   * Unique identifier for the suggestion
   */
  id: string;

  /**
   * User ID this suggestion belongs to
   */
  userId: string;

  /**
   * The actual suggestion text
   */
  content: string;

  /**
   * Type of suggestion (e.g., "reminder", "idea", "question")
   */
  type: string;

  /**
   * Score representing how relevant or insightful this suggestion is (0-1)
   */
  relevanceScore: number;

  /**
   * Reasoning behind why this suggestion was generated
   */
  reasoning: string;

  /**
   * Timestamp when this suggestion was created
   */
  createdAt: string;

  /**
   * Optional timestamp when this suggestion expires
   */
  expiresAt?: string;

  /**
   * Whether the user has seen this suggestion
   */
  seen: boolean;

  /**
   * Whether the user has acted on this suggestion
   */
  actedOn: boolean;

  /**
   * Optional metadata for additional suggestion information
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for suggestion generation parameters
 */
export interface GenerationParams {
  /**
   * Maximum number of suggestions to generate
   */
  maxSuggestions: number;

  /**
   * Creativity level (0-1) - higher means more creative but potentially less relevant
   */
  creativity: number;

  /**
   * Types of suggestions to prioritize
   */
  priorityTypes?: string[];

  /**
   * Minimum relevance score threshold (0-1)
   */
  minRelevanceScore: number;
}

/**
 * Interface for serendipity feedback
 */
export interface SerendipityFeedback {
  /**
   * Suggestion ID this feedback relates to
   */
  suggestionId: string;

  /**
   * User ID providing the feedback
   */
  userId: string;

  /**
   * Rating provided by the user (1-5)
   */
  rating: number;

  /**
   * Optional text feedback
   */
  comment?: string;

  /**
   * Whether the user acted on the suggestion
   */
  actedOn: boolean;

  /**
   * Timestamp when feedback was provided
   */
  createdAt: string;
}
