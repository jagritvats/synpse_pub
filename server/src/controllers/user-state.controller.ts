import express, { Request, Response } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { userStateService } from "../services/user-state.service";
import { loggerFactory } from "../utils/logger.service";
import { companionStateService } from "../services/companion-state.service";
import { contextService } from "../services/context.service";

const logger = loggerFactory.getLogger("UserStateController");
const router = express.Router();

// Apply auth middleware to all user-state routes
router.use(authMiddleware);

/**
 * GET /api/user-state - Get the full user state
 */
router.get("/", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;
  try {
    const userState = await userStateService.getOrCreateUserState(userId);
    res.json(userState);
  } catch (error) {
    logger.error(`Error fetching user state for ${userId}:`, error);
    res.status(500).json({
      message: "Failed to fetch user state",
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/user-state/interests - Get user interests
 */
router.get("/interests", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const interests = await userStateService.getInterests(req.user.id);
    return res.json(interests);
  } catch (error) {
    logger.error("Error fetching user interests:", error);
    return res.status(500).json({
      message: "Failed to fetch interests",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/user-state/interests - Update user interests
 */
router.put("/interests", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    logger.debug("PUT /interests request body:", req.body);

    const { interests } = req.body;
    if (!Array.isArray(interests)) {
      logger.error("Interests is not an array:", interests);
      return res.status(400).json({ message: "Interests must be an array" });
    }

    logger.debug("Received interests array:", interests);

    // Validate each interest object
    for (const interest of interests) {
      if (!interest.topic || typeof interest.level !== "number") {
        logger.error("Invalid interest object:", interest);
        return res.status(400).json({
          message:
            "Each interest must have a topic (string) and level (number).",
          receivedInterest: interest,
        });
      }
    }

    const updatedUserState = await userStateService.updateInterests(
      req.user.id,
      interests
    );

    logger.info(
      `Successfully updated interests for user ${req.user.id}, count: ${updatedUserState?.interests.length}`
    );

    return res.json(updatedUserState?.interests || []);
  } catch (error) {
    logger.error("Error updating user interests:", error);
    return res.status(500).json({
      message: "Failed to update interests",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/user-state/integrations - Get user integrations
 */
router.get("/integrations", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const integrations = await userStateService.getIntegrations(req.user.id);
    return res.json(integrations);
  } catch (error) {
    logger.error("Error fetching user integrations:", error);
    return res.status(500).json({
      message: "Failed to fetch integrations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/user-state/integrations - Update user integrations
 */
router.put("/integrations", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { integrations } = req.body;
    if (!Array.isArray(integrations)) {
      return res.status(400).json({ message: "Integrations must be an array" });
    }

    const updatedUserState = await userStateService.updateIntegrations(
      req.user.id,
      integrations
    );
    return res.json(updatedUserState?.integrations || []);
  } catch (error) {
    logger.error("Error updating user integrations:", error);
    return res.status(500).json({
      message: "Failed to update integrations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/user-state/global-prompt - Get user's global prompt
 */
router.get("/global-prompt", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;
  try {
    const userState = await userStateService.getOrCreateUserState(userId);
    res.json({ prompt: userState.globalPrompt || "" });
  } catch (error) {
    logger.error(`Error fetching global prompt for ${userId}:`, error);
    res.status(500).json({
      message: "Failed to fetch global prompt",
      error: (error as Error).message,
    });
  }
});

/**
 * PUT /api/user-state/global-prompt - Update user's global prompt
 */
router.put("/global-prompt", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;
  const { prompt } = req.body;
  try {
    const userState = await userStateService.getOrCreateUserState(userId);
    userState.globalPrompt = prompt;
    await userState.save();
    res.json({ prompt: userState.globalPrompt });
  } catch (error) {
    logger.error(`Error updating global prompt for ${userId}:`, error);
    res.status(400).json({
      message: "Failed to update global prompt",
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/user-state/integration/:platform - Get specific integration details
 */
router.get("/integration/:platform", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;
  const { platform } = req.params;

  try {
    const integrations = await userStateService.getIntegrations(userId);
    const integration = integrations.find((i) => i.platform === platform);

    if (!integration) {
      return res.status(404).json({
        message: `Integration for platform '${platform}' not found`,
      });
    }

    res.json(integration);
  } catch (error) {
    logger.error(
      `Error fetching ${platform} integration for ${userId}:`,
      error
    );
    res.status(500).json({
      message: `Failed to fetch ${platform} integration`,
      error: (error as Error).message,
    });
  }
});

/**
 * PUT /api/user-state/integration/:platform - Update specific integration
 */
router.put("/integration/:platform", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;
  const { platform } = req.params;
  const integrationData = req.body;

  try {
    const integrations = await userStateService.getIntegrations(userId);
    const updatedIntegrations = [...integrations];

    const existingIndex = integrations.findIndex(
      (i) => i.platform === platform
    );
    if (existingIndex >= 0) {
      // Update existing integration
      updatedIntegrations[existingIndex] = {
        ...updatedIntegrations[existingIndex],
        ...integrationData,
        platform, // Ensure platform remains the same
      };
    } else {
      // Add new integration
      updatedIntegrations.push({
        platform,
        enabled: integrationData.enabled || false,
        credentials: integrationData.credentials || {},
        lastSync: null,
        ...integrationData,
      });
    }

    const updatedState = await userStateService.updateIntegrations(
      userId,
      updatedIntegrations
    );

    // Find and return the updated integration
    const updatedIntegration = updatedState?.integrations.find(
      (i) => i.platform === platform
    );
    if (!updatedIntegration) {
      return res.status(404).json({
        message: `Integration for platform '${platform}' not found after update`,
      });
    }

    res.json(updatedIntegration);
  } catch (error) {
    logger.error(
      `Error updating ${platform} integration for ${userId}:`,
      error
    );
    res.status(400).json({
      message: `Failed to update ${platform} integration`,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/user-state/user-goals - Get user-defined goals
 */
router.get("/user-goals", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;

  try {
    const goals = await userStateService.getUserGoals(userId);
    res.json(goals);
  } catch (error) {
    logger.error(`Error fetching user goals for ${userId}:`, error);
    res.status(500).json({
      message: "Failed to fetch user goals",
      error: (error as Error).message,
    });
  }
});

/**
 * PUT /api/user-state/user-goals - Update user-defined goals
 */
router.put("/user-goals", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;

  try {
    const { goals } = req.body;

    if (!Array.isArray(goals)) {
      return res.status(400).json({ message: "Goals must be an array" });
    }

    // Validate goals
    for (const goal of goals) {
      if (!goal.goal || typeof goal.priority !== "number") {
        return res.status(400).json({
          message: "Each goal must have a goal description and priority number",
        });
      }
      if (goal.priority < 1 || goal.priority > 10) {
        return res.status(400).json({
          message: "Goal priority must be between 1 and 10",
        });
      }
    }

    const updatedGoals = await userStateService.updateUserGoals(userId, goals);
    res.json(updatedGoals);
  } catch (error) {
    logger.error(`Error updating user goals for ${userId}:`, error);
    res.status(500).json({
      message: "Failed to update user goals",
      error: (error as Error).message,
    });
  }
});

/**
 * Update user's stated desires about what they want from the companion
 *
 * POST /api/user-state/companion-desires
 */
router.post(
  "/companion-desires",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { desireStatement } = req.body;

    if (!desireStatement || typeof desireStatement !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid desire statement text is required",
      });
    }

    try {
      // Update the user's desires in the companion state
      await companionStateService.updateUserStatedDesires(
        userId,
        desireStatement
      );

      // Also inject it as context
      await contextService.injectUserDesireContext(userId, desireStatement);

      return res.status(200).json({
        success: true,
        message: "User's companion desires updated successfully",
      });
    } catch (error) {
      console.error("Error updating companion desires:", error);
      return res.status(500).json({
        success: false,
        message:
          "An error occurred while updating the user's companion desires",
      });
    }
  }
);

/**
 * Get user's stated desires about what they want from the companion
 *
 * GET /api/user-state/companion-desires
 */
router.get(
  "/companion-desires",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.user.id;

    try {
      // Get the user's desires from the companion state
      const desireStatement =
        await companionStateService.getUserStatedDesires(userId);

      return res.status(200).json({
        success: true,
        data: {
          statement: desireStatement,
        },
      });
    } catch (error) {
      console.error("Error fetching companion desires:", error);
      return res.status(500).json({
        success: false,
        message:
          "An error occurred while fetching the user's companion desires",
      });
    }
  }
);

export default router;
