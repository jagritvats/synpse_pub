import { ActionLog, IActionLog } from "../models/action-log.model";import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("ActionLogService");

/**
 * Service for managing action logs
 */
class ActionLogService {
  /**
   * Log an executed action
   */
  async logAction(
    userId: string,
    sessionId: string,
    actionId: string,
    actionName: string,
    parameters: Record<string, any>,
    result: any,
    messageId?: string,
    metadata?: Record<string, any>
  ): Promise<IActionLog> {
    try {
      const actionLog = new ActionLog({
        userId,
        sessionId,
        messageId,
        actionId,
        actionName,
        parameters,
        result,
        status: "success",
        executedAt: new Date(),
        metadata,
      });

      await actionLog.save();
      logger.info(`Action logged: ${actionName} (${actionId})`);
      return actionLog;
    } catch (error) {
      logger.error(`Error logging action ${actionName}:`, error);
      throw error;
    }
  }

  /**
   * Log a failed action
   */
  async logFailedAction(
    userId: string,
    sessionId: string,
    actionId: string,
    actionName: string,
    parameters: Record<string, any>,
    error: string,
    messageId?: string,
    metadata?: Record<string, any>
  ): Promise<IActionLog> {
    try {
      const actionLog = new ActionLog({
        userId,
        sessionId,
        messageId,
        actionId,
        actionName,
        parameters,
        error,
        status: "failure",
        executedAt: new Date(),
        metadata,
      });

      await actionLog.save();
      logger.info(`Failed action logged: ${actionName} (${actionId})`);
      return actionLog;
    } catch (err) {
      logger.error(`Error logging failed action ${actionName}:`, err);
      throw err;
    }
  }

  /**
   * Get action logs for a user
   */
  async getUserActionLogs(
    userId: string,
    options: {
      sessionId?: string;
      actionId?: string;
      status?: "success" | "failure";
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<IActionLog[]> {
    try {
      const query: any = { userId };

      if (options.sessionId) query.sessionId = options.sessionId;
      if (options.actionId) query.actionId = options.actionId;
      if (options.status) query.status = options.status;

      const actionLogs = await ActionLog.find(query)
        .sort({ executedAt: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 50)
        .exec();

      return actionLogs;
    } catch (error) {
      logger.error(`Error getting user action logs:`, error);
      throw error;
    }
  }

  /**
   * Get action logs for a session
   */
  async getSessionActionLogs(
    sessionId: string,
    options: {
      status?: "success" | "failure";
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<IActionLog[]> {
    try {
      const query: any = { sessionId };

      if (options.status) query.status = options.status;

      const actionLogs = await ActionLog.find(query)
        .sort({ executedAt: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 50)
        .exec();

      return actionLogs;
    } catch (error) {
      logger.error(`Error getting session action logs:`, error);
      throw error;
    }
  }

  /**
   * Get action logs for a message
   */
  async getMessageActionLogs(messageId: string): Promise<IActionLog[]> {
    try {
      return await ActionLog.find({ messageId })
        .sort({ executedAt: -1 })
        .exec();
    } catch (error) {
      logger.error(`Error getting message action logs:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
export const actionLogService = new ActionLogService();
