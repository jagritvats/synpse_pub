import express, { Request, Response } from "express";
import { summaryService } from "../../services/summary.service";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = express.Router();

/**
 * @route GET /api/dev/summary/status
 * @desc Get current status of summary service
 * @access Private (dev)
 */
router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const enabled = summaryService.isEnabled();
    const cacheInfo = {
      // Get cache statistics - would need to add this method to the service
      // cacheSize: summaryService.getCacheSize(),
      // recentSummaries: summaryService.getRecentSummaries(5),
    };

    res.json({
      success: true,
      data: {
        enabled,
        // Add additional info when methods are implemented
        // cacheInfo
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Error getting summary service status",
    });
  }
});

/**
 * @route POST /api/dev/summary/toggle
 * @desc Enable or disable the summary service
 * @access Private (dev)
 */
router.post("/toggle", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid 'enabled' parameter",
      });
    }

    summaryService.setEnabled(enabled);

    res.json({
      success: true,
      data: {
        enabled: summaryService.isEnabled(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Error toggling summary service",
    });
  }
});

/**
 * @route POST /api/dev/summary/generate
 * @desc Force generate a summary for a user/session
 * @access Private (dev)
 */
router.post(
  "/generate",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId, sessionId } = req.body;

      if (!userId || !sessionId) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: userId and sessionId",
        });
      }

      // Force synchronous generation
      const summary = await summaryService.generateUserSummary(
        userId,
        sessionId,
        true
      );

      res.json({
        success: true,
        data: {
          userId,
          sessionId,
          summary,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error generating summary",
      });
    }
  }
);

/**
 * @route GET /api/dev/summary/:userId/:sessionId
 * @desc Get the current summary for a specific user and session
 * @access Private (dev)
 */
router.get(
  "/:userId/:sessionId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId, sessionId } = req.params;

      if (!userId || !sessionId) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: userId and sessionId",
        });
      }

      // Get without forcing regeneration (async mode)
      const summary = await summaryService.generateUserSummary(
        userId,
        sessionId,
        false
      );

      res.json({
        success: true,
        data: {
          userId,
          sessionId,
          summary,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error fetching summary",
      });
    }
  }
);

export default router;
