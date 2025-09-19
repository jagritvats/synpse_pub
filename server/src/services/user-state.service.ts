import {
  UserState,
  IUserState,
  IUserInterest,
  IIntegration,
  IUserGoal,
} from "../models/user-state.model";
import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("UserStateService");

class UserStateService {
  /**
   * Get or create the user state document for a given user ID.
   */
  async getOrCreateUserState(userId: string): Promise<IUserState> {
    logger.debug(
      `Attempting to get or create user state for userId: ${userId}`
    );
    if (!userId) {
      throw new Error("User ID is required to get or create user state.");
    }

    let userState = await UserState.findOne({ userId }).exec();

    if (!userState) {
      logger.info(
        `No user state found for userId: ${userId}. Creating new document.`
      );
      userState = new UserState({
        userId,
        interests: [],
        integrations: [],
      });
      await userState.save();
      logger.info(`Successfully created new user state for userId: ${userId}`);
    } else {
      logger.debug(`Found existing user state for userId: ${userId}`);
    }

    return userState;
  }

  /**
   * Update the user's interests.
   * Replaces the entire interests array.
   */
  async updateInterests(
    userId: string,
    interests: IUserInterest[]
  ): Promise<IUserState | null> {
    logger.debug(`Updating interests for userId: ${userId}`);
    logger.debug("Received interests data:", JSON.stringify(interests));

    // Basic validation
    if (!Array.isArray(interests)) {
      logger.error("Interests is not an array:", interests);
      throw new Error("Interests must be an array.");
    }

    try {
      interests.forEach((interest, index) => {
        if (!interest.topic || typeof interest.level !== "number") {
          logger.error(`Invalid interest at index ${index}:`, interest);
          throw new Error(
            `Each interest must have a topic (string) and level (number). Invalid at index ${index}.`
          );
        }

        // Ensure addedAt is a Date object
        if (interest.addedAt) {
          if (typeof interest.addedAt === "string") {
            interest.addedAt = new Date(interest.addedAt);
          }
        } else {
          interest.addedAt = new Date();
        }

        logger.debug(`Validated interest ${index}:`, interest);
      });

      const userState = await this.getOrCreateUserState(userId);

      // Update with validated interests
      userState.interests = interests;

      logger.debug("Saving user state with interests:", userState.interests);
      await userState.save();

      logger.info(
        `Successfully updated ${interests.length} interests for userId: ${userId}`
      );
      return userState;
    } catch (error) {
      logger.error(`Error updating interests for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get the user's interests.
   */
  async getInterests(userId: string): Promise<IUserInterest[]> {
    const userState = await this.getOrCreateUserState(userId);
    return userState.interests;
  }

  /**
   * Update the user's integrations.
   * Replaces the entire integrations array.
   */
  async updateIntegrations(
    userId: string,
    integrations: IIntegration[]
  ): Promise<IUserState | null> {
    logger.debug(`Updating integrations for userId: ${userId}`);
    if (!Array.isArray(integrations)) {
      throw new Error("Integrations must be an array.");
    }
    // Add more validation as needed for specific integration types

    const userState = await this.getOrCreateUserState(userId);
    userState.integrations = integrations;
    await userState.save();
    logger.info(`Successfully updated integrations for userId: ${userId}`);
    return userState;
  }

  /**
   * Get the user's integrations.
   */
  async getIntegrations(userId: string): Promise<IIntegration[]> {
    const userState = await this.getOrCreateUserState(userId);
    return userState.integrations;
  }

  /**
   * Save Notion integration credentials for a user
   */
  async saveNotionCredentials(
    userId: string,
    credentials: { token: string; pageId?: string; enabled?: boolean }
  ): Promise<IIntegration> {
    logger.debug(`Saving Notion credentials for userId: ${userId}`);

    if (!credentials.token) {
      throw new Error("Notion token is required");
    }

    const userState = await this.getOrCreateUserState(userId);

    // Find existing Notion integration or create a new one
    const notionIndex = userState.integrations.findIndex(
      (i) => i.platform === "notion"
    );

    const notionIntegration: IIntegration =
      notionIndex >= 0
        ? userState.integrations[notionIndex]
        : {
            platform: "notion",
            enabled: true,
            credentials: {},
            lastSync: new Date(),
            metadata: {},
          };

    // Update the integration
    notionIntegration.credentials = {
      ...notionIntegration.credentials,
      token: credentials.token,
      pageId: credentials.pageId,
    };

    // Update enabled state if provided
    if (credentials.enabled !== undefined) {
      notionIntegration.enabled = credentials.enabled;
    }

    // Update lastSync
    notionIntegration.lastSync = new Date();

    // Save to the array
    if (notionIndex >= 0) {
      userState.integrations[notionIndex] = notionIntegration;
    } else {
      userState.integrations.push(notionIntegration);
    }

    await userState.save();
    logger.info(`Successfully saved Notion credentials for userId: ${userId}`);

    return notionIntegration;
  }

  /**
   * Get Notion credentials for a user
   */
  async getNotionCredentials(
    userId: string
  ): Promise<{ token?: string; pageId?: string; enabled?: boolean } | null> {
    logger.debug(`Getting Notion credentials for userId: ${userId}`);

    const userState = await this.getOrCreateUserState(userId);
    const notionIntegration = userState.integrations.find(
      (i) => i.platform === "notion"
    );

    if (!notionIntegration || !notionIntegration.credentials) {
      return null;
    }

    return {
      token: notionIntegration.credentials.token,
      pageId: notionIntegration.credentials.pageId,
      enabled: notionIntegration.enabled,
    };
  }

  /**
   * Get the user's goals.
   */
  async getUserGoals(userId: string): Promise<IUserGoal[]> {
    logger.debug(`Getting goals for userId: ${userId}`);
    const userState = await this.getOrCreateUserState(userId);
    return userState.userGoals || [];
  }

  /**
   * Update the user's goals.
   * Replaces the entire goals array.
   */
  async updateUserGoals(
    userId: string,
    goals: Partial<IUserGoal>[]
  ): Promise<IUserGoal[]> {
    logger.debug(`Updating goals for userId: ${userId}`);

    // Basic validation
    if (!Array.isArray(goals)) {
      throw new Error("Goals must be an array.");
    }

    // Format and validate goals
    const formattedGoals = goals.map((goal) => {
      if (!goal.goal || typeof goal.priority !== "number") {
        throw new Error(
          "Each goal must have a goal description and priority number."
        );
      }

      if (goal.priority < 1 || goal.priority > 10) {
        throw new Error("Goal priority must be between 1 and 10.");
      }

      return {
        goal: goal.goal,
        priority: goal.priority,
        progress: goal.progress || 0,
        createdAt: goal.createdAt || new Date(),
      };
    });

    // Sort by priority (highest first)
    formattedGoals.sort((a, b) => b.priority - a.priority);

    const userState = await this.getOrCreateUserState(userId);
    userState.userGoals = formattedGoals;
    await userState.save();

    logger.info(`Successfully updated goals for userId: ${userId}`);
    return userState.userGoals;
  }

  // Add more methods here as needed for other user state properties
}

export const userStateService = new UserStateService();
