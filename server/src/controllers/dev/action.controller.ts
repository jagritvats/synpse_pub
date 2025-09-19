import express from "express";
import { actionManager, Action } from "../../services/action-manager.service";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = express.Router();

// Public routes (no auth needed)

/**
 * @route GET /api/actions
 * @description Get all available actions
 * @access Public
 */
router.get("/", (req, res) => {
  // ... existing code ...
});

/**
 * @route GET /api/actions/category/:category
 * @description Get actions by category
 * @access Public
 */
router.get("/category/:category", (req, res) => {
  // ... existing code ...
});

/**
 * @route GET /api/actions/context/:contextType
 * @description Get actions by context type
 * @access Public
 */
router.get("/context/:contextType", (req, res) => {
  // ... existing code ...
});

/**
 * @route GET /api/actions/:id
 * @description Get action by ID
 * @access Public
 */
router.get("/:id", (req, res) => {
  // ... existing code ...
});

// Private routes (require authentication)

/**
 * @route POST /api/actions/:id/execute
 * @description Execute an action with the provided parameters for the authenticated user
 * @access Private
 */
router.post("/:id/execute", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const parameters = req.body;
    const userId = req.user.id;

    // Validate that the action exists
    const action = actionManager.getAction(id);
    if (!action) {
      return res
        .status(404)
        .json({ success: false, message: `Action with ID ${id} not found` });
    }

    // Add userId to parameters for context
    const executionParameters = { ...parameters, userId };

    // Execute the action
    const result = await actionManager.executeAction(id, executionParameters);

    res.json({
      success: true,
      actionId: id,
      result,
    });
  } catch (error) {
    console.error(`Error executing action ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: `Error executing action ${req.params.id}`,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/actions/suggest
 * @description Get suggested actions based on user input for the authenticated user
 * @access Private
 */
router.post("/suggest", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: input is required",
      });
    }

    const suggestedActions = await actionManager.getSuggestedActions(
      userId,
      input
    );

    // Filter out the execute function before sending to client
    const formattedActions = suggestedActions.map((suggestion) => ({
      action: {
        id: suggestion.action.id,
        name: suggestion.action.name,
        description: suggestion.action.description,
        category: suggestion.action.category,
        parameters: suggestion.action.parameters,
        contextTypes: suggestion.action.contextTypes,
      },
      score: suggestion.score,
      suggestedParameters: suggestion.suggestedParameters,
    }));

    res.json({
      success: true,
      userId,
      input,
      suggestions: formattedActions,
    });
  } catch (error) {
    console.error("Error suggesting actions:", error);
    res.status(500).json({
      success: false,
      message: "Error suggesting actions",
      error: error.message,
    });
  }
});

export default router;
