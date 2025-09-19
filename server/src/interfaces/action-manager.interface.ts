import { IAction } from "./action.interface";
import { IActionSuggester } from "./action-suggester.interface";

/**
 * Interface for a service that manages actions and their execution
 * Based on NestJS implementation from server/src/core/interfaces/action-manager.interface.ts
 */
export interface IActionManager {
  /**
   * Register an action with the manager
   *
   * @param action - The action to register
   */
  registerAction(action: IAction): void;

  /**
   * Get an action by ID
   *
   * @param actionId - The ID of the action to get
   * @returns The action, or undefined if not found
   */
  getAction(actionId: string): IAction | undefined;

  /**
   * Get all registered actions
   *
   * @returns Array of all registered actions
   */
  getActions(): IAction[];

  /**
   * Execute an action with the given parameters
   *
   * @param actionId - The ID of the action to execute
   * @param params - Parameters to pass to the action
   * @returns A promise resolving to the result of the action
   */
  executeAction(actionId: string, params?: Record<string, any>): Promise<any>;

  /**
   * Register an action suggester
   *
   * @param suggester - The action suggester to register
   */
  registerSuggester(suggester: IActionSuggester): void;

  /**
   * Get action suggestions based on context
   *
   * @param context - The user's message or context
   * @param userId - The ID of the user
   * @param maxSuggestions - Maximum number of actions to suggest
   * @returns A promise resolving to suggested actions with scores indicating relevance
   */
  getSuggestions(
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
   * Execute actions from natural language request
   * Automatically identifies actions to execute based on the text
   *
   * @param text - The text containing action requests
   * @param userId - The ID of the user
   * @returns Results of all executed actions
   */
  executeActionsFromText(
    text: string,
    userId: string
  ): Promise<Record<string, any>>;
}
