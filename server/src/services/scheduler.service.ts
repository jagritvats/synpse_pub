import { v4 as uuidv4 } from "uuid";import { aiService } from "./ai.service";
import { memoryService } from "./memory.service";
import { contextService } from "./context.service";

/**
 * Interface for scheduled tasks
 */
interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  description: string;
  dueDate: string; // ISO string
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "cancelled";
  recurringPattern?: string; // cron-like pattern
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for scheduling and managing tasks
 * Based on NestJS implementation: ../server/src/modules/scheduler/scheduler.service.ts
 */
class SchedulerService {
  // In-memory storage for tasks
  private tasks: Map<string, ScheduledTask> = new Map();

  // Timeout IDs for task reminders
  private taskTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new scheduled task
   */
  createTask(
    userId: string,
    taskData: {
      title: string;
      description: string;
      dueDate: string;
      priority?: "high" | "medium" | "low";
      recurringPattern?: string;
      metadata?: Record<string, any>;
    }
  ): ScheduledTask {
    const now = new Date().toISOString();

    const task: ScheduledTask = {
      id: uuidv4(),
      userId,
      title: taskData.title,
      description: taskData.description,
      dueDate: taskData.dueDate,
      priority: taskData.priority || "medium",
      status: "pending",
      recurringPattern: taskData.recurringPattern,
      createdAt: now,
      updatedAt: now,
      metadata: taskData.metadata || {},
    };

    this.tasks.set(task.id, task);
    this.scheduleTaskReminder(task);

    return task;
  }

  /**
   * Get all tasks for a user
   */
  getUserTasks(
    userId: string,
    filters?: {
      status?: "pending" | "completed" | "cancelled";
      priority?: "high" | "medium" | "low";
      dueBefore?: string;
      dueAfter?: string;
    }
  ): ScheduledTask[] {
    const tasks = Array.from(this.tasks.values()).filter(
      (task) => task.userId === userId
    );

    // Apply filters if provided
    if (filters) {
      return tasks.filter((task) => {
        if (filters.status && task.status !== filters.status) {
          return false;
        }

        if (filters.priority && task.priority !== filters.priority) {
          return false;
        }

        if (
          filters.dueBefore &&
          new Date(task.dueDate) > new Date(filters.dueBefore)
        ) {
          return false;
        }

        if (
          filters.dueAfter &&
          new Date(task.dueDate) < new Date(filters.dueAfter)
        ) {
          return false;
        }

        return true;
      });
    }

    return tasks;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Update an existing task
   */
  updateTask(
    taskId: string,
    updates: Partial<
      Omit<
        ScheduledTask,
        "id" | "userId" | "createdAt" | "updatedAt" | "completedAt"
      >
    >
  ): ScheduledTask | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    // Clear existing timer if due date is changing
    if (updates.dueDate && updates.dueDate !== task.dueDate) {
      this.clearTaskReminder(taskId);
    }

    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Set completedAt when status changes to completed
    if (updates.status === "completed" && task.status !== "completed") {
      updatedTask.completedAt = new Date().toISOString();
    } else if (updates.status !== "completed") {
      // Remove completedAt if status is not completed
      delete updatedTask.completedAt;
    }

    this.tasks.set(taskId, updatedTask);

    // Schedule new reminder if the task is still pending and has a due date
    if (updatedTask.status === "pending") {
      this.scheduleTaskReminder(updatedTask);
    }

    return updatedTask;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    this.clearTaskReminder(taskId);
    return this.tasks.delete(taskId);
  }

  /**
   * Delete all tasks for a user
   */
  deleteAllUserTasks(userId: string): number {
    let count = 0;

    for (const [id, task] of this.tasks.entries()) {
      if (task.userId === userId) {
        this.clearTaskReminder(id);
        this.tasks.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Mark a task as completed
   */
  completeTask(taskId: string): ScheduledTask | null {
    return this.updateTask(taskId, { status: "completed" });
  }

  /**
   * Mark a task as cancelled
   */
  cancelTask(taskId: string): ScheduledTask | null {
    return this.updateTask(taskId, { status: "cancelled" });
  }

  /**
   * Suggest tasks based on user context and history
   */
  async suggestTasks(
    userId: string,
    maxSuggestions: number = 3
  ): Promise<Partial<ScheduledTask>[]> {
    try {
      // Gather context for AI suggestion
      const contextSummary =
        await contextService.generateContextSummary(userId);

      // Get user's task history
      const userTasks = this.getUserTasks(userId);
      const completedTasks = userTasks.filter(
        (task) => task.status === "completed"
      );
      const pendingTasks = userTasks.filter(
        (task) => task.status === "pending"
      );

      // Get relevant memories to inform suggestions
      const relevantMemories = await memoryService.getRelevantMemories(
        userId,
        "tasks goals priorities",
        5
      );

      // Create prompt for AI
      const prompt = `
Based on the user's context, completed tasks, pending tasks, and relevant memories, suggest ${maxSuggestions} new tasks that would be helpful for the user. 

USER CONTEXT:
${contextSummary}

COMPLETED TASKS (${completedTasks.length}):
${completedTasks
  .slice(0, 5)
  .map(
    (t) =>
      `- ${t.title}: ${t.description} (completed on ${new Date(t.completedAt || "").toLocaleDateString()})`
  )
  .join("\n")}

PENDING TASKS (${pendingTasks.length}):
${pendingTasks.map((t) => `- ${t.title}: ${t.description} (due on ${new Date(t.dueDate).toLocaleDateString()})`).join("\n")}

RELEVANT MEMORIES:
${relevantMemories.map((m) => `- ${m.memory.text}`).join("\n")}

For each suggested task, provide:
1. A clear, specific title
2. A brief description
3. A suitable due date (ISO string)
4. A priority level (high, medium, or low)

Format your response as a JSON array of objects, each with these properties:
- title
- description
- dueDate (ISO string)
- priority

TASK SUGGESTIONS:
`;

      // Generate suggestions using AI
      const response = await aiService.generateResponse(
        prompt,
        {
          temperature: 0.7,
          max_tokens: 1000,
        },
        undefined,
        userId
      );

      // Parse suggestions from AI response
      try {
        const jsonMatch = response.text.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);

          // Validate and format suggestions
          return suggestions
            .filter(
              (suggestion: any) =>
                suggestion.title &&
                suggestion.description &&
                suggestion.dueDate &&
                suggestion.priority
            )
            .map((suggestion: any) => ({
              title: suggestion.title,
              description: suggestion.description,
              dueDate: suggestion.dueDate,
              priority: suggestion.priority.toLowerCase() as
                | "high"
                | "medium"
                | "low",
            }));
        }
      } catch (error) {
        console.error("Error parsing suggested tasks:", error);
      }

      return [];
    } catch (error) {
      console.error("Error suggesting tasks:", error);
      return [];
    }
  }

  /**
   * Schedule a reminder for a task
   */
  private scheduleTaskReminder(task: ScheduledTask): void {
    // Clear any existing timer
    this.clearTaskReminder(task.id);

    // Calculate time until due date
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const timeUntilDue = dueDate.getTime() - now.getTime();

    // Only schedule if due date is in the future
    if (timeUntilDue > 0) {
      const timer = setTimeout(
        () => {
          console.log(`Reminder: Task "${task.title}" is due now`);
          // In a real implementation, this would trigger a notification to the user
        },
        Math.min(timeUntilDue, 2147483647)
      ); // Limit to max setTimeout value

      this.taskTimers.set(task.id, timer);
    }
  }

  /**
   * Clear a scheduled reminder
   */
  private clearTaskReminder(taskId: string): void {
    const timer = this.taskTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(taskId);
    }
  }
}

// Create singleton instance
export const schedulerService = new SchedulerService();

/**
 * Initialize the scheduler service
 * This function should be called when the server starts
 */
export function initScheduler(): void {
  console.log("Scheduler service initialized");
  // Any initialization logic can go here
  // For example, loading tasks from a database
}
