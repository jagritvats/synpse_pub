import mongoose, { Document, Schema } from "mongoose"; /**
 * Interface representing a vector document in MongoDB
 */
export interface IVectorDocument extends Document {
  userId: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
  type: string; // Indicates the type of vector document (memory, message, etc.)
  sourceId?: string; // ID of the source document (memory, message, etc.)
  isDeleted?: boolean; // Flag to mark the document as deleted
}

/**
 * Mongoose schema for vector documents
 */
const VectorDocumentSchema = new Schema<IVectorDocument>(
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
    embedding: {
      type: [Number],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    sourceId: {
      type: String,
      index: true,
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

// Create compound indexes for efficient querying
VectorDocumentSchema.index({ userId: 1, type: 1 });

// Create the model
export const VectorDocument = mongoose.model<IVectorDocument>(
  "VectorDocument",
  VectorDocumentSchema
);

export default VectorDocument;
