import mongoose, { Document, Schema } from "mongoose"; /**
 * Interface representing a chat message document in MongoDB
 */
export interface IMessage extends Document {
  _id: string;
  userId: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  executedActions?: {
    actionId: string;
    success: boolean;
    result?: any;
    error?: string;
  }[];
  contextSnapshot?: {
    type: string;
    data: any;
  }[];
  vectorEmbedding?: number[];
  isContextSummary?: boolean;
  parentMessageId?: string;
  referencedMemories?: string[];
  isDeleted?: boolean;
}

/**
 * Mongoose schema for chat messages
 */
const MessageSchema = new Schema<IMessage>(
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
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant", "system"],
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    executedActions: [
      {
        actionId: String,
        success: Boolean,
        result: Schema.Types.Mixed,
        error: String,
      },
    ],
    contextSnapshot: [
      {
        type: String,
        data: Schema.Types.Mixed,
      },
    ],
    vectorEmbedding: [Number],
    isContextSummary: {
      type: Boolean,
      default: false,
    },
    parentMessageId: {
      type: String,
      index: true,
    },
    referencedMemories: [String],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Create compound indexes for common query patterns
MessageSchema.index({ sessionId: 1, timestamp: -1 }); // For retrieving session history sorted by time
MessageSchema.index({ userId: 1, timestamp: -1 }); // For retrieving user's messages across all sessions
MessageSchema.index({ sessionId: 1, isDeleted: 1 }); // For filtering non-deleted messages in a session

// Create the model
export const Message = mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
