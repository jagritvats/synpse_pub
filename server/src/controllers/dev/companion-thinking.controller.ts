import { Request, Response, Router } from "express";
import { companionThinkingService } from "../../services/companion-thinking.service";
import { companionStateService } from "../../services/companion-state.service";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { contextService } from "../../services/context.service";
import { ContextType } from "../../interfaces/context-type.enum";

const router = Router();

/**
 * Get the current status of the companion thinking service
 *
 * GET /api/companion-thinking/status
 */
router.get("/status", authMiddleware, (req: Request, res: Response) => {
  const isEnabled = companionThinkingService.isEnabled();

  return res.status(200).json({
    success: true,
    data: {
      enabled: isEnabled,
    },
  });
});

/**
 * Toggle the companion thinking service on/off
 *
 * POST /api/companion-thinking/toggle
 */
router.post("/toggle", authMiddleware, (req: Request, res: Response) => {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "The 'enabled' property must be a boolean value",
    });
  }

  companionThinkingService.setEnabled(enabled);

  return res.status(200).json({
    success: true,
    data: {
      enabled: companionThinkingService.isEnabled(),
    },
    message: `Companion thinking service ${enabled ? "enabled" : "disabled"}`,
  });
});

/**
 * Generate and analyze thinking for a specific user input without responding
 * This is for testing the thinking system specifically
 *
 * POST /api/companion-thinking/analyze
 */
router.post("/analyze", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { input, recentMessages } = req.body;

  if (!input || typeof input !== "string") {
    return res.status(400).json({
      success: false,
      message: "Input text is required",
    });
  }

  try {
    // Convert messages to the expected format if provided
    const formattedMessages = Array.isArray(recentMessages)
      ? recentMessages.map((m) => ({
          role: m.role || "user",
          content: m.content || "",
        }))
      : [];

    // Generate analysis but don't inject into context
    const insight = await companionThinkingService.analyzeUserPsychology(
      userId,
      input,
      formattedMessages
    );

    if (!insight) {
      return res.status(404).json({
        success: false,
        message: "Could not generate psychological insight",
      });
    }

    // Get current goals
    const currentGoals = await companionThinkingService.updateAIGoals(
      userId,
      insight,
      await companionStateService.getAIInternalGoals(userId)
    );

    return res.status(200).json({
      success: true,
      data: {
        psychological_insight: insight,
        goals: currentGoals.goals,
        goalsUpdated: currentGoals.updated,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error analyzing input",
      error: (error as Error).message,
    });
  }
});

/**
 * Get AI thinking context for a user (for debugging)
 * @route GET /api/dev/companion-thinking/context/:userId
 */
router.get("/context/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    // Get the AI thinking context
    const contextItems = await contextService.getContext(
      userId,
      ContextType.AI_THINKING,
      true // get only active contexts
    );

    // Format thinking for display
    let formattedThinking = "";
    if (contextItems && contextItems.length > 0) {
      // Use the context service formatter
      formattedThinking = await contextService.generateContextSummary(userId, [
        ContextType.AI_THINKING,
      ]);
    }

    return res.json({
      success: true,
      data: {
        hasContext: contextItems.length > 0,
        rawContext: contextItems,
        formattedContext: formattedThinking,
      },
    });
  } catch (error) {
    console.error("Error getting companion thinking context:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get companion thinking context",
    });
  }
});

router.post("/test", async (req: Request, res: Response) => {
  try {
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({
        success: false,
        error: "User ID and text are required",
      });
    }

    // Run the test analysis
    const result = await companionThinkingService.testAnalysisWithText(
      userId,
      text
    );

    // Get the updated context after analysis
    const contextItems = await contextService.getContext(
      userId,
      ContextType.AI_THINKING,
      true // get only active contexts
    );

    // Format thinking for display
    let formattedThinking = "";
    if (contextItems && contextItems.length > 0) {
      formattedThinking = await contextService.generateContextSummary(userId, [
        ContextType.AI_THINKING,
      ]);
    }

    return res.json({
      success: result,
      data: {
        analysisSuccess: result,
        hasContext: contextItems.length > 0,
        contextCount: contextItems.length,
        latestContext: contextItems.length > 0 ? contextItems[0] : null,
        formattedContext: formattedThinking,
      },
    });
  } catch (error) {
    console.error("Error testing companion thinking:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to test companion thinking",
    });
  }
});

/**
 * Get recent thinking records for a session
 * @route GET /api/dev/companion-thinking/records/:sessionId
 */
router.get("/records/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit = "10" } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    const limitNum = parseInt(limit as string, 10) || 10;

    // Get recent records from database
    const ThinkingRecord =
      require("../../models/thinking-record.model").default;
    const records = await ThinkingRecord.find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limitNum);

    // Get cache info
    const cacheStatus = companionThinkingService.getSessionCacheInfo(sessionId);

    return res.json({
      success: true,
      data: {
        cacheStatus,
        recordCount: records.length,
        records,
      },
    });
  } catch (error) {
    console.error("Error fetching thinking records:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch thinking records",
    });
  }
});

/**
 * Force a synchronous analysis for a session
 * @route POST /api/dev/companion-thinking/force-analysis
 */
router.post("/force-analysis", async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, text } = req.body;

    if (!userId || !sessionId || !text) {
      return res.status(400).json({
        success: false,
        error: "userId, sessionId and text are required",
      });
    }

    const mockMessages = [
      { role: "user", content: "Hello there" },
      { role: "assistant", content: "Hi! How can I help you today?" },
      { role: "user", content: text },
    ];

    // Force a synchronous analysis
    const result = await companionThinkingService.processAndInjectThinking(
      userId,
      sessionId,
      text,
      undefined, // No messageId for test
      mockMessages
    );

    if (result) {
      // Get the context after analysis
      const contextItems = await contextService.getContext(
        userId,
        ContextType.AI_THINKING,
        true
      );

      let formattedThinking = "";
      if (contextItems && contextItems.length > 0) {
        formattedThinking = await contextService.generateContextSummary(
          userId,
          [ContextType.AI_THINKING]
        );
      }

      return res.json({
        success: true,
        data: {
          analysisSuccess: true,
          hasContext: contextItems.length > 0,
          contextItems,
          formattedThinking,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Analysis failed",
      });
    }
  } catch (error) {
    console.error("Error forcing analysis:", error);
    return res.status(500).json({
      success: false,
      error: "Error forcing analysis",
    });
  }
});

export default router;
