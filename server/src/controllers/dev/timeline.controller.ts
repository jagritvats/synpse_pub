import { Request, Response, Router } from "express";
import { timelineService } from "../../services/timeline.service";
import { loggerFactory } from "../../utils/logger.service";

const logger = loggerFactory.getLogger("TimelineController");

export const timelineController = Router();

// GET /api/dev/timeline - Fetch user's timeline events
timelineController.get("/", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Optional query parameters for pagination/filtering
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before
    ? new Date(req.query.before as string)
    : undefined;
  const after = req.query.after
    ? new Date(req.query.after as string)
    : undefined;

  try {
    logger.info(
      `Fetching timeline for user ${userId} with limit ${limit}, before: ${before}, after: ${after}`
    );
    const events = await timelineService.getTimelineEvents(
      userId,
      limit,
      before,
      after
    );
    res.status(200).json(events);
  } catch (error: any) {
    logger.error(`Error fetching timeline for user ${userId}:`, error);
    res.status(500).json({ message: "Failed to fetch timeline events" });
  }
});
