import express from "express";
import { socialService } from "../services/social.service";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Get the authenticated user's social profile
 * GET /api/social/profile
 */
router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await socialService.getSocialProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Error getting social profile:", error);
    res.status(500).json({ error: "Failed to get social profile" });
  }
});

/**
 * Create or update the authenticated user's social profile
 * PUT /api/social/profile
 * Body: { name, bio?, interests?, personalityTraits?, matching? }
 */
router.put("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    if (!profileData.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const profile = await socialService.updateSocialProfile(
      userId,
      profileData
    );
    res.json(profile);
  } catch (error) {
    console.error("Error updating social profile:", error);
    res.status(500).json({ error: "Failed to update social profile" });
  }
});

/**
 * Enable or disable matchmaking for the authenticated user
 * PUT /api/social/matching
 * Body: { enabled, lookingFor?, matchCriteria?, availableForMatching? }
 */
router.put("/matching", async (req, res) => {
  try {
    const userId = req.user.id;
    const { enabled, lookingFor, matchCriteria, availableForMatching } =
      req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Enabled flag is required" });
    }

    const profile = await socialService.updateSocialProfile(userId, {
      name: "",
      matching: {
        enabled,
        lookingFor,
        matchCriteria,
        availableForMatching,
      },
    });

    res.json({
      matching: profile.matching,
      success: true,
    });
  } catch (error) {
    console.error("Error updating matching settings:", error);
    res.status(500).json({ error: "Failed to update matching settings" });
  }
});

/**
 * Get the authenticated user's connections
 * GET /api/social/connections?status=connected
 */
router.get("/connections", async (req, res) => {
  try {
    const userId = req.user.id;
    const status = req.query.status as string;

    const connections = await socialService.getUserConnections(userId, status);
    res.json(connections);
  } catch (error) {
    console.error("Error getting user connections:", error);
    res.status(500).json({ error: "Failed to get user connections" });
  }
});

/**
 * Get pending connection requests for the authenticated user
 * GET /api/social/pending-requests
 */
router.get("/pending-requests", async (req, res) => {
  try {
    const userId = req.user.id;

    const pendingRequests =
      await socialService.getPendingConnectionRequests(userId);
    res.json(pendingRequests);
  } catch (error) {
    console.error("Error getting pending requests:", error);
    res.status(500).json({ error: "Failed to get pending requests" });
  }
});

/**
 * Create a connection request from the authenticated user
 * POST /api/social/connect
 * Body: { targetUserId, message? }
 */
router.post("/connect", async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId, message } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID is required" });
    }

    const connection = await socialService.createConnectionRequest(
      userId,
      targetUserId,
      message
    );
    res.status(201).json(connection);
  } catch (error) {
    console.error("Error creating connection request:", error);
    res.status(500).json({
      error: "Failed to create connection request",
      message: error.message,
    });
  }
});

/**
 * Accept a connection request for the authenticated user
 * POST /api/social/accept-connection/:connectionUserId
 */
router.post("/accept-connection/:connectionUserId", async (req, res) => {
  try {
    const userId = req.user.id;
    const { connectionUserId } = req.params;

    const success = await socialService.acceptConnection(
      userId,
      connectionUserId
    );

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({
        error: "Failed to accept connection",
        message: "Connection request not found or invalid",
      });
    }
  } catch (error) {
    console.error("Error accepting connection:", error);
    res.status(500).json({ error: "Failed to accept connection" });
  }
});

/**
 * Record an interaction between users (requires authenticated user as userA)
 * POST /api/social/interactions
 * Body: { userB, interactionType, metadata? }
 */
router.post("/interactions", async (req, res) => {
  try {
    const userA = req.user.id;
    const { userB, interactionType, metadata } = req.body;

    if (!userB || !interactionType) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["userB", "interactionType"],
      });
    }

    const success = await socialService.recordInteraction(
      userA,
      userB,
      interactionType,
      metadata
    );

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({
        error: "Failed to record interaction",
        message: "Users might not be connected or other issue",
      });
    }
  } catch (error) {
    console.error("Error recording interaction:", error);
    res.status(500).json({ error: "Failed to record interaction" });
  }
});

/**
 * Get social data for the authenticated user's context
 * GET /api/social/context-data
 */
router.get("/context-data", async (req, res) => {
  try {
    const userId = req.user.id;

    const socialData = await socialService.getUserSocialData(userId);

    if (!socialData) {
      return res.status(404).json({ error: "Social data not found" });
    }

    res.json(socialData);
  } catch (error) {
    console.error("Error getting social context data:", error);
    res.status(500).json({ error: "Failed to get social context data" });
  }
});

export default router;
