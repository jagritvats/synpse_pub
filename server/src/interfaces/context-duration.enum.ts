/** * Enum representing different durations for which context is relevant
 * Based on NestJS implementation: server/src/core/interfaces/context-duration.enum.ts
 */
export enum ContextDuration {
  /**
   * Context that is relevant for only the current interaction
   * Example: A user's immediate request or command
   */
  IMMEDIATE = "immediate",

  /**
   * Context that is relevant for a short period (minutes to hours)
   * Example: Current weather conditions, time of day
   */
  SHORT_TERM = "short_term",

  /**
   * Context that is relevant for a medium period (hours to days)
   * Example: Today's tasks, upcoming meetings
   */
  MEDIUM_TERM = "medium_term",

  /**
   * Context that is relevant for a long period (days to weeks)
   * Example: Recent topics of interest, recurring tasks
   */
  LONG_TERM = "long_term",

  /**
   * Context that is always relevant
   * Example: User preferences, permanent memories
   */
  PERMANENT = "permanent",
}
