import { Request, Response, Router } from "express";import { authMiddleware } from "../../middlewares/auth.middleware";
import { telegramSchedulerService } from "../../services/telegram/telegram-scheduler.service";
import { loggerFactory } from "../../utils/logger.service";

const logger = loggerFactory.getLogger("TelegramSchedulerController");
const router = Router();

/**
 * Start the Telegram scheduler service
 *
 * POST /api/telegram/scheduler/start
 */
router.post("/start", authMiddleware, (req: Request, res: Response) => {
  try {
    // Only admins should be able to start/stop the scheduler
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required",
      });
    }

    telegramSchedulerService.start();

    return res.status(200).json({
      success: true,
      message: "Telegram scheduler started successfully",
    });
  } catch (error) {
    logger.error("Error starting Telegram scheduler:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start Telegram scheduler",
      error: (error as Error).message,
    });
  }
});

/**
 * Stop the Telegram scheduler service
 *
 * POST /api/telegram/scheduler/stop
 */
router.post("/stop", authMiddleware, (req: Request, res: Response) => {
  try {
    // Only admins should be able to start/stop the scheduler
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required",
      });
    }

    telegramSchedulerService.stop();

    return res.status(200).json({
      success: true,
      message: "Telegram scheduler stopped successfully",
    });
  } catch (error) {
    logger.error("Error stopping Telegram scheduler:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to stop Telegram scheduler",
      error: (error as Error).message,
    });
  }
});

/**
 * Run the scheduled message check immediately
 *
 * POST /api/telegram/scheduler/run
 */
router.post("/run", authMiddleware, async (req: Request, res: Response) => {
  try {
    // Only admins should be able to run the scheduler manually
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required",
      });
    }

    logger.info("Manually running scheduled message check");
    await telegramSchedulerService.checkAndSendScheduledMessages();

    return res.status(200).json({
      success: true,
      message: "Telegram scheduled message check completed successfully",
    });
  } catch (error) {
    logger.error("Error running Telegram scheduled message check:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run Telegram scheduled message check",
      error: (error as Error).message,
    });
  }
});

/**
 * Send a scheduled message to a specific Telegram user
 *
 * POST /api/telegram/scheduler/send/:userId
 */
router.post(
  "/send/:userId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Only admins should be able to send scheduled messages manually
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Admin privileges required",
        });
      }

      const { userId } = req.params;

      if (!userId.startsWith("telegram_")) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format. Must start with 'telegram_'",
        });
      }

      logger.info(`Manually sending scheduled message to user ${userId}`);
      const result =
        await telegramSchedulerService.sendScheduledMessageToUser(userId);

      if (result) {
        return res.status(200).json({
          success: true,
          message: `Scheduled message sent successfully to user ${userId}`,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Failed to send scheduled message to user ${userId}`,
        });
      }
    } catch (error) {
      logger.error("Error sending manual scheduled message:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send scheduled message",
        error: (error as Error).message,
      });
    }
  }
);

export default router;
