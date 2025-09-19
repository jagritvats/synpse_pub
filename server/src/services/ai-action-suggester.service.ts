import { IAction } from "../interfaces/action.interface";import { IActionSuggester } from "../interfaces/action-suggester.interface";
import { aiService } from "./ai.service";
import { actionManager } from "./action-manager.service";

/**
 * AI-powered action suggester that uses LLM to suggest relevant actions based on context
 * Based on NestJS implementation: ../server/src/modules/ai/ai-action-suggester.service.ts
 */
class AIActionSuggester implements IActionSuggester {
  /**
   * Suggest actions based on user context
   */
  async suggestActions(
    context: string,
    userId: string,
    maxSuggestions: number = 5
  ): Promise<
    Array<{
      action: IAction;
      score: number;
      suggestedParameters?: Record<string, any>;
    }>
  > {
    // Get available actions
    const availableActions = this.getAvailableActions();

    if (availableActions.length === 0) {
      console.warn("No actions available for suggestions");
      return [];
    }

    try {
      // Create action descriptions for context
      const actionDescriptions = availableActions.map((action) => ({
        id: action.id,
        name: action.name,
        description: action.description,
        parameters: action.getParameterDescriptions(),
      }));

      // Create prompt for AI
      const prompt = `
You are an AI assistant helping to suggest the most relevant actions based on the user's context.
Your task is to analyze the context and determine which actions would be most helpful to the user right now.

USER CONTEXT:
${context}

AVAILABLE ACTIONS:
${actionDescriptions
  .map(
    (act) =>
      `ID: ${act.id}
  Name: ${act.name}
  Description: ${act.description}
  Parameters: ${Object.entries(act.parameters || {})
  .map(([key, desc]) => `${key}: ${desc}`)
  .join(", ")}
  `
  )
  .join("\n")}

For each action, assess its relevance to the user's current context on a scale from 0.0 to 1.0, where:
- 1.0 means the action is perfectly relevant and should be suggested immediately
- 0.0 means the action is completely irrelevant to the current context

If an action requires parameters, suggest appropriate values based on the context.

Return your suggestions as a JSON array of objects, with each object containing:
- actionId: The ID of the action
- relevanceScore: A number between 0.0 and 1.0 indicating relevance
- reasoning: A brief explanation of why this action is relevant to the context
- suggestedParameters (optional): An object with parameter names and suggested values

Only include actions with a relevance score of at least 0.4. Sort them by relevance score in descending order.
Provide exactly ${maxSuggestions} suggestions if possible, or fewer if not enough actions meet the relevance threshold.

SUGGESTIONS:
`;

      // Generate suggestions using AI
      const response = await aiService.generateResponse(
        prompt,
        {
          temperature: 0.3,
          max_tokens: 1000,
        },
        undefined,
        userId
      );

      // Extract and parse suggestions
      const suggestions: Array<{
        action: IAction;
        score: number;
        suggestedParameters?: Record<string, any>;
        reasoning?: string;
      }> = [];

      try {
        // Extract JSON array from response
        const jsonMatch = response.text.match(/\[\s*\{.*\}\s*\]/s);

        if (jsonMatch) {
          const parsedSuggestions = JSON.parse(jsonMatch[0]);

          // Map to action objects
          for (const suggestion of parsedSuggestions) {
            if (
              suggestion.actionId &&
              typeof suggestion.relevanceScore === "number" &&
              suggestion.relevanceScore >= 0.4
            ) {
              const action = actionManager.getAction(suggestion.actionId);

              if (action) {
                suggestions.push({
                  action,
                  score: suggestion.relevanceScore,
                  suggestedParameters: suggestion.suggestedParameters,
                  reasoning: suggestion.reasoning,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error parsing AI action suggestions:", error);
      }

      // Sort by score and limit
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSuggestions);
    } catch (error) {
      console.error("Error suggesting actions with AI:", error);
      return [];
    }
  }

  /**
   * Get all available actions that this suggester can recommend
   */
  getAvailableActions(): IAction[] {
    return actionManager.getAllActions();
  }
}

// Create singleton instance
export const aiActionSuggester = new AIActionSuggester();

// Register the suggester with the action manager
actionManager.registerSuggester("ai-suggester", aiActionSuggester);
