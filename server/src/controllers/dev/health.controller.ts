import { Router, Request, Response } from "express";
const router = Router();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint with detailed status
 * @access  Public
 */
router.get("/", (req: Request, res: Response) => {
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
  };

  res.json(healthStatus);
});

export default router;
