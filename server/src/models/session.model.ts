import mongoose, { Schema, Document } from "mongoose";
// Interface matching the one in session.service.ts
export interface ISession extends Document {
  _id: string; // Use _id for Mongoose default ID
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ipAddress?: string;
  endTime?: Date;
  metadata?: Record<string, any>;
  // Add chatHistory here if messages are embedded (Alternative to separate Message collection)
  // chatHistory?: {
  //   id: string;
  //   role: string;
  //   content: string;
  //   timestamp: Date;
  //   status?: string;
  //   metadata?: Record<string, any>;
  // }[];
}

const SessionSchema = new Schema<ISession>(
  {
    _id: {
      type: String,
      required: true,
      // Default set in service logic (UUID or specific 'global-anonymous')
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    endTime: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // chatHistory: [ // Add if embedding messages
    //   {
    //     id: String,
    //     role: String,
    //     content: String,
    //     timestamp: Date,
    //     status: String,
    //     metadata: Schema.Types.Mixed,
    //   }
    // ]
  },
  {
    timestamps: true, // Use Mongoose built-in timestamps (createdAt, updatedAt)
    _id: false, // Disable default Mongoose _id generation since we provide it
  }
);

// Create compound indexes for common query patterns
SessionSchema.index({ userId: 1, lastActivity: -1 }); // For retrieving user's recent sessions
SessionSchema.index({ userId: 1, createdAt: -1 }); // For retrieving user's sessions by creation time
SessionSchema.index({ lastActivity: 1 }); // For cleanup of inactive sessions

// Pre-save hook to ensure lastActivity is updated (Mongoose timestamps handle createdAt/updatedAt)
SessionSchema.pre<ISession>("save", function (next) {
  if (this.isModified()) {
    this.lastActivity = new Date();
  }
  next();
});

export const SessionModel = mongoose.model<ISession>("Session", SessionSchema);

export default SessionModel;
