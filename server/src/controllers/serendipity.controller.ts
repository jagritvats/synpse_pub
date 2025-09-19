import { Request, Response, Router } from "express";
import {
  serendipityService,
  SerendipitySuggestion,
} from "../services/serendipity.service";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Define local interface for feedback structure
interface SuggestionFeedback {
  rating: number;
  comment?: string;
  actedOn: boolean;
}

/**
 * Controller for serendipity-related endpoints
 */
class SerendipityController {
  /**
   * Get existing serendipitous suggestions for the user
   */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const onlyUnseen = req.query.onlyUnseen === "true";
    const types = req.query.types
      ? (req.query.types as string).split(",")
      : undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;

    try {
      const suggestions = await serendipityService.getSuggestions(userId, {
        onlyUnseen,
        types,
        limit,
      });
      res.status(200).json(suggestions);
    } catch (error) {
      console.error("Error getting serendipity suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  }

  /**
   * Generate new serendipitous suggestions for the user
   */
  async generateSuggestions(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Simplified validation - assumes service layer handles detailed validation
    const params = req.body.params || {};

    try {
      const suggestions = await serendipityService.generateSuggestions(
        userId,
        params
      );
      res.status(200).json(suggestions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  }

  /**
   * Get cross-context connections for the user
   */
  async getCrossContextConnections(req: Request, res: Response): Promise<void> {
    res.status(501).json({
      error:
        "Not Implemented: Service method findCrossContextConnections missing",
    });
  }

  /**
   * Generate a serendipitous moment for the user
   */
  async getSerendipitousMoment(req: Request, res: Response): Promise<void> {
    res.status(501).json({
      error:
        "Not Implemented: Service method generateSerendipitousMoment missing",
    });
  }

  /**
   * Get a specific suggestion by ID
   */
  async getSuggestion(req: Request, res: Response): Promise<void> {
    res
      .status(501)
      .json({ error: "Not Implemented: Service method getSuggestion missing" });
  }

  /**
   * Mark a suggestion as seen
   */
  async markAsSeen(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const suggestionId = req.params.suggestionId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // TODO: Add ownership check when getSuggestionById is available in service
      // const suggestion = await serendipityService.getSuggestionById(suggestionId);
      // if (!suggestion || suggestion.userId !== userId) { ... }

      const success =
        await serendipityService.markSuggestionAsSeen(suggestionId);

      if (!success) {
        // Service method likely returns false if ID not found
        res
          .status(404)
          .json({ error: "Suggestion not found or failed to mark as seen" });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error marking suggestion as seen:", error);
      res.status(500).json({ error: "Failed to mark suggestion as seen" });
    }
  }

  /**
   * Mark a suggestion as acted on
   */
  async markAsActedOn(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const suggestionId = req.params.suggestionId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // TODO: Add ownership check when getSuggestionById is available in service
      // const suggestion = await serendipityService.getSuggestionById(suggestionId);
      // if (!suggestion || suggestion.userId !== userId) { ... }

      const success =
        await serendipityService.markSuggestionAsActedOn(suggestionId);

      if (!success) {
        res.status(404).json({
          error: "Suggestion not found or failed to mark as acted on",
        });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error marking suggestion as acted on:", error);
      res.status(500).json({ error: "Failed to mark suggestion as acted on" });
    }
  }

  /**
   * Delete a suggestion
   */
  async deleteSuggestion(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const suggestionId = req.params.suggestionId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // TODO: Add ownership check when getSuggestionById is available in service
      // const suggestion = await serendipityService.getSuggestionById(suggestionId);
      // if (!suggestion || suggestion.userId !== userId) { ... }

      const success = await serendipityService.deleteSuggestion(suggestionId);

      if (!success) {
        res
          .status(404)
          .json({ error: "Suggestion not found or failed to delete" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting suggestion:", error);
      res.status(500).json({ error: "Failed to delete suggestion" });
    }
  }

  /**
   * Delete all suggestions for the authenticated user
   */
  async deleteAllSuggestions(req: Request, res: Response): Promise<void> {
    res.status(501).json({
      error: "Not Implemented: Service method deleteAllSuggestions missing",
    });
  }

  /**
   * Submit feedback for a suggestion
   */
  async recordFeedback(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const suggestionId = req.params.suggestionId;
    const { rating, comment, actedOn } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      res
        .status(400)
        .json({ error: "Rating must be a number between 1 and 5" });
      return;
    }

    try {
      // TODO: Add ownership check when getSuggestionById is available in service
      // const suggestion = await serendipityService.getSuggestionById(suggestionId);
      // if (!suggestion || suggestion.userId !== userId) { ... }

      const feedback: SuggestionFeedback = {
        rating,
        comment,
        actedOn: actedOn === true,
      };

      const success = await serendipityService.recordFeedback(
        suggestionId,
        feedback
      );

      if (success) {
        res.json({ success: true });
      } else {
        res
          .status(404)
          .json({ error: "Suggestion not found or failed to record feedback" });
      }
    } catch (error) {
      console.error("Error recording feedback:", error);
      res.status(500).json({ error: "Failed to record feedback" });
    }
  }

  /**
   * Update suggestion metadata
   */
  async updateMetadata(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const suggestionId = req.params.suggestionId;
    const { metadata } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!metadata || typeof metadata !== "object") {
      res.status(400).json({ error: "Metadata must be an object" });
      return;
    }

    try {
      // TODO: Add ownership check when getSuggestionById is available in service
      // const suggestion = await serendipityService.getSuggestionById(suggestionId);
      // if (!suggestion || suggestion.userId !== userId) { ... }

      const success = await serendipityService.updateSuggestionMetadata(
        suggestionId,
        metadata
      );

      if (success) {
        res.json({ success: true });
      } else {
        res
          .status(404)
          .json({ error: "Suggestion not found or failed to update metadata" });
      }
    } catch (error) {
      console.error("Error updating suggestion metadata:", error);
      res.status(500).json({ error: "Failed to update metadata" });
    }
  }
}

const controller = new SerendipityController();

// Define routes on the router instance
router.use(authMiddleware); // Apply auth middleware to all routes

router.get("/suggestions", controller.getSuggestions.bind(controller));
router.post("/suggestions", controller.generateSuggestions.bind(controller));

// Commented out routes with missing service methods
// router.get("/connections", controller.getCrossContextConnections.bind(controller));
// router.get("/moment", controller.getSerendipitousMoment.bind(controller));
// router.get("/suggestions/:suggestionId", controller.getSuggestion.bind(controller));
// router.delete("/suggestions", controller.deleteAllSuggestions.bind(controller));

// Routes requiring ownership check (currently skipped)
router.post(
  "/suggestions/:suggestionId/seen",
  controller.markAsSeen.bind(controller)
);
router.post(
  "/suggestions/:suggestionId/acted",
  controller.markAsActedOn.bind(controller)
);
router.delete(
  "/suggestions/:suggestionId",
  controller.deleteSuggestion.bind(controller)
);
router.post(
  "/suggestions/:suggestionId/feedback",
  controller.recordFeedback.bind(controller)
);
router.put(
  "/suggestions/:suggestionId/metadata",
  controller.updateMetadata.bind(controller)
);

export default router; // Export the router instance
