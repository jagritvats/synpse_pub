import mongoose, { Document, Schema } from "mongoose";
import { ContextType } from "../interfaces/context-type.enum";
import { ContextDuration } from "../interfaces/context-duration.enum";

/**
 * Interface representing a context document in MongoDB
 */
export interface IContext extends Document {
  userId: string;
  type: ContextType;
  duration: ContextDuration;
  data: any;
  createdAt: Date;
  expiresAt?: Date;
  source: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  updatedAt?: Date;
}

/**
 * Mongoose schema for contexts
 */
const ContextSchema = new Schema<IContext>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(ContextType),
      index: true,
    },
    duration: {
      type: String,
      required: true,
      enum: Object.values(ContextDuration),
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    source: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    updatedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
ContextSchema.index({ userId: 1, type: 1, isActive: 1 });
ContextSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Create the model
export const Context = mongoose.model<IContext>("Context", ContextSchema);

export default Context;
