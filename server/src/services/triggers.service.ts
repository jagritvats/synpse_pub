import { v4 as uuidv4 } from "uuid";

/**
 * Trigger types supported by the application
 */
export enum TriggerType {
  TIME = "time",
  EVENT = "event",
  CONDITION = "condition",
}

/**
 * Action types that can be executed when a trigger fires
 */
export enum ActionType {
  NOTIFICATION = "notification",
  EMAIL = "email",
  EXECUTE_FUNCTION = "execute_function",
  API_CALL = "api_call",
}

/**
 * Interface for trigger definition
 */
export interface Trigger {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: TriggerType;
  conditions: any; // Specific to trigger type
  actions: Action[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
}

/**
 * Interface for action definition
 */
export interface Action {
  id: string;
  type: ActionType;
  config: any; // Specific to action type
}

/**
 * Service for managing triggers and automated workflows
 */
class TriggersService {
  // In-memory storage - would be replaced with a database in production
  private triggers: Map<string, Trigger> = new Map();

  /**
   * Create a new trigger
   */
  createTrigger(
    userId: string,
    name: string,
    type: TriggerType,
    conditions: any,
    actions: Action[],
    description?: string
  ): Trigger {
    const timestamp = new Date().toISOString();

    // Assign IDs to actions if they don't have one
    const processedActions = actions.map((action) => ({
      ...action,
      id: action.id || uuidv4(),
    }));

    const trigger: Trigger = {
      id: uuidv4(),
      userId,
      name,
      description,
      type,
      conditions,
      actions: processedActions,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.triggers.set(trigger.id, trigger);
    return trigger;
  }

  /**
   * Get all triggers for a user
   */
  getUserTriggers(userId: string): Trigger[] {
    return Array.from(this.triggers.values())
      .filter((trigger) => trigger.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  /**
   * Get a specific trigger by ID
   */
  getTrigger(triggerId: string): Trigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Update an existing trigger
   */
  updateTrigger(
    triggerId: string,
    updates: Partial<Trigger>
  ): Trigger | undefined {
    const trigger = this.triggers.get(triggerId);

    if (!trigger) {
      return undefined;
    }

    const updatedTrigger: Trigger = {
      ...trigger,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.triggers.set(triggerId, updatedTrigger);
    return updatedTrigger;
  }

  /**
   * Delete a trigger
   */
  deleteTrigger(triggerId: string): boolean {
    return this.triggers.delete(triggerId);
  }

  /**
   * Activate a trigger
   */
  activateTrigger(triggerId: string): Trigger | undefined {
    return this.updateTrigger(triggerId, { isActive: true });
  }

  /**
   * Deactivate a trigger
   */
  deactivateTrigger(triggerId: string): Trigger | undefined {
    return this.updateTrigger(triggerId, { isActive: false });
  }

  /**
   * Manually execute a trigger
   */
  async executeTrigger(triggerId: string): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);

    if (!trigger || !trigger.isActive) {
      return false;
    }

    try {
      // Record that the trigger was executed
      this.updateTrigger(triggerId, {
        lastTriggered: new Date().toISOString(),
      });

      // Execute all actions
      for (const action of trigger.actions) {
        await this.executeAction(action);
      }

      return true;
    } catch (error) {
      console.error(`Error executing trigger ${triggerId}:`, error);
      return false;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: Action): Promise<void> {
    // This would be implemented with actual action execution logic
    switch (action.type) {
      case ActionType.NOTIFICATION:
        console.log(
          `Executing notification action: ${JSON.stringify(action.config)}`
        );
        // Would integrate with notification service
        break;

      case ActionType.EMAIL:
        console.log(`Executing email action: ${JSON.stringify(action.config)}`);
        // Would integrate with email service
        break;

      case ActionType.EXECUTE_FUNCTION:
        console.log(
          `Executing function action: ${JSON.stringify(action.config)}`
        );
        // Would dynamically execute a function
        break;

      case ActionType.API_CALL:
        console.log(
          `Executing API call action: ${JSON.stringify(action.config)}`
        );
        // Would make an API call
        break;

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * Process time-based triggers
   * This would be called by a scheduler
   */
  processTimeTriggers(): void {
    const now = new Date();

    Array.from(this.triggers.values())
      .filter(
        (trigger) => trigger.isActive && trigger.type === TriggerType.TIME
      )
      .forEach((trigger) => {
        // Check if the time condition is met
        const shouldExecute = this.evaluateTimeCondition(
          trigger.conditions,
          now
        );

        if (shouldExecute) {
          this.executeTrigger(trigger.id);
        }
      });
  }

  /**
   * Process event-based triggers
   * This would be called when events occur in the system
   */
  processEventTriggers(eventType: string, eventData: any): void {
    Array.from(this.triggers.values())
      .filter(
        (trigger) =>
          trigger.isActive &&
          trigger.type === TriggerType.EVENT &&
          trigger.conditions.eventType === eventType
      )
      .forEach((trigger) => {
        // Check if the event data meets the conditions
        const shouldExecute = this.evaluateEventCondition(
          trigger.conditions,
          eventData
        );

        if (shouldExecute) {
          this.executeTrigger(trigger.id);
        }
      });
  }

  /**
   * Evaluate time-based conditions
   */
  private evaluateTimeCondition(conditions: any, currentTime: Date): boolean {
    // Implement time condition evaluation logic
    // This is a placeholder implementation
    return true;
  }

  /**
   * Evaluate event-based conditions
   */
  private evaluateEventCondition(conditions: any, eventData: any): boolean {
    // Implement event condition evaluation logic
    // This is a placeholder implementation
    return true;
  }
}

// Create a singleton instance
export const triggersService = new TriggersService();
