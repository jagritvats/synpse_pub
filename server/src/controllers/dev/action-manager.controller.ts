import { Request, Response, Router } from "express";import { actionManager } from "../../services/action-manager.service";
import { validateRequest } from "../../middlewares/auth.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";

/**
 * Controller for action manager related operations
 */
class ActionManagerController {
  /**
   * Get all available actions
   */
  async getAllActions(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const actions = actionManager.getAllActions().map((action) => ({
      id: action.id,
      name: action.name,
      description: action.description,
      parameters: action.getParameterDescriptions(),
    }));

    res.status(200).json(actions);
  }

  /**
   * Execute an action by ID
   */
  async executeAction(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const actionId = req.params.actionId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if action exists
    const action = actionManager.getAction(actionId);

    if (!action) {
      res.status(404).json({ error: "Action not found" });
      return;
    }

    // Validate request body
    const validationError = validateRequest(req.body, [
      { field: "parameters", type: "object", required: false },
    ]);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    // Add userId to parameters
    const parameters = {
      ...(req.body.parameters || {}),
      userId,
    };

    try {
      const result = await actionManager.executeAction(actionId, parameters);
      res.status(200).json({ result });
    } catch (error) {
      console.error(`Error executing action ${actionId}:`, error);
      res.status(500).json({
        error: "Failed to execute action",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get action suggestions based on context
   */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate request body
    const validationError = validateRequest(req.body, [
      { field: "context", type: "string", required: true },
      { field: "maxSuggestions", type: "number", required: false },
    ]);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const { context, maxSuggestions = 5 } = req.body;

    try {
      const suggestions = await actionManager.getSuggestions(
        context,
        userId,
        maxSuggestions
      );

      // Format the suggestions for API response
      const formattedSuggestions = suggestions.map((suggestion) => ({
        actionId: suggestion.action.id,
        actionName: suggestion.action.name,
        actionDescription: suggestion.action.description,
        score: suggestion.score,
        parameters: suggestion.action.getParameterDescriptions(),
        suggestedParameters: suggestion.suggestedParameters || {},
      }));

      res.status(200).json(formattedSuggestions);
    } catch (error) {
      console.error("Error getting action suggestions:", error);
      res.status(500).json({ error: "Failed to get action suggestions" });
    }
  }
}

// Instantiate the controller
const controller = new ActionManagerController();

// Create and configure the router
const router = Router();
router.use(authMiddleware);

// Define routes
router.get("/actions", controller.getAllActions.bind(controller));
router.post(
  "/actions/:actionId/execute",
  controller.executeAction.bind(controller)
);
router.post("/suggestions", controller.getSuggestions.bind(controller));

// Export the router as default
export default router;
