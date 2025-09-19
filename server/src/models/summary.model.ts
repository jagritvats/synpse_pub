import mongoose, { Document, Schema } from "mongoose";/**
 * Interface for the user summary record stored in the database
 */
export interface IUserSummary extends Document {
  userId: string;
  sessionId: string;
  timestamp: Date;
  summary: string;
  memoryCount: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

/**
 * Mongoose schema for user summary records
 */
const UserSummarySchema = new Schema<IUserSummary>(
  {
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
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    memoryCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Create a compound index for efficient queries
UserSummarySchema.index({ userId: 1, sessionId: 1, timestamp: -1 });

// Create the model
const UserSummary = mongoose.model<IUserSummary>(
  "UserSummary",
  UserSummarySchema
);

export default UserSummary;
