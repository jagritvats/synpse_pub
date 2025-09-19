import { Request, Response, Router } from "express";
import {
  triggersService,
  Trigger,
  TriggerType,
  ActionType,
  Action,
} from "../../services/triggers.service";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * Get all triggers for the authenticated user
 *
 * GET /api/triggers
 */
router.get("/", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const triggers = triggersService.getUserTriggers(userId);

  return res.status(200).json({
    success: true,
    data: triggers,
  });
});

/**
 * Get a specific trigger by ID
 *
 * GET /api/triggers/:id
 */
router.get("/:id", authMiddleware, (req: Request, res: Response) => {
  const triggerId = req.params.id;
  const trigger = triggersService.getTrigger(triggerId);

  if (!trigger) {
    return res.status(404).json({
      success: false,
      message: "Trigger not found",
    });
  }

  // Check if the trigger belongs to the requesting user
  if (trigger.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  return res.status(200).json({
    success: true,
    data: trigger,
  });
});

/**
 * Create a new trigger
 *
 * POST /api/triggers
 */
router.post("/", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const { name, type, conditions, actions, description } = req.body;

  // Validate required fields
  if (!name || !type || !conditions || !actions || !Array.isArray(actions)) {
    return res.status(400).json({
      success: false,
      message: "Required fields missing or invalid",
    });
  }

  // Validate trigger type
  if (!Object.values(TriggerType).includes(type as TriggerType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid trigger type",
    });
  }

  // Validate actions
  for (const action of actions) {
    if (
      !action.type ||
      !Object.values(ActionType).includes(action.type as ActionType)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid action type: ${action.type}`,
      });
    }

    if (!action.config) {
      return res.status(400).json({
        success: false,
        message: "Action missing config",
      });
    }
  }

  try {
    const trigger = triggersService.createTrigger(
      userId,
      name,
      type as TriggerType,
      conditions,
      actions as Action[],
      description
    );

    return res.status(201).json({
      success: true,
      data: trigger,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create trigger",
      error: (error as Error).message,
    });
  }
});

/**
 * Update an existing trigger
 *
 * PUT /api/triggers/:id
 */
router.put("/:id", authMiddleware, (req: Request, res: Response) => {
  const triggerId = req.params.id;
  const { name, conditions, actions, description, isActive } = req.body;

  const existingTrigger = triggersService.getTrigger(triggerId);

  if (!existingTrigger) {
    return res.status(404).json({
      success: false,
      message: "Trigger not found",
    });
  }

  // Check if the trigger belongs to the requesting user
  if (existingTrigger.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  // Validate actions if provided
  if (actions) {
    if (!Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: "Actions must be an array",
      });
    }

    for (const action of actions) {
      if (
        !action.type ||
        !Object.values(ActionType).includes(action.type as ActionType)
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid action type: ${action.type}`,
        });
      }

      if (!action.config) {
        return res.status(400).json({
          success: false,
          message: "Action missing config",
        });
      }
    }
  }

  // Prepare updates
  const updates: Partial<Trigger> = {};

  if (name !== undefined) updates.name = name;
  if (conditions !== undefined) updates.conditions = conditions;
  if (actions !== undefined) updates.actions = actions as Action[];
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  try {
    const updatedTrigger = triggersService.updateTrigger(triggerId, updates);

    return res.status(200).json({
      success: true,
      data: updatedTrigger,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update trigger",
      error: (error as Error).message,
    });
  }
});

/**
 * Delete a trigger
 *
 * DELETE /api/triggers/:id
 */
router.delete("/:id", authMiddleware, (req: Request, res: Response) => {
  const triggerId = req.params.id;

  const existingTrigger = triggersService.getTrigger(triggerId);

  if (!existingTrigger) {
    return res.status(404).json({
      success: false,
      message: "Trigger not found",
    });
  }

  // Check if the trigger belongs to the requesting user
  if (existingTrigger.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  const deleted = triggersService.deleteTrigger(triggerId);

  return res.status(200).json({
    success: deleted,
    message: deleted
      ? "Trigger deleted successfully"
      : "Failed to delete trigger",
  });
});

/**
 * Activate a trigger
 *
 * POST /api/triggers/:id/activate
 */
router.post("/:id/activate", authMiddleware, (req: Request, res: Response) => {
  const triggerId = req.params.id;

  const existingTrigger = triggersService.getTrigger(triggerId);

  if (!existingTrigger) {
    return res.status(404).json({
      success: false,
      message: "Trigger not found",
    });
  }

  // Check if the trigger belongs to the requesting user
  if (existingTrigger.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  const updatedTrigger = triggersService.activateTrigger(triggerId);

  return res.status(200).json({
    success: true,
    data: updatedTrigger,
  });
});

/**
 * Deactivate a trigger
 *
 * POST /api/triggers/:id/deactivate
 */
router.post(
  "/:id/deactivate",
  authMiddleware,
  (req: Request, res: Response) => {
    const triggerId = req.params.id;

    const existingTrigger = triggersService.getTrigger(triggerId);

    if (!existingTrigger) {
      return res.status(404).json({
        success: false,
        message: "Trigger not found",
      });
    }

    // Check if the trigger belongs to the requesting user
    if (existingTrigger.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const updatedTrigger = triggersService.deactivateTrigger(triggerId);

    return res.status(200).json({
      success: true,
      data: updatedTrigger,
    });
  }
);

/**
 * Manually execute a trigger
 *
 * POST /api/triggers/:id/execute
 */
router.post(
  "/:id/execute",
  authMiddleware,
  async (req: Request, res: Response) => {
    const triggerId = req.params.id;

    const existingTrigger = triggersService.getTrigger(triggerId);

    if (!existingTrigger) {
      return res.status(404).json({
        success: false,
        message: "Trigger not found",
      });
    }

    // Check if the trigger belongs to the requesting user
    if (existingTrigger.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    try {
      const result = await triggersService.executeTrigger(triggerId);

      return res.status(200).json({
        success: result,
        message: result
          ? "Trigger executed successfully"
          : "Failed to execute trigger",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error executing trigger",
        error: (error as Error).message,
      });
    }
  }
);

export default router;
