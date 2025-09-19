import { Router } from "express";import { IActivity } from "../models/activity.model";
import { activityService } from "../services/activity.service";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @route GET /api/activities
 * @desc Get all activities for the authenticated user
 * @access Private
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { active, sessionId, type, limit } = req.query;

    const activities = await activityService.getUserActivities(userId, {
      active: active === "true" ? true : active === "false" ? false : undefined,
      sessionId: sessionId as string,
      type: type as any,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ activities });
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

/**
 * @route GET /api/activities/active
 * @desc Get the current active activity for the user in a session
 * @access Private
 */
router.get("/active", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const activity = await activityService.getActiveActivity(
      userId,
      sessionId as string
    );

    if (!activity) {
      return res.json({ active: false });
    }

    res.json({ active: true, activity });
  } catch (error) {
    console.error("Error fetching active activity:", error);
    res.status(500).json({ error: "Failed to fetch active activity" });
  }
});

/**
 * @route POST /api/activities
 * @desc Start a new activity
 * @access Private
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, type, name, initialState, metadata } = req.body;

    if (!sessionId || !type || !name) {
      return res
        .status(400)
        .json({ error: "Session ID, type, and name are required" });
    }

    const activity = await activityService.startActivity(
      userId,
      sessionId,
      type,
      name,
      initialState || {},
      metadata || {}
    );

    res.status(201).json({ activity });
  } catch (error) {
    console.error("Error starting activity:", error);
    res.status(500).json({ error: "Failed to start activity" });
  }
});

/**
 * @route PUT /api/activities/:id
 * @desc Update an activity state
 * @access Private
 */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const activityId = req.params.id;
    const { stateData, metadata } = req.body;

    if (!stateData) {
      return res.status(400).json({ error: "State data is required" });
    }

    const activity = await activityService.updateActivityState(
      activityId,
      stateData,
      metadata
    );

    if (!activity) {
      return res
        .status(404)
        .json({ error: "Activity not found or not active" });
    }

    res.json({ activity });
  } catch (error) {
    console.error("Error updating activity:", error);
    res.status(500).json({ error: "Failed to update activity" });
  }
});

/**
 * @route DELETE /api/activities/:id
 * @desc End an activity
 * @access Private
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const activityId = req.params.id;

    const activity = await activityService.endActivity(activityId);

    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    res.json({ success: true, activity });
  } catch (error) {
    console.error("Error ending activity:", error);
    res.status(500).json({ error: "Failed to end activity" });
  }
});

/**
 * @route POST /api/activities/command
 * @desc Process an activity command
 * @access Private
 */
router.post("/command", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, commandText, messageId } = req.body;

    if (!sessionId || !commandText) {
      return res
        .status(400)
        .json({ error: "Session ID and command text are required" });
    }

    const result = await activityService.processActivityCommand(
      userId,
      sessionId,
      commandText,
      messageId
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing activity command:", error);
    res.status(500).json({ error: "Failed to process activity command" });
  }
});

export default router;
