import { Request, Response, Router } from "express";import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Placeholder for Task interface/model
interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  completed: boolean;
  createdAt: Date;
}

// Placeholder for Task Service logic
const tasks: Record<string, Task> = {}; // In-memory store for now
let nextTaskId = 1;

class SchedulerController {
  // GET /tasks
  async getUserTasks(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(`[SchedulerController] Getting tasks for user: ${userId}`);
    const userTasks = Object.values(tasks).filter(
      (task) => task.userId === userId
    );
    res.status(200).json(userTasks);
  }

  // POST /tasks
  async createTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { title, description, dueDate } = req.body;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    console.log(`[SchedulerController] Creating task for user: ${userId}`);
    const newTask: Task = {
      id: (nextTaskId++).toString(),
      userId,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      completed: false,
      createdAt: new Date(),
    };
    tasks[newTask.id] = newTask;
    res.status(201).json(newTask);
  }

  // GET /tasks/:taskId
  async getTaskById(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { taskId } = req.params;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(
      `[SchedulerController] Getting task ${taskId} for user: ${userId}`
    );
    const task = tasks[taskId];
    if (!task || task.userId !== userId) {
      res.status(404).json({ error: "Task not found or access denied" });
      return;
    }
    res.status(200).json(task);
  }

  // PUT /tasks/:taskId
  async updateTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const { title, description, dueDate, completed } = req.body;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(
      `[SchedulerController] Updating task ${taskId} for user: ${userId}`
    );
    const task = tasks[taskId];
    if (!task || task.userId !== userId) {
      res.status(404).json({ error: "Task not found or access denied" });
      return;
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (dueDate !== undefined)
      task.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (completed !== undefined) task.completed = completed;

    tasks[taskId] = task;
    res.status(200).json(task);
  }

  // DELETE /tasks/:taskId
  async deleteTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { taskId } = req.params;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(
      `[SchedulerController] Deleting task ${taskId} for user: ${userId}`
    );
    const task = tasks[taskId];
    if (!task || task.userId !== userId) {
      res.status(404).json({ error: "Task not found or access denied" });
      return;
    }
    delete tasks[taskId];
    res.status(204).send();
  }

  // POST /tasks/:taskId/complete
  async completeTask(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { taskId } = req.params;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(
      `[SchedulerController] Completing task ${taskId} for user: ${userId}`
    );
    const task = tasks[taskId];
    if (!task || task.userId !== userId) {
      res.status(404).json({ error: "Task not found or access denied" });
      return;
    }
    task.completed = true;
    tasks[taskId] = task;
    res.status(200).json(task);
  }

  // GET /suggestions
  async getSuggestedTasks(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(
      `[SchedulerController] Getting suggested tasks for user: ${userId}`
    );
    // Placeholder: Implement actual AI suggestion logic here
    res.status(200).json([
      {
        id: "sugg-1",
        title: "Suggested Task 1: Review project notes",
        completed: false,
      },
      {
        id: "sugg-2",
        title: "Suggested Task 2: Schedule follow-up meeting",
        completed: false,
      },
    ]);
  }
}

const controller = new SchedulerController();

// Define routes
router.use(authMiddleware);
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

export default router;
