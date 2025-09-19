import { IAction } from "./action.interface";

/**
 * Interface for a service that can suggest relevant actions based on context
 * Based on NestJS implementation: server/src/core/interfaces/action-suggester.interface.ts
 */
export interface IActionSuggester {
  /**
   * Suggest relevant actions based on the given context
   *
   * @param context - The user's message or context
   * @param userId - The ID of the user
   * @param maxSuggestions - Maximum number of actions to suggest
   * @returns A promise resolving to suggested actions with scores indicating relevance
   */
  suggestActions(
    context: string,
    userId: string,
    maxSuggestions?: number
  ): Promise<
    Array<{
      action: IAction;
      score: number;
      suggestedParameters?: Record<string, any>;
    }>
  >;

  /**
   * Get all available actions that this suggester can recommend
   *
   * @returns All actions that this suggester can recommend
   */
  getAvailableActions(): IAction[];
}
