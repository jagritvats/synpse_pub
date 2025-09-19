import mongoose, { Schema, Document } from "mongoose";
/**
 * Interface for companion thinking records
 */
export interface IThinkingRecord extends Document {
  userId: string;
  sessionId: string;
  timestamp: Date;
  analysis: string;
  subconscious: string;
  topics: string[];
  sentiment: "positive" | "negative" | "neutral";
  strategy: string;
  goals: Array<{ goal: string; priority: number; progress: number }>;
  messageId?: string; // Optional link to the message that triggered this analysis
  metadata?: Record<string, any>;
}

/**
 * Schema for companion thinking records
 */
const ThinkingRecordSchema = new Schema<IThinkingRecord>(
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
    analysis: {
      type: String,
      required: true,
    },
    subconscious: {
      type: String,
      required: true,
    },
    topics: {
      type: [String],
      default: [],
    },
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral"],
      default: "neutral",
    },
    strategy: {
      type: String,
      required: true,
    },
    goals: [
      {
        goal: String,
        priority: Number,
        progress: Number,
      },
    ],
    messageId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // Add createdAt, updatedAt timestamps
  }
);

// Create indexes for efficient queries
ThinkingRecordSchema.index({ userId: 1, timestamp: -1 });
ThinkingRecordSchema.index({ sessionId: 1, timestamp: -1 });

export const ThinkingRecord = mongoose.model<IThinkingRecord>(
  "ThinkingRecord",
  ThinkingRecordSchema
);

export default ThinkingRecord;
