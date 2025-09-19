import { v4 as uuidv4 } from "uuid";
import { contextService } from "./context.service";
import { memoryService } from "./memory.service";
import { notionService } from "./productivity/notion.service";
import { aiService } from "./ai.service";
import { actionLogService } from "./action-log.service";
import { loggerFactory } from "../utils/logger.service";
import {
  Action,
  ActionParameter,
  ActionSuggester,
  SuggestedAction,
} from "../interfaces/action.interface";

const logger = loggerFactory.getLogger("ActionManagerService");

/**
 * Interface representing an action that can be performed
 */
export interface Action {
  id: string;
  name: string;
  description: string;
  parameters: ActionParameter[];
  execute: (params: Record<string, any>) => Promise<any>;
  contextTypes?: string[]; // Context types that this action is relevant to
  category?: string;
  keywords?: string[]; // Keywords that might trigger this action
}

/**
 * Interface representing a parameter for an action
 */
export interface ActionParameter {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  defaultValue?: any;
}

/**
 * Interface representing a suggested action with a confidence score
 */
export interface SuggestedAction {
  action: Action;
  score: number; // 0-1 confidence score
  suggestedParameters: Record<string, any>;
}

/**
 * Interface for action suggester implementations
 */
export interface ActionSuggester {
  suggestActions(
    context: string,
    userId: string,
    maxSuggestions?: number
  ): Promise<SuggestedAction[]>;
  getAvailableActions(): Action[];
}

/**
 * Service for managing available actions and suggesting relevant ones
 */
class ActionManager {
  private actions: Map<string, Action> = new Map();
  private suggesters: Map<string, ActionSuggester> = new Map();

  constructor() {
    this.registerDefaultActions();
  }

  /**
   * Register a new action
   */
  registerAction(action: Action): void {
    this.actions.set(action.id, action);
    logger.info(`Registered action: ${action.name} (${action.id})`);
  }

  /**
   * Register an action suggester
   */
  registerSuggester(id: string, suggester: ActionSuggester): void {
    this.suggesters.set(id, suggester);
    logger.info(`Registered action suggester: ${id}`);
  }

  /**
   * Unregister an action
   */
  unregisterAction(actionId: string): boolean {
    const result = this.actions.delete(actionId);
    if (result) {
      logger.info(`Unregistered action: ${actionId}`);
    }
    return result;
  }

  /**
   * Get an action by ID
   */
  getAction(actionId: string): Action | undefined {
    return this.actions.get(actionId);
  }

  /**
   * Get all registered actions
   */
  getAllActions(): Action[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get actions filtered by category
   */
  getActionsByCategory(category: string): Action[] {
    return this.getAllActions().filter(
      (action) => action.category === category
    );
  }

  /**
   * Get actions that are relevant to a specific context type
   */
  getActionsByContextType(contextType: string): Action[] {
    return this.getAllActions().filter(
      (action) =>
        action.contextTypes && action.contextTypes.includes(contextType)
    );
  }

  /**
   * Execute an action by ID with the provided parameters
   */
  async executeAction(
    actionId: string,
    parameters: Record<string, any>,
    options: {
      userId?: string;
      sessionId?: string;
      messageId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<any> {
    const action = this.getAction(actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found.`);
    }

    logger.info(`Executing action: ${action.name} (${actionId})`);

    // Validate and add default values for parameters
    const finalParameters: Record<string, any> = { ...parameters };

    for (const param of action.parameters) {
      // Check if required parameter is missing
      if (
        param.required &&
        (finalParameters[param.name] === undefined ||
          finalParameters[param.name] === null ||
          finalParameters[param.name] === "")
      ) {
        if (param.defaultValue !== undefined) {
          finalParameters[param.name] = param.defaultValue;
          logger.debug(
            `Using default value for required parameter ${param.name}: ${param.defaultValue}`
          );
        } else {
          throw new Error(
            `Required parameter ${param.name} for action ${action.name} is missing.`
          );
        }
      }

      // Apply default value for optional parameters if missing
      if (
        !param.required &&
        (finalParameters[param.name] === undefined ||
          finalParameters[param.name] === null) &&
        param.defaultValue !== undefined
      ) {
        finalParameters[param.name] = param.defaultValue;
        logger.debug(
          `Using default value for optional parameter ${param.name}: ${param.defaultValue}`
        );
      }
    }

    // Add contextual parameters
    if (options.userId) {
      finalParameters.userId = options.userId;
    }
    if (options.sessionId) {
      finalParameters.sessionId = options.sessionId;
    }
    if (options.messageId) {
      finalParameters.messageId = options.messageId;
    }

    try {
      logger.debug(`Executing ${action.name} with params:`, finalParameters);
      const result = await action.execute(finalParameters);
      logger.info(`Action ${action.name} executed successfully.`);

      // Log successful action execution
      if (options.userId && options.sessionId) {
        await actionLogService.logAction(
          options.userId,
          options.sessionId,
          actionId,
          action.name,
          finalParameters,
          result,
          options.messageId,
          options.metadata
        );
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to execute action ${action.name}: ${errorMessage}`);

      // Log failed action execution
      if (options.userId && options.sessionId) {
        await actionLogService.logFailedAction(
          options.userId,
          options.sessionId,
          actionId,
          action.name,
          finalParameters,
          errorMessage,
          options.messageId,
          options.metadata
        );
      }

      throw error;
    }
  }

  /**
   * Get suggested actions based on user input (or AI response)
   */
  async getSuggestedActions(
    userId: string,
    inputText: string
  ): Promise<SuggestedAction[]> {
    const lowerCaseInput = inputText.toLowerCase();
    const suggestedActions: SuggestedAction[] = [];

    // Get active context types for the user
    // Ensure contextService is imported and accessible
    // const userContext = await contextService.getContext(userId);
    // const activeContextTypes = userContext.map((ctx) => ctx.type);
    // For now, assume context check is less critical or handled differently

    // Iterate through all actions
    for (const action of this.getAllActions()) {
      let score = 0;
      const lowerActionName = action.name.toLowerCase();
      const lowerActionDesc = action.description?.toLowerCase() || "";

      // Context relevance check removed for simplicity, focus on keywords/name
      // if (action.contextTypes) { ... }

      // Check for keyword matches
      let keywordMatchCount = 0;
      if (action.keywords) {
        action.keywords.forEach((keyword) => {
          if (lowerCaseInput.includes(keyword.toLowerCase())) {
            keywordMatchCount++;
          }
        });
        // Higher score based on keyword density/presence
        if (keywordMatchCount > 0 && action.keywords.length > 0) {
          // Scale score more aggressively, up to 0.7 for matching all keywords
          score += keywordMatchCount * 0.4;
        }
      }

      // Check for name/description matches
      if (lowerCaseInput.includes(lowerActionName)) {
        score += 0.9; // Significantly increase score for direct name match
      } else if (lowerActionDesc && lowerCaseInput.includes(lowerActionDesc)) {
        score += 0.5; // Increase score for description match
      }

      // Add a bonus if both keywords and name/description match
      if (
        keywordMatchCount > 0 &&
        (lowerCaseInput.includes(lowerActionName) ||
          (lowerActionDesc && lowerCaseInput.includes(lowerActionDesc)))
      ) {
        score += 0.2; // Add a bonus for combined match
      }

      // Only include actions with a minimum score
      // Adjusted minimum suggestion score
      const minScoreThreshold = 0.4;
      if (score >= minScoreThreshold) {
        const suggestedParameters = await this.extractParametersFromInput(
          inputText, // Use original case input for extraction if needed
          action,
          userId
        );

        suggestedActions.push({
          action,
          score: Math.min(score, 1.0), // Cap score at 1.0
          suggestedParameters,
        });
      }

      logger.debug("Action:", action.name, "Score:", score);
    }

    logger.debug("Suggested actions:", suggestedActions);

    // Sort by score (highest first)
    return suggestedActions.sort((a, b) => b.score - a.score);
  }

  /**
   * Identify the best suggested action and execute it if confidence is high enough.
   * @param userId The ID of the user performing the action.
   * @param inputText The text (e.g., AI response) to analyze for actions.
   * @param confidenceThreshold Minimum score (0-1) to auto-execute.
   * @param sessionId Optional session ID for logging.
   * @param messageId Optional message ID that triggered the action.
   * @returns The result of the executed action, or null if no action was executed.
   */
  async executeTopSuggestedAction(
    userId: string,
    inputText: string,
    sessionId?: string,
    messageId?: string,
    confidenceThreshold: number = 0.4 // Default threshold
  ): Promise<{
    executed: boolean;
    actionId?: string;
    actionName?: string;
    result?: any;
    parameters?: Record<string, any>;
    error?: string;
  }> {
    logger.info(
      `Checking for suggested actions in text for user ${userId}. Threshold: ${confidenceThreshold}`
    );

    try {
      const suggestions = await this.getSuggestedActions(userId, inputText);
      logger.debug("Suggestions:", suggestions);

      if (suggestions.length > 0) {
        const topAction = suggestions[0];
        logger.info(
          `Top suggestion: ${topAction.action.name} (Score: ${topAction.score.toFixed(2)})`
        );

        if (topAction.score >= confidenceThreshold) {
          logger.info(
            `Confidence above threshold. Executing action ${topAction.action.name}.`
          );

          // Pass userId if needed by the action itself (e.g., search memories)
          const executionParams = { ...topAction.suggestedParameters, userId };

          try {
            const result = await this.executeAction(
              topAction.action.id,
              executionParams,
              {
                userId,
                sessionId,
                messageId,
                metadata: { confidence: topAction.score },
              }
            );

            logger.info(
              `Action ${topAction.action.name} executed successfully.`
            );

            return {
              executed: true,
              actionId: topAction.action.id,
              actionName: topAction.action.name,
              result,
              parameters: executionParams,
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error(
              `Error executing ${topAction.action.name}:`,
              errorMessage
            );

            return {
              executed: false,
              actionId: topAction.action.id,
              actionName: topAction.action.name,
              parameters: executionParams,
              error: errorMessage,
            };
          }
        } else {
          logger.info(
            `Top action confidence ${topAction.score.toFixed(2)} below threshold.`
          );
          return { executed: false };
        }
      } else {
        logger.info("No actions suggested.");
        return { executed: false };
      }
    } catch (error) {
      logger.error("Error during suggested action execution:", error);
      return {
        executed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract potential parameter values from user input
   */
  private async extractParametersFromInput(
    input: string,
    action: Action,
    userId?: string
  ): Promise<Record<string, any>> {
    const parameters: Record<string, any> = {};

    try {
      // First try AI-based extraction if userId is provided
      if (userId) {
        const aiParameters = await this.extractParametersWithAI(
          input,
          action,
          userId
        );

        // If AI successfully extracted parameters, use them
        if (Object.keys(aiParameters).length > 0) {
          logger.info(`Using AI-extracted parameters for ${action.id}`);
          return aiParameters;
        }
      }
    } catch (error) {
      logger.error("Error extracting parameters with AI:", error);
      // Continue with regex-based fallback
    }

    // Fallback to regex-based extraction
    logger.info(
      `Using regex fallback for parameter extraction for ${action.id}`
    );

    // Special handling for Notion note creation
    if (action.id === "notion-create-note") {
      // Extract title - look for patterns like "title: My Note Title" or "Title - My Note Title"
      const titleRegex = /(?:title[\s:-]+)([^\n]+)/i;
      const titleMatch = input.match(titleRegex);

      if (titleMatch && titleMatch[1]?.trim()) {
        parameters["title"] = titleMatch[1].split("content:")[0].trim(); // if content present then shoudn't bein title
      } else {
        // Fallback: Use first line as title if it's reasonably short
        const lines = input
          .split("\n")
          .filter((line) => line.trim().length > 0);
        if (lines.length > 0 && lines[0].length < 100) {
          parameters["title"] = lines[0].trim();
        } else {
          // Default title if no clear title is found
          parameters["title"] = "Note from " + new Date().toLocaleString();
        }
      }

      // Extract content - try to find content after specific markers
      const contentRegex = /(?:content[\s:-]+)([\s\S]+)(?:\n*$)/i;
      const contentMatch = input.match(contentRegex);

      if (contentMatch && contentMatch[1]?.trim()) {
        parameters["content"] = contentMatch[1].trim();
      } else {
        // Fallback: Use everything except the title as content
        // If we used the first line as title, use the rest as content
        if (parameters["title"] && input.includes(parameters["title"])) {
          const afterTitle = input.substring(
            input.indexOf(parameters["title"]) + parameters["title"].length
          );
          if (afterTitle.trim().length > 0) {
            parameters["content"] = afterTitle.trim();
          } else {
            parameters["content"] = input.trim(); // Just use the whole input if we can't separate
          }
        } else {
          parameters["content"] = input.trim();
        }
      }

      return parameters;
    }

    // For other actions, use improved generic extraction
    action.parameters.forEach((param) => {
      // Match parameter name followed by colon, equals, or dash, then capture text
      // This matches both single-line and multi-line values
      const regex = new RegExp(
        `${param.name}\\s*[:=-]\\s*([\\s\\S]+?)(?=\\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\\s*[:=-]|$))`,
        "i"
      );
      const match = input.match(regex);

      if (match && match[1]) {
        let value = match[1].trim();

        if (param.type === "number") {
          parameters[param.name] = parseFloat(value);
        } else if (param.type === "boolean") {
          parameters[param.name] =
            value.toLowerCase() === "true" ||
            value.toLowerCase() === "yes" ||
            value === "1";
        } else {
          parameters[param.name] = value;
        }
      } else if (param.defaultValue !== undefined) {
        parameters[param.name] = param.defaultValue;
      }
    });

    return parameters;
  }

  /**
   * Use AI to extract parameters from text
   */
  private async extractParametersWithAI(
    input: string,
    action: Action,
    userId: string
  ): Promise<Record<string, any>> {
    try {
      // Create a description of parameters for the AI
      const paramDescriptions = action.parameters
        .map((param) => {
          return `${param.name} (${param.type}${param.required ? ", required" : ""}): ${param.description}`;
        })
        .join("\n");

      // Build prompt for the AI
      const prompt = `
Your task is to extract parameters for the "${action.name}" action from the following text.
Extract ONLY the parameters needed for this action.

Action description: ${action.description}

Parameters that need to be extracted:
${paramDescriptions}

Text to extract parameters from:
"""
${input}
"""

Return the extracted parameters in the following JSON format:
{
  "paramName1": "value1",
  "paramName2": "value2"
}

If you can't extract a required parameter, provide a reasonable default based on the text or leave it empty.
Only include parameters that are mentioned in the parameter list above.
`;

      // Generate response using AI
      const response = await aiService.generateAuxiliaryResponse(
        prompt,
        {
          temperature: 0.2,
          max_tokens: 500,
        },
        "You are a helpful assistant specializing in parameter extraction for actions.",
        userId
      );

      // Extract JSON from the response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const extractedParams = JSON.parse(jsonMatch[0]);
        logger.info(
          `AI extracted parameters for ${action.id}:`,
          extractedParams
        );

        // Validate and type convert parameters
        const finalParams: Record<string, any> = {};

        for (const param of action.parameters) {
          if (extractedParams[param.name] !== undefined) {
            let value = extractedParams[param.name];

            // Type conversion
            if (param.type === "number" && typeof value === "string") {
              finalParams[param.name] = parseFloat(value);
            } else if (param.type === "boolean" && typeof value === "string") {
              finalParams[param.name] =
                value.toLowerCase() === "true" ||
                value.toLowerCase() === "yes" ||
                value === "1";
            } else {
              finalParams[param.name] = value;
            }
          } else if (param.defaultValue !== undefined) {
            finalParams[param.name] = param.defaultValue;
          }
        }

        return finalParams;
      } else {
        logger.warn("AI failed to extract parameters in valid JSON format");
        return {}; // Return empty object to fall back to regex
      }
    } catch (error) {
      logger.error("Error extracting parameters with AI:", error);
      return {}; // Return empty object to fall back to regex
    }
  }

  /**
   * Register default actions
   */
  private registerDefaultActions(): void {
    // Create Notion Note action
    // this.registerAction({
    //   id: "notion-create-note",
    //   name: "Create Notion Note",
    //   description: "Create a new note page in the user's Notion workspace.",
    //   category: "Productivity",
    //   contextTypes: ["NOTION"], // Optional: Mark relevance if Notion context exists
    //   keywords: [
    //     "notion",
    //     "note",
    //     "create note",
    //     "new note",
    //     "add note",
    //     "save note",
    //     "jot down",
    //     "document",
    //   ],
    //   parameters: [
    //     {
    //       name: "title",
    //       description: "The title of the Notion note",
    //       type: "string",
    //       required: true,
    //     },
    //     {
    //       name: "content",
    //       description: "The main content of the Notion note",
    //       type: "string",
    //       required: true,
    //     },
    //     // userId will be passed implicitly via executeTopSuggestedAction context
    //   ],
    //   execute: async (params) => {
    //     const { userId, title, content } = params;
    //     if (!userId || typeof userId !== "string") {
    //       throw new Error("User ID is required to create a Notion note.");
    //     }
    //     if (!title || typeof title !== "string") {
    //       throw new Error("Note title is required.");
    //     }
    //     if (!content || typeof content !== "string") {
    //       throw new Error("Note content is required.");
    //     }
    //     try {
    //       // Check if user has Notion connected
    //       const isConnected = await notionService.isConnected(userId);
    //       if (!isConnected) {
    //         return {
    //           success: false,
    //           message:
    //             "You don't have Notion connected. Please connect Notion in your settings first.",
    //         };
    //       }
    //       // Create the note using user's stored credentials
    //       const noteResult = await notionService.createNote(
    //         userId,
    //         title,
    //         content
    //       );
    //       return {
    //         success: true,
    //         message: `Notion note "${title}" created successfully.`,
    //         noteId: noteResult.id,
    //         noteUrl: noteResult.url,
    //       };
    //     } catch (error) {
    //       console.error("Error creating Notion note via action:", error);
    //       // Rethrow a user-friendly error or return an error object
    //       const errorMessage =
    //         error instanceof Error ? error.message : "Unknown error";
    //       throw new Error(`Failed to create Notion note: ${errorMessage}`);
    //       // Or return { success: false, message: `Failed to create Notion note: ${errorMessage}` };
    //     }
    //   },
    // });
  }

  /**
   * Check a message for potential actions and execute if confidence is high enough
   * @param userId The ID of the user
   * @param sessionId The current session ID
   * @param messageId The ID of the message that might trigger an action
   * @param messageText The content of the message to analyze for potential actions
   * @param confidenceThreshold Minimum confidence threshold for execution
   * @returns Details about the executed action or null if no action was executed
   */
  async checkAndExecuteActionsFromMessage(
    userId: string,
    sessionId: string,
    messageId: string,
    messageText: string,
    confidenceThreshold: number = 0.6
  ): Promise<{
    executed: boolean;
    actionId?: string;
    actionName?: string;
    result?: any;
    error?: string;
  }> {
    try {
      logger.info(`Checking for actions in message ${messageId}`);

      // Execute top suggested action if confidence is high enough
      return await this.executeTopSuggestedAction(
        userId,
        messageText,
        sessionId,
        messageId,
        confidenceThreshold
      );
    } catch (error) {
      logger.error(`Error checking for actions: ${error}`);
      return { executed: false, error: String(error) };
    }
  }
}

// Create a singleton instance
export const actionManager = new ActionManager();
