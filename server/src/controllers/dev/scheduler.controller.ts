import { Request, Response, Router } from "express";
import { schedulerService } from "../../services/scheduler.service";
import { validateRequest } from "../../middlewares/auth.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";

/**
 * Controller for task scheduling operations
 */
class SchedulerController {
  /**
   * Get all tasks for a user
   */
  async getUserTasks(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Process query parameters for filtering
    const filters: any = {};

    if (req.query.status) {
      filters.status = req.query.status as string;
    }

    if (req.query.priority) {
      filters.priority = req.query.priority as string;
    }

    if (req.query.dueBefore) {
      filters.dueBefore = req.query.dueBefore as string;
    }

    if (req.query.dueAfter) {
      filters.dueAfter = req.query.dueAfter as string;
    }

    const tasks = schedulerService.getUserTasks(
      userId,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.status(200).json(tasks);
  }

  /**
   * Create a new task
   */
  async createTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate request body
    const validationError = validateRequest(req.body, [
      { field: "title", type: "string", required: true },
      { field: "description", type: "string", required: true },
      { field: "dueDate", type: "string", required: true },
      {
        field: "priority",
        type: "string",
        required: false,
        allowedValues: ["high", "medium", "low"],
      },
      { field: "recurringPattern", type: "string", required: false },
    ]);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    // Validate dueDate is a valid date
    if (isNaN(Date.parse(req.body.dueDate))) {
      res
        .status(400)
        .json({ error: "Invalid dueDate format. Please use ISO format." });
      return;
    }

    const task = schedulerService.createTask(userId, {
      title: req.body.title,
      description: req.body.description,
      dueDate: req.body.dueDate,
      priority: req.body.priority,
      recurringPattern: req.body.recurringPattern,
      metadata: req.body.metadata,
    });

    res.status(201).json(task);
  }

  /**
   * Get a specific task by ID
   */
  async getTaskById(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const taskId = req.params.taskId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const task = schedulerService.getTask(taskId);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Check if task belongs to the user
    if (task.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.status(200).json(task);
  }

  /**
   * Update a task
   */
  async updateTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const taskId = req.params.taskId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if task exists and belongs to the user
    const existingTask = schedulerService.getTask(taskId);

    if (!existingTask) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    if (existingTask.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Validate dueDate is a valid date if provided
    if (req.body.dueDate && isNaN(Date.parse(req.body.dueDate))) {
      res
        .status(400)
        .json({ error: "Invalid dueDate format. Please use ISO format." });
      return;
    }

    // Validate priority if provided
    if (
      req.body.priority &&
      !["high", "medium", "low"].includes(req.body.priority)
    ) {
      res
        .status(400)
        .json({ error: "Priority must be one of: high, medium, low" });
      return;
    }

    // Validate status if provided
    if (
      req.body.status &&
      !["pending", "completed", "cancelled"].includes(req.body.status)
    ) {
      res.status(400).json({
        error: "Status must be one of: pending, completed, cancelled",
      });
      return;
    }

    const updatedTask = schedulerService.updateTask(taskId, req.body);

    if (!updatedTask) {
      res.status(500).json({ error: "Failed to update task" });
      return;
    }

    res.status(200).json(updatedTask);
  }

  /**
   * Delete a task
   */
  async deleteTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const taskId = req.params.taskId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if task exists and belongs to the user
    const existingTask = schedulerService.getTask(taskId);

    if (!existingTask) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    if (existingTask.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const success = schedulerService.deleteTask(taskId);

    if (!success) {
      res.status(500).json({ error: "Failed to delete task" });
      return;
    }

    res.status(204).send();
  }

  /**
   * Mark a task as completed
   */
  async completeTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const taskId = req.params.taskId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if task exists and belongs to the user
    const existingTask = schedulerService.getTask(taskId);

    if (!existingTask) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    if (existingTask.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updatedTask = schedulerService.completeTask(taskId);

    if (!updatedTask) {
      res.status(500).json({ error: "Failed to complete task" });
      return;
    }

    res.status(200).json(updatedTask);
  }

  /**
   * Get AI-suggested tasks for a user
   */
  async getSuggestedTasks(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const maxSuggestions = req.query.max
      ? parseInt(req.query.max as string, 10)
      : 3;

    try {
      const suggestedTasks = await schedulerService.suggestTasks(
        userId,
        maxSuggestions
      );
      res.status(200).json(suggestedTasks);
    } catch (error) {
      console.error("Error getting task suggestions:", error);
      res.status(500).json({ error: "Failed to generate task suggestions" });
    }
  }
}

// Instantiate the controller
const controller = new SchedulerController();

// Create and configure the router
const router = Router();
router.use(authMiddleware);

// Define routes
router.get("/tasks", controller.getUserTasks.bind(controller));
router.post("/tasks", controller.createTask.bind(controller));
router.get("/tasks/:taskId", controller.getTaskById.bind(controller));
router.put("/tasks/:taskId", controller.updateTask.bind(controller));
router.delete("/tasks/:taskId", controller.deleteTask.bind(controller));
router.post(
  "/tasks/:taskId/complete",
  controller.completeTask.bind(controller)
);
router.get("/suggestions", controller.getSuggestedTasks.bind(controller));

// Export the router as default
export default router;
