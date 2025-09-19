import mongoose, { Document, Schema } from "mongoose";
/**
 * Interface representing an action log entry
 */
export interface IActionLog extends Document {
  _id: string;
  userId: string;
  sessionId: string;
  messageId?: string;
  actionId: string;
  actionName: string;
  parameters: Record<string, any>;
  result: any;
  status: "success" | "failure";
  error?: string;
  executedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Mongoose schema for action logs
 */
const ActionLogSchema = new Schema<IActionLog>(
  {
    _id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      index: true,
    },
    actionId: {
      type: String,
      required: true,
      index: true,
    },
    actionName: {
      type: String,
      required: true,
    },
    parameters: {
      type: Schema.Types.Mixed,
      required: true,
    },
    result: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      required: true,
    },
    error: {
      type: String,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
ActionLogSchema.index({ userId: 1, executedAt: -1 });
ActionLogSchema.index({ sessionId: 1, executedAt: -1 });
ActionLogSchema.index({ actionId: 1, executedAt: -1 });

// Create the model
export const ActionLog = mongoose.model<IActionLog>(
  "ActionLog",
  ActionLogSchema
);

export default ActionLog;
