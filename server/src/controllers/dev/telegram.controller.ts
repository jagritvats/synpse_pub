import { Request, Response, Router } from "express";
import { telegramBotService } from "../../services/telegram/telegram-bot.service";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * Start the Telegram bot
 *
 * POST /api/telegram/start
 */
router.post("/start", authMiddleware, (req: Request, res: Response) => {
  try {
    // Only admins should be able to start/stop the bot
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required",
      });
    }

    telegramBotService.start();

    return res.status(200).json({
      success: true,
      message: "Telegram bot started successfully",
    });
  } catch (error) {
    console.error("Error starting Telegram bot:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start Telegram bot",
      error: (error as Error).message,
    });
  }
});

/**
 * Stop the Telegram bot
 *
 * POST /api/telegram/stop
 */
router.post("/stop", authMiddleware, (req: Request, res: Response) => {
  try {
    // Only admins should be able to start/stop the bot
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required",
      });
    }

    telegramBotService.stop();

    return res.status(200).json({
      success: true,
      message: "Telegram bot stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping Telegram bot:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to stop Telegram bot",
      error: (error as Error).message,
    });
  }
});

/**
 * Link a Telegram user to a system user
 *
 * POST /api/telegram/link
 */
router.post("/link", authMiddleware, (req: Request, res: Response) => {
  try {
    const { telegramUserId } = req.body;

    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        message: "Telegram user ID is required",
      });
    }

    // Link the Telegram user ID to the current authenticated user
    telegramBotService.linkUser(
      parseInt(telegramUserId, 10),
      req.user.id,
      req.user.username || req.user.email
    );

    return res.status(200).json({
      success: true,
      message: "Telegram account linked successfully",
    });
  } catch (error) {
    console.error("Error linking Telegram account:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to link Telegram account",
      error: (error as Error).message,
    });
  }
});

/**
 * Send a message to a specific Telegram user
 *
 * POST /api/telegram/send
 */
router.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { telegramUserId, message } = req.body;

    if (!telegramUserId || !message) {
      return res.status(400).json({
        success: false,
        message: "Telegram user ID and message are required",
      });
    }

    // Only admins or the user linked to this Telegram account should be able to send messages
    // For full implementation, we would check if the telegramUserId is linked to the current user
    // This is a simplified check
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin privileges required",
      });
    }

    const result = await telegramBotService.sendMessage(
      parseInt(telegramUserId, 10),
      message
    );

    if (result) {
      return res.status(200).json({
        success: true,
        message: "Message sent successfully",
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send Telegram message",
      error: (error as Error).message,
    });
  }
});

/**
 * Get status of the Telegram bot
 *
 * GET /api/telegram/status
 */
router.get("/status", authMiddleware, (req: Request, res: Response) => {
  try {
    // In a real implementation, we would have a status method in the service
    // For now, we'll just return information about the Telegram bot

    return res.status(200).json({
      success: true,
      data: {
        // This would be more detailed in a real implementation
        botActive: process.env.TELEGRAM_BOT_TOKEN ? true : false,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || "Unknown",
        isRunning: true, // In a real implementation, we would check the actual running status
      },
    });
  } catch (error) {
    console.error("Error checking Telegram bot status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check Telegram bot status",
      error: (error as Error).message,
    });
  }
});

export default router;
