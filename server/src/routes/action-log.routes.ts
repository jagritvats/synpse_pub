import { Router } from "express";import { authMiddleware } from "../middlewares/auth.middleware";
import { actionLogService } from "../services/action-log.service";
import { Request, Response } from "express";
import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("ActionLogRoutes");
const router = Router();

// Extended request type with authenticated user
interface AuthRequest extends Request {
  user: {
    id: string;
    [key: string]: any;
  };
}

/**
 * @route GET /api/action-logs/session/:sessionId
 * @description Get action logs for a session
 * @access Private
 */
router.get(
  "/session/:sessionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const options = {
        status: req.query.status as "success" | "failure" | undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
      };

      const actionLogs = await actionLogService.getSessionActionLogs(
        sessionId,
        options
      );

      res.json({
        success: true,
        actionLogs,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error getting session action logs:", error);
      res.status(500).json({
        success: false,
        message: "Error getting session action logs",
        error: errorMessage,
      });
    }
  }
);

/**
 * @route GET /api/action-logs/message/:messageId
 * @description Get action logs for a message
 * @access Private
 */
router.get(
  "/message/:messageId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      const actionLogs = await actionLogService.getMessageActionLogs(messageId);

      res.json({
        success: true,
        actionLogs,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error getting message action logs:", error);
      res.status(500).json({
        success: false,
        message: "Error getting message action logs",
        error: errorMessage,
      });
    }
  }
);

/**
 * @route GET /api/action-logs/user
 * @description Get action logs for the authenticated user
 * @access Private
 */
router.get("/user", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const options = {
      sessionId: req.query.sessionId as string,
      actionId: req.query.actionId as string,
      status: req.query.status as "success" | "failure" | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
    };

    const actionLogs = await actionLogService.getUserActionLogs(
      userId,
      options
    );

    res.json({
      success: true,
      actionLogs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error getting user action logs:", error);
    res.status(500).json({
      success: false,
      message: "Error getting user action logs",
      error: errorMessage,
    });
  }
});

export default router;
