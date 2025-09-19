import { Request, Response, Router } from "express";
import { contextService } from "../services/context.service";
import { authMiddleware as authenticateToken } from "../middlewares/auth.middleware";
import { ContextType } from "../interfaces/context-type.enum";
import { ContextDuration } from "../interfaces/context-duration.enum";

const router = Router();

/**
 * Get all context items for the authenticated user
 *
 * GET /api/context?type=<context_type>&onlyActive=<true|false>
 */
router.get("/", authenticateToken, (req: Request, res: Response) => {
  const userId = req.user.id;
  const type = req.query.type as ContextType | undefined;
  const onlyActive = req.query.onlyActive !== "false"; // Default to true

  // Validate context type if provided
  if (type && !Object.values(ContextType).includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid context type",
    });
  }

  const contextItems = contextService.getContext(userId, type, onlyActive);

  return res.status(200).json({
    success: true,
    data: contextItems,
  });
});

/**
 * Get time context and inject it for the user
 *
 * POST /api/context/time
 */
router.post("/time", authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user.id;

  try {
    const context = await contextService.getTimeContext(userId);

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get time context",
      error: (error as Error).message,
    });
  }
});

/**
 * Get weather context and inject it for the user
 *
 * POST /api/context/weather
 */
router.post(
  "/weather",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { location } = req.body;

    try {
      const context = await contextService.getWeatherContext(
        userId,
        location || "New York"
      );

      if (!context) {
        return res.status(500).json({
          success: false,
          message: "Failed to get weather context",
        });
      }

      return res.status(200).json({
        success: true,
        data: context,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to get weather context",
        error: (error as Error).message,
      });
    }
  }
);

/**
 * Inject user emotion context
 *
 * POST /api/context/user-emotion
 */
router.post(
  "/user-emotion",
  authenticateToken,
  (req: Request, res: Response) => {
    const userId = req.user.id;
    const { emotion } = req.body;

    if (
      !emotion ||
      !emotion.primaryEmotion ||
      typeof emotion.intensity !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Emotion data must include primaryEmotion and intensity (number)",
      });
    }

    try {
      // Add timestamp if not provided
      if (!emotion.timestamp) {
        emotion.timestamp = Date.now();
      }

      const context = contextService.injectUserEmotion(userId, emotion);

      return res.status(200).json({
        success: true,
        data: context,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to inject user emotion context",
        error: (error as Error).message,
      });
    }
  }
);

/**
 * Inject companion emotion context
 *
 * POST /api/context/companion-emotion
 */
router.post(
  "/companion-emotion",
  authenticateToken,
  (req: Request, res: Response) => {
    const userId = req.user.id;
    const { emotion } = req.body;

    if (
      !emotion ||
      !emotion.primaryEmotion ||
      typeof emotion.intensity !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Emotion data must include primaryEmotion and intensity (number)",
      });
    }

    try {
      // Add timestamp if not provided
      if (!emotion.timestamp) {
        emotion.timestamp = Date.now();
      }

      const context = contextService.injectCompanionEmotion(userId, emotion);

      return res.status(200).json({
        success: true,
        data: context,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to inject companion emotion context",
        error: (error as Error).message,
      });
    }
  }
);

/**
 * Inject user notes as context
 *
 * POST /api/context/user-notes
 */
router.post("/user-notes", authenticateToken, (req: Request, res: Response) => {
  const userId = req.user.id;
  const { notes } = req.body;

  if (!notes) {
    return res.status(400).json({
      success: false,
      message: "Notes data is required",
    });
  }

  try {
    const context = contextService.injectUserNotes(userId, notes);

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to inject user notes context",
      error: (error as Error).message,
    });
  }
});

/**
 * Generate context summary for AI prompts
 *
 * GET /api/context/summary
 */
router.get(
  "/summary",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const includeTypesParam = req.query.includeTypes as string | undefined;
    const maxItems = parseInt((req.query.maxItems as string) || "10", 10);

    // Parse include types if provided
    let includeTypes: ContextType[] | undefined = undefined;
    if (includeTypesParam) {
      try {
        const types = includeTypesParam.split(",") as ContextType[];
        // Validate all types
        if (types.every((type) => Object.values(ContextType).includes(type))) {
          includeTypes = types;
        } else {
          return res.status(400).json({
            success: false,
            message: "One or more invalid context types provided",
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid includeTypes parameter",
        });
      }
    }

    try {
      const summary = await contextService.generateContextSummary(
        userId,
        includeTypes,
        maxItems
      );

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate context summary",
        error: (error as Error).message,
      });
    }
  }
);

/**
 * Inject custom context
 *
 * POST /api/context/custom
 */
router.post("/custom", authenticateToken, (req: Request, res: Response) => {
  const userId = req.user.id;
  const { type, duration, data, source, metadata } = req.body;

  if (
    !type ||
    !duration ||
    !data ||
    !Object.values(ContextType).includes(type) ||
    !Object.values(ContextDuration).includes(duration)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid type, duration, and data are required for custom context",
    });
  }

  try {
    const context = contextService.injectContext(
      userId,
      type,
      duration,
      data,
      source || "custom",
      metadata
    );

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to inject custom context",
      error: (error as Error).message,
    });
  }
});

/**
 * Remove context by ID
 *
 * DELETE /api/context/:id
 */
router.delete("/:id", authenticateToken, (req: Request, res: Response) => {
  const contextId = req.params.id;

  // First check if the context exists and belongs to the user
  const contextItems = contextService.getContext(req.user.id);
  const contextItem = contextItems.find((item) => item.id === contextId);

  if (!contextItem) {
    return res.status(404).json({
      success: false,
      message: "Context not found",
    });
  }

  const result = contextService.removeContext(contextId);

  return res.status(200).json({
    success: result,
    message: result
      ? "Context removed successfully"
      : "Failed to remove context",
  });
});

// Add default export for the router
export default router;
