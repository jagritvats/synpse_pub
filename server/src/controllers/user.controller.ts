import { Router, Request, Response } from "express";import { authMiddleware } from "../middlewares/auth.middleware";
import { userService } from "../services/user.service";
import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("UserController");
const router = Router();

// Keep the mock types for now, but don't use the mock database
interface UserPreferences {
  theme?: "light" | "dark" | "system";
  notifications?: boolean;
  aiModel?: string;
  contextSettings?: {
    includeTimeContext?: boolean;
    includeWeatherContext?: boolean;
    includeLocationContext?: boolean;
  };
}

interface SocialConnection {
  platform: string;
  username: string;
  connected: boolean;
  lastSynced?: string;
}

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get("/profile", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;

  try {
    const user = await userService.findUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name || "",
      username: user.username,
      // Keep backward compatibility with the mock data schema
      preferences: {}, // Could be expanded in the future
      interests: [], // Could be expanded in the future
      socialConnections: [], // Could be expanded in the future
    });
  } catch (error) {
    logger.error(`Error fetching user profile for ${userId}:`, error);
    res.status(500).json({
      message: "Failed to fetch user profile",
      error: (error as Error).message,
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.id;
  const { name } = req.body;

  try {
    // Find the user first
    const user = await userService.findUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user properties
    if (name) {
      user.name = name;
    }

    // Save the updated user
    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      name: user.name || "",
      username: user.username,
    });
  } catch (error) {
    logger.error(`Error updating user profile for ${userId}:`, error);
    res.status(500).json({
      message: "Failed to update user profile",
      error: (error as Error).message,
    });
  }
});

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put("/preferences", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const { theme, notifications, aiModel, contextSettings } = req.body;

  if (!users[userId]) {
    return res.status(404).json({ message: "User not found" });
  }

  // Initialize preferences if not exists
  if (!users[userId].preferences) {
    users[userId].preferences = {};
  }

  // Update preferences
  if (theme) {
    users[userId].preferences!.theme = theme;
  }

  if (notifications !== undefined) {
    users[userId].preferences!.notifications = notifications;
  }

  if (aiModel) {
    users[userId].preferences!.aiModel = aiModel;
  }

  if (contextSettings) {
    users[userId].preferences!.contextSettings = {
      ...users[userId].preferences!.contextSettings,
      ...contextSettings,
    };
  }

  res.json(users[userId].preferences);
});

/**
 * @route   PUT /api/users/interests
 * @desc    Update user interests
 * @access  Private
 */
router.put("/interests", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const { interests } = req.body;

  if (!users[userId]) {
    return res.status(404).json({ message: "User not found" });
  }

  if (Array.isArray(interests)) {
    users[userId].interests = interests;
  }

  res.json({ interests: users[userId].interests || [] });
});

/**
 * @route   POST /api/users/social-connections
 * @desc    Add or update social connection
 * @access  Private
 */
router.post(
  "/social-connections",
  authMiddleware,
  (req: Request, res: Response) => {
    const userId = req.user.id;
    const { platform, username } = req.body;

    if (!users[userId]) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!platform || !username) {
      return res
        .status(400)
        .json({ message: "Platform and username are required" });
    }

    // Initialize social connections if not exists
    if (!users[userId].socialConnections) {
      users[userId].socialConnections = [];
    }

    // Check if connection already exists
    const existingIndex = users[userId].socialConnections!.findIndex(
      (conn) => conn.platform === platform
    );

    const connection: SocialConnection = {
      platform,
      username,
      connected: true,
      lastSynced: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing connection
      users[userId].socialConnections![existingIndex] = connection;
    } else {
      // Add new connection
      users[userId].socialConnections!.push(connection);
    }

    res.json(connection);
  }
);

/**
 * @route   DELETE /api/users/social-connections/:platform
 * @desc    Remove social connection
 * @access  Private
 */
router.delete(
  "/social-connections/:platform",
  authMiddleware,
  (req: Request, res: Response) => {
    const userId = req.user.id;
    const { platform } = req.params;

    if (!users[userId] || !users[userId].socialConnections) {
      return res.status(404).json({ message: "User or connection not found" });
    }

    // Filter out the connection
    users[userId].socialConnections = users[userId].socialConnections!.filter(
      (conn) => conn.platform !== platform
    );

    res.status(204).end();
  }
);

export default router;
