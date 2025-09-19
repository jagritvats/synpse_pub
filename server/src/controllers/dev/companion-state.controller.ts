import express from "express";import { companionStateService } from "../../services/companion-state.service";
import { CompanionEmotion } from "../../models/companion-state.model";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Get companion state for the authenticated user
 * GET /api/companion-state/
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const state = await companionStateService.getOrCreateCompanionState(userId);
    res.json(state);
  } catch (error) {
    console.error("Error getting companion state:", error);
    res.status(500).json({ error: "Failed to get companion state" });
  }
});

/**
 * Update companion emotion for the authenticated user
 * PUT /api/companion-state/emotion
 * Body: { emotion: string }
 */
router.put("/emotion", async (req, res) => {
  try {
    const userId = req.user.id;
    const { emotion } = req.body;

    // Validate emotion
    if (!Object.values(CompanionEmotion).includes(emotion)) {
      return res.status(400).json({
        error: "Invalid emotion",
        validEmotions: Object.values(CompanionEmotion),
      });
    }

    const state = await companionStateService.updateEmotion(userId, emotion);
    res.json(state);
  } catch (error) {
    console.error("Error updating emotion:", error);
    res.status(500).json({ error: "Failed to update emotion" });
  }
});

/**
 * Add a thought for the authenticated user
 * POST /api/companion-state/thoughts
 * Body: { thought: string, category?: string, priority?: number, metadata?: object }
 */
router.post("/thoughts", async (req, res) => {
  try {
    const userId = req.user.id;
    const { thought, category, priority, metadata } = req.body;

    if (!thought) {
      return res.status(400).json({ error: "Thought is required" });
    }

    const state = await companionStateService.addThought(
      userId,
      thought,
      category || "general",
      priority || 1,
      metadata
    );

    res.json(state);
  } catch (error) {
    console.error("Error adding thought:", error);
    res.status(500).json({ error: "Failed to add thought" });
  }
});

/**
 * Get recent thoughts for the authenticated user
 * GET /api/companion-state/thoughts?limit=10&category=general
 */
router.get("/thoughts", async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;

    const thoughts = await companionStateService.getRecentThoughts(
      userId,
      limit,
      category
    );

    res.json(thoughts);
  } catch (error) {
    console.error("Error getting thoughts:", error);
    res.status(500).json({ error: "Failed to get thoughts" });
  }
});

/**
 * Add or update a thought loop for the authenticated user
 * POST /api/companion-state/thought-loops
 * Body: { pattern: string, intensity?: number, triggers?: string[] }
 */
router.post("/thought-loops", async (req, res) => {
  try {
    const userId = req.user.id;
    const { pattern, intensity, triggers } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: "Pattern is required" });
    }

    const state = await companionStateService.addThoughtLoop(
      userId,
      pattern,
      intensity || 1,
      triggers || []
    );

    res.json(state);
  } catch (error) {
    console.error("Error adding thought loop:", error);
    res.status(500).json({ error: "Failed to add thought loop" });
  }
});

/**
 * Update goals for the authenticated user
 * PUT /api/companion-state/goals
 * Body: { goals: Array<{ description: string, priority: number }> }
 */
router.put("/goals", async (req, res) => {
  try {
    const userId = req.user.id;
    const { goals } = req.body;

    if (!Array.isArray(goals)) {
      return res.status(400).json({ error: "Goals must be an array" });
    }

    // Validate goals
    for (const goal of goals) {
      if (!goal.description || typeof goal.priority !== "number") {
        return res.status(400).json({
          error: "Each goal must have a description and priority",
        });
      }
    }

    const state = await companionStateService.setGoals(userId, goals);
    res.json(state);
  } catch (error) {
    console.error("Error updating goals:", error);
    res.status(500).json({ error: "Failed to update goals" });
  }
});

/**
 * Update user-defined goals for the authenticated user
 * PUT /api/companion-state/user-goals
 * Body: { goals: Array<{ goal: string, priority: number }> }
 */
router.put("/user-goals", async (req, res) => {
  try {
    const userId = req.user.id;
    const { goals } = req.body;

    if (!Array.isArray(goals)) {
      return res.status(400).json({ error: "Goals must be an array" });
    }

    // Validate goals
    for (const goal of goals) {
      if (!goal.goal || typeof goal.priority !== "number") {
        return res.status(400).json({
          error: "Each goal must have a goal description and priority number",
        });
      }
      if (goal.priority < 1 || goal.priority > 10) {
        return res.status(400).json({
          error: "Goal priority must be between 1 and 10",
        });
      }
    }

    // Prepare goals in the format expected by the service
    const goalsInput = goals.map((g) => ({
      goal: g.goal,
      priority: g.priority,
    }));

    const state = await companionStateService.setUserDefinedGoals(
      userId,
      goalsInput
    );
    res.json(state);
  } catch (error) {
    console.error("Error updating user-defined goals:", error);
    res.status(500).json({ error: "Failed to update user-defined goals" });
  }
});

/**
 * Get focus areas for the authenticated user
 * GET /api/companion-state/focus-areas
 */
router.get("/focus-areas", async (req, res) => {
  try {
    const userId = req.user.id;
    const focusAreas = await companionStateService.getFocusAreas(userId);
    res.json(focusAreas);
  } catch (error) {
    console.error("Error getting focus areas:", error);
    res.status(500).json({ error: "Failed to get focus areas" });
  }
});

/**
 * Update metadata for the authenticated user
 * PUT /api/companion-state/metadata
 * Body: { metadata: object }
 */
router.put("/metadata", async (req, res) => {
  try {
    const userId = req.user.id;
    const { metadata } = req.body;

    if (!metadata || typeof metadata !== "object") {
      return res.status(400).json({ error: "Metadata must be an object" });
    }

    const state = await companionStateService.updateMetadata(userId, metadata);
    res.json(state);
  } catch (error) {
    console.error("Error updating metadata:", error);
    res.status(500).json({ error: "Failed to update metadata" });
  }
});

/**
 * Get AI's internal interests
 * GET /api/companion-state/ai/interests
 */
router.get("/ai/interests", async (req, res) => {
  try {
    const userId = req.user.id;
    const interests = await companionStateService.getAIInterests(userId);
    res.json(interests);
  } catch (error) {
    console.error("Error getting AI interests:", error);
    res.status(500).json({ error: "Failed to get AI interests" });
  }
});

/**
 * Update AI's internal interests
 * PUT /api/companion-state/ai/interests
 * Body: { interests: Array<{ topic: string, level: number }> }
 */
router.put("/ai/interests", async (req, res) => {
  try {
    const userId = req.user.id;
    const { interests } = req.body;
    if (!Array.isArray(interests)) {
      return res.status(400).json({ error: "Interests must be an array" });
    }
    // Add validation if needed
    const state = await companionStateService.updateAIInterests(
      userId,
      interests
    );
    res.json(state.metadata.aiInterests);
  } catch (error) {
    console.error("Error updating AI interests:", error);
    res.status(500).json({ error: "Failed to update AI interests" });
  }
});

/**
 * Get AI's internal goals
 * GET /api/companion-state/ai/goals
 */
router.get("/ai/goals", async (req, res) => {
  try {
    const userId = req.user.id;
    const goals = await companionStateService.getAIInternalGoals(userId);
    res.json(goals);
  } catch (error) {
    console.error("Error getting AI goals:", error);
    res.status(500).json({ error: "Failed to get AI goals" });
  }
});

/**
 * Update AI's internal goals
 * PUT /api/companion-state/ai/goals
 * Body: { goals: Array<{ goal: string, priority: number, progress?: number }> }
 */
router.put("/ai/goals", async (req, res) => {
  try {
    const userId = req.user.id;
    const { goals } = req.body;
    if (!Array.isArray(goals)) {
      return res.status(400).json({ error: "Goals must be an array" });
    }
    // Add validation if needed
    const state = await companionStateService.updateAIInternalGoals(
      userId,
      goals
    );
    res.json(state.metadata.aiInternalGoals);
  } catch (error) {
    console.error("Error updating AI goals:", error);
    res.status(500).json({ error: "Failed to update AI goals" });
  }
});

export default router;
