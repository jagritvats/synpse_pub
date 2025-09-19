import { Request, Response, Router } from "express";import { actionManager, Action } from "../services/action-manager.service"; // Assuming service path
import { authMiddleware } from "../middlewares/auth.middleware"; // Optional auth needed for suggest

const router = Router();

// Define a simplified Action type for response filtering
type ActionResponse = Omit<Action, "execute">;

class ActionController {
  // GET /
  getAllActions(req: Request, res: Response): void {
    try {
      const actions: ActionResponse[] = actionManager
        .getAllActions()
        .map((action) => {
          const { execute, ...rest } = action; // Exclude execute function
          return rest;
        });
      res.json({ success: true, actions });
    } catch (error) {
      console.error("Error fetching actions:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Error fetching actions",
          error: (error as Error).message,
        });
    }
  }

  // GET /category/:category
  getActionsByCategory(req: Request, res: Response): void {
    try {
      const { category } = req.params;
      const actions: ActionResponse[] = actionManager
        .getActionsByCategory(category)
        .map((action) => {
          const { execute, ...rest } = action;
          return rest;
        });
      res.json({ success: true, category, actions });
    } catch (error) {
      console.error(
        `Error fetching actions for category ${req.params.category}:`,
        error
      );
      res
        .status(500)
        .json({
          success: false,
          message: `Error fetching actions for category ${req.params.category}`,
          error: (error as Error).message,
        });
    }
  }

  // GET /context/:contextType
  getActionsByContextType(req: Request, res: Response): void {
    try {
      const { contextType } = req.params;
      const actions: ActionResponse[] = actionManager
        .getActionsByContextType(contextType)
        .map((action) => {
          const { execute, ...rest } = action;
          return rest;
        });
      res.json({ success: true, contextType, actions });
    } catch (error) {
      console.error(
        `Error fetching actions for context type ${req.params.contextType}:`,
        error
      );
      res
        .status(500)
        .json({
          success: false,
          message: `Error fetching actions for context type ${req.params.contextType}`,
          error: (error as Error).message,
        });
    }
  }

  // GET /:id
  getActionById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const action = actionManager.getAction(id);
      if (!action) {
        res
          .status(404)
          .json({ success: false, message: `Action with ID ${id} not found` });
        return;
      }
      const { execute, ...responseAction } = action;
      res.json({ success: true, action: responseAction });
    } catch (error) {
      console.error(`Error fetching action ${req.params.id}:`, error);
      res
        .status(500)
        .json({
          success: false,
          message: `Error fetching action ${req.params.id}`,
          error: (error as Error).message,
        });
    }
  }

  // POST /:id/execute
  async executeAction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parameters = req.body;
      const action = actionManager.getAction(id);
      if (!action) {
        res
          .status(404)
          .json({ success: false, message: `Action with ID ${id} not found` });
        return;
      }
      const result = await actionManager.executeAction(id, parameters);
      res.json({ success: true, actionId: id, result });
    } catch (error) {
      console.error(`Error executing action ${req.params.id}:`, error);
      res
        .status(500)
        .json({
          success: false,
          message: `Error executing action ${req.params.id}`,
          error: (error as Error).message,
        });
    }
  }

  // POST /suggest
  async getSuggestedActions(req: Request, res: Response): Promise<void> {
    // Assuming userId might come from auth middleware or body
    const userId = req.user?.id || req.body.userId;
    const { input } = req.body;

    if (!userId || !input) {
      res
        .status(400)
        .json({
          success: false,
          message: "Missing required parameters: userId and input are required",
        });
      return;
    }

    try {
      const suggestedActions = await actionManager.getSuggestedActions(
        userId,
        input
      );
      const formattedActions = suggestedActions.map((suggestion) => {
        const { execute, ...actionDetails } = suggestion.action;
        return {
          action: actionDetails,
          score: suggestion.score,
          suggestedParameters: suggestion.suggestedParameters,
        };
      });
      res.json({ success: true, userId, input, suggestions: formattedActions });
    } catch (error) {
      console.error("Error suggesting actions:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Error suggesting actions",
          error: (error as Error).message,
        });
    }
  }
}

const controller = new ActionController();

// Define routes
router.get("/", controller.getAllActions.bind(controller));
router.get(
  "/category/:category",
  controller.getActionsByCategory.bind(controller)
);
router.get(
  "/context/:contextType",
  controller.getActionsByContextType.bind(controller)
);
router.get("/:id", controller.getActionById.bind(controller));
router.post("/:id/execute", controller.executeAction.bind(controller));
// Apply auth middleware specifically for suggestion route if needed
// If userId always comes from body, auth might not be strictly necessary here
router.post(
  "/suggest",
  authMiddleware,
  controller.getSuggestedActions.bind(controller)
);

export default router;
