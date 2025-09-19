/** * Interface representing an executable action in the system
 * Based on NestJS implementation: server/src/core/interfaces/action.interface.ts
 */
export interface IAction {
  /**
   * Unique identifier for the action
   */
  id: string;

  /**
   * Display name for the action
   */
  name: string;

  /**
   * Description of what the action does
   */
  description: string;

  /**
   * Execute the action with the given parameters
   * @param params - Action parameters
   * @returns A promise resolving to the result of the action
   */
  execute(params?: Record<string, any>): Promise<any>;

  /**
   * Get the parameters this action accepts
   * @returns A record of parameter names and their descriptions
   */
  getParameterDescriptions(): Record<string, string>;
}
