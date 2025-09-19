import { v4 as uuidv4 } from "uuid";import {
  ActivityType,
  IRoleplayState,
  IGameState,
  IBrainstormState,
} from "../models/activity.model";
import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("ActivityFactoryService");

/**
 * Factory service to create appropriate activity states based on type
 */
class ActivityFactoryService {
  /**
   * Create initial state for a roleplay activity
   */
  createRoleplayState(
    name: string,
    initialParams: Partial<IRoleplayState> & {
      userGoal?: string;
      assistantGoal?: string;
      goal?: string;
    } = {}
  ): IRoleplayState {
    logger.debug(`Creating roleplay state with name: ${name}`);

    const baseScenario = initialParams.scenario || name || "Roleplay session";

    // Define default characters if none are provided
    let characters = initialParams.characters;
    if (!characters || characters.length === 0) {
      characters = [
        {
          name: initialParams.userCharacter || "User Protagonist",
          description: "The main character played by the user.",
          role: "user",
        },
        {
          name: initialParams.aiCharacter || "AI Narrator",
          description: "Guides the story and plays other characters.",
          role: "ai",
        },
      ];
      logger.debug("No characters provided, using defaults:", characters);
    }

    // Create default roleplay state with any provided parameters
    return {
      scenario: baseScenario,
      setting: initialParams.setting || "Modern day",
      era: initialParams.era,
      characters: characters, // Use potentially defaulted characters
      plot: initialParams.plot,
      currentScene: initialParams.currentScene || "Opening scene",
      recentEvents: initialParams.recentEvents || [],
      eventLog: initialParams.eventLog || [],
      userCharacter:
        initialParams.userCharacter ||
        characters.find((c) => c.role === "user")?.name ||
        "User Protagonist",
      aiCharacter:
        initialParams.aiCharacter ||
        characters.find((c) => c.role === "ai")?.name ||
        "AI Narrator",
      mood: initialParams.mood || "neutral",
      items: initialParams.items || {},
      locations: initialParams.locations || {},
      // Goals are handled by ActivityService.startActivity which sets top-level fields
      // But we can include character goals if provided initially
    };
  }

  /**
   * Create initial state for a game activity
   */
  createGameState(
    gameType: string,
    initialParams: Partial<IGameState> = {}
  ): IGameState {
    logger.debug(`Creating game state of type: ${gameType}`);

    // Initialize with type-specific defaults
    if (gameType === "tictactoe") {
      return {
        gameType,
        board: initialParams.board || [
          [null, null, null],
          [null, null, null],
          [null, null, null],
        ],
        currentPlayer: initialParams.currentPlayer || "X", // User is X, AI is O
        moves: initialParams.moves || 0,
        winner: initialParams.winner || null,
        score: initialParams.score || { X: 0, O: 0 },
        rules: "Classic tic-tac-toe. Get three in a row to win.",
        difficulty: initialParams.difficulty || "normal",
      };
    }

    // Generic game state for other games
    return {
      gameType,
      currentPlayer: initialParams.currentPlayer || "user",
      score: initialParams.score || { user: 0, ai: 0 },
      rules: initialParams.rules || "Standard rules apply",
      difficulty: initialParams.difficulty || "normal",
      ...initialParams,
    };
  }

  /**
   * Create initial state for a brainstorm activity
   */
  createBrainstormState(
    topic: string,
    initialParams: Partial<IBrainstormState> = {}
  ): IBrainstormState {
    logger.debug(`Creating brainstorm state for topic: ${topic}`);

    return {
      topic,
      ideas: initialParams.ideas || [],
      categories: initialParams.categories || [],
      phase: initialParams.phase || "ideation",
      goal: initialParams.goal || `Generate creative ideas related to ${topic}`,
      constraints: initialParams.constraints || [],
    };
  }

  /**
   * Parse natural language input to extract activity parameters
   */
  parseActivityParameters(
    type: ActivityType,
    input: string
  ): Record<string, any> {
    logger.debug(`Parsing parameters for ${type} from: ${input}`);

    // If type is undefined or null, default to ROLEPLAY to prevent errors
    if (!type) {
      logger.warn(
        `Received undefined/null activity type. Defaulting to ROLEPLAY for parameter parsing.`
      );
      type = ActivityType.ROLEPLAY;
    }

    const params: Record<string, any> = {};

    if (type === ActivityType.ROLEPLAY) {
      // Extract roleplay parameters like setting, era, characters
      const settingMatch = input.match(
        /in\s+(?:the\s+)?([\w\s,']+)(?:setting|world|universe|location)/i
      );
      if (settingMatch) params.setting = settingMatch[1].trim();

      const eraMatch = input.match(
        /(?:in|during)\s+(?:the\s+)?([\w\s,']+)(?:times|era|period|age)/i
      );
      if (eraMatch) params.era = eraMatch[1].trim();

      const characterMatch = input.match(
        /(?:as|playing|be|I(?:'m| am))\s+(?:a|an)?\s+([\w\s,']+)(?:and you(?:'re| are)(?:a|an)?\s+([\w\s,']+))?/i
      );
      if (characterMatch) {
        if (characterMatch[1]) {
          params.userCharacter = characterMatch[1].trim();
          params.characters = [{ name: params.userCharacter, role: "user" }];
        }
        if (characterMatch[2]) {
          params.aiCharacter = characterMatch[2].trim();
          if (params.characters) {
            params.characters.push({ name: params.aiCharacter, role: "ai" });
          } else {
            params.characters = [{ name: params.aiCharacter, role: "ai" }];
          }
        }
      }
    } else if (type === ActivityType.GAME) {
      // Extract game parameters like difficulty
      const difficultyMatch = input.match(
        /(?:on|at|in)\s+(easy|medium|hard|difficult|expert|normal)\s+(?:mode|difficulty|level)/i
      );
      if (difficultyMatch) params.difficulty = difficultyMatch[1].toLowerCase();

      // Detect game type
      if (/tic[-\s]?tac[-\s]?toe/i.test(input)) {
        params.gameType = "tictactoe";
      } else if (/chess/i.test(input)) {
        params.gameType = "chess";
      } else if (/hangman/i.test(input)) {
        params.gameType = "hangman";
      } else if (/word[-\s]?guess/i.test(input)) {
        params.gameType = "wordguess";
      }
    } else if (type === ActivityType.BRAINSTORM) {
      // Extract brainstorming parameters
      const topicMatch = input.match(/about\s+([\w\s,']+)/i);
      if (topicMatch) params.topic = topicMatch[1].trim();

      // Try to extract topic from a command like "/startactivity brainstorming [topic]"
      if (!params.topic) {
        const activityCommandMatch = input.match(
          /\/(startactivity|start|begin)\s+brainstorm(?:ing)?\s+([\w\s,']+)/i
        );
        if (activityCommandMatch && activityCommandMatch[2]) {
          params.topic = activityCommandMatch[2].trim();
          logger.debug(
            `Extracted brainstorm topic from command: ${params.topic}`
          );
        }

        // Handle the case where only the topic is provided with /startactivity
        if (!params.topic) {
          const simpleActivityCommand = input.match(
            /\/(startactivity)\s+([\w\s,']+)/i
          );
          if (simpleActivityCommand && simpleActivityCommand[2]) {
            params.topic = simpleActivityCommand[2].trim();
            logger.debug(
              `Extracted brainstorm topic from simple command: ${params.topic}`
            );
          }
        }
      }

      const goalMatch = input.match(/goal(?:\s+is)?\s+(?:to\s+)?([\w\s,']+)/i);
      if (goalMatch) params.goal = goalMatch[1].trim();
    }

    return params;
  }

  /**
   * Create appropriate initial state based on activity type
   */
  createInitialState(
    type: ActivityType,
    name: string,
    inputText: string = "",
    additionalParams: Record<string, any> = {}
  ): any {
    // Handle undefined/null type
    if (!type) {
      logger.warn(
        `Received undefined/null activity type in createInitialState. Defaulting to ROLEPLAY.`
      );
      type = ActivityType.ROLEPLAY;
    }

    // Parse parameters from input text
    const parsedParams = this.parseActivityParameters(type, inputText);

    // Merge parsed parameters with explicit additional parameters
    const combinedParams = { ...parsedParams, ...additionalParams };

    // Add overall goal if present
    if (combinedParams.goal) {
      console.log(`Factory: Found overall goal: ${combinedParams.goal}`);
    }

    // Create state based on activity type
    switch (type) {
      case ActivityType.ROLEPLAY:
        // Pass combined params which might include character/goal details
        return this.createRoleplayState(name, combinedParams);

      case ActivityType.GAME:
        const gameState = this.createGameState(
          combinedParams.gameType || "generic",
          combinedParams
        );
        // Add goal if specified
        if (combinedParams.goal) gameState.goal = combinedParams.goal;
        return gameState;

      case ActivityType.BRAINSTORM:
        const bsState = this.createBrainstormState(
          combinedParams.topic || name,
          combinedParams
        );
        // Add goal if specified or default for brainstorm
        bsState.goal =
          combinedParams.goal ||
          bsState.goal ||
          `Generate ideas for ${bsState.topic}`;
        return bsState;

      case ActivityType.CUSTOM:
      case ActivityType.NORMAL:
      default:
        // For custom or normal activities, just return the combined parameters
        return combinedParams;
    }
  }

  /**
   * Calculate relevance of a message to an activity
   */
  calculateMessageRelevance(
    activityType: ActivityType,
    activityState: any,
    messageText: string
  ): number {
    // Score from 0 to 1, where 1 is highly relevant
    if (!messageText) return 0;

    // Handle undefined/null type
    if (!activityType) {
      logger.warn(
        `Received undefined/null activity type in calculateMessageRelevance. Defaulting to ROLEPLAY.`
      );
      activityType = ActivityType.ROLEPLAY;
    }

    let score = 0;
    const lowerText = messageText.toLowerCase();

    // Generic relevance indicators - ending phrases
    if (
      /(?:end|stop|quit|exit)\s+(?:the\s+)?(?:activity|session|game|roleplay)/i.test(
        lowerText
      )
    ) {
      return 0.2; // Explicitly trying to end the activity
    }

    // Type-specific relevance calculation
    switch (activityType) {
      case ActivityType.ROLEPLAY: {
        const state = activityState as IRoleplayState;

        // Check for roleplay elements
        if (
          state.scenario &&
          lowerText.includes(state.scenario.toLowerCase())
        ) {
          score += 0.3;
        }

        if (state.setting && lowerText.includes(state.setting.toLowerCase())) {
          score += 0.2;
        }

        // Character references
        if (state.characters && state.characters.length > 0) {
          for (const character of state.characters) {
            if (
              character.name &&
              lowerText.includes(character.name.toLowerCase())
            ) {
              score += 0.3;
            }
          }
        }

        // Speaking in character
        if (/^\s*["']|["']\s*$|said|says|asked|tells|spoke/i.test(lowerText)) {
          score += 0.4;
        }

        // Actions in roleplay
        if (/^\s*\*|\*\s*$|\([^)]*\)/i.test(lowerText)) {
          score += 0.4;
        }

        break;
      }

      case ActivityType.GAME: {
        const state = activityState as IGameState;

        // Game-specific terms
        if (state.gameType === "tictactoe") {
          if (
            /(?:place|put|mark|set|move)[\s\w]*(?:top|middle|bottom|center|left|right|\d+)/i.test(
              lowerText
            )
          ) {
            score += 0.8; // High relevance for move descriptions
          }
          if (/(?:x|o)[\s\w]*(?:wins|won)/i.test(lowerText)) {
            score += 0.7;
          }
        }

        // General game terms
        if (
          /(?:player|turn|move|board|win|lose|play|game|score)/i.test(lowerText)
        ) {
          score += 0.5;
        }

        break;
      }

      case ActivityType.BRAINSTORM: {
        const state = activityState as IBrainstormState;

        // Check for topic relevance
        if (state.topic && lowerText.includes(state.topic.toLowerCase())) {
          score += 0.3;
        }

        // Brainstorming indicators
        if (
          /(?:idea|thought|concept|suggestion|brainstorm|what about|how about|maybe|perhaps|consider)/i.test(
            lowerText
          )
        ) {
          score += 0.5;
        }

        // Phase-specific language
        if (
          state.phase === "voting" &&
          /(?:vote|prefer|like|choose|select|pick)/i.test(lowerText)
        ) {
          score += 0.6;
        }

        if (
          state.phase === "refinement" &&
          /(?:refine|improve|enhance|modify|change|adjust)/i.test(lowerText)
        ) {
          score += 0.6;
        }

        break;
      }
    }

    // Cap the score at 1.0
    return Math.min(score, 1.0);
  }
}

// Export a singleton instance for immediate use
export const activityFactoryService = new ActivityFactoryService();
