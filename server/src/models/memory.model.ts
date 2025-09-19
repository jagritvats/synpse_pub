import mongoose, { Document, Schema } from "mongoose";
/**
 * Memory types supported by the application
 */
export enum MemoryType {
  SHORT_TERM = "short_term", // Expires quickly (hours to days)
  MEDIUM_TERM = "medium_term", // Medium duration (days to weeks)
  LONG_TERM = "long_term", // Persistent (weeks to months)
  PERMANENT = "permanent", // Never expires
}

/**
 * Categories of memories
 */
export enum MemoryCategory {
  FACT = "fact", // Factual information about the user
  PREFERENCE = "preference", // User preferences
  INTEREST = "interest", // User interests
  BEHAVIOR = "behavior", // Behavioral patterns
  GOAL = "goal", // User goals or objectives
  INTERACTION = "interaction", // Memorable interactions
  CONVERSATION = "conversation", // Conversation highlights
  EVENT = "event", // Events related to the user
  TOPIC = "topic", // Topics the user has discussed
  CUSTOM = "custom", // Custom memory category
}

/**
 * Interface representing a memory document in MongoDB
 */
export interface IMemory extends Document {
  userId: string;
  text: string;
  type: MemoryType;
  source: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  embedding?: number[];
  importance?: number; // 1-10 scale of importance
  category?: MemoryCategory; // Classification of memory type
  relatedMemories?: string[]; // IDs of related memories
  lastAccessed?: Date; // When this memory was last retrieved/used
  accessCount?: number; // How many times this memory has been accessed
  isDeleted?: boolean; // Flag to mark the memory as deleted
}

/**
 * Mongoose schema for memories
 */
const MemorySchema = new Schema<IMemory>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(MemoryType),
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    embedding: [Number],
    importance: {
      type: Number,
      default: 5,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(MemoryCategory),
      default: MemoryCategory.FACT,
      index: true,
    },
    relatedMemories: [String],
    lastAccessed: {
      type: Date,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound indexes for common query patterns
MemorySchema.index({ userId: 1, category: 1 });
MemorySchema.index({ userId: 1, type: 1 });
MemorySchema.index({ userId: 1, importance: -1 });
MemorySchema.index({ userId: 1, createdAt: -1 });
MemorySchema.index({ userId: 1, lastAccessed: -1 });
MemorySchema.index({ userId: 1, isDeleted: 1 });

// Add text index for text search capabilities
MemorySchema.index({ text: "text" });

// Create the model
export const Memory = mongoose.model<IMemory>("Memory", MemorySchema);

export default Memory;
