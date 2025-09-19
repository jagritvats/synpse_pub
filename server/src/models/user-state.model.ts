import mongoose, { Document, Schema } from "mongoose"; // Interface for User Interests
export interface IUserInterest {
  topic: string;
  level: number; // e.g., 1-5 scale
  addedAt: Date;
}

// Interface for Integrations (Example: Notion)
export interface IIntegration {
  platform: string; // "notion", "google_drive", "twitter", etc.
  credentials: {
    token?: string;
    userId?: string;
    workspaceId?: string;
    pageId?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    // Add other platform-specific credentials
  };
  enabled: boolean;
  lastSync?: Date;
  metadata?: Record<string, any>;
}

// Interface for User Goals
export interface IUserGoal {
  goal: string;
  priority: number; // 1-10 scale
  progress?: number; // 0-100 scale
  createdAt: Date;
}

// Interface for the UserState document
export interface IUserState extends Document {
  userId: string; // Link to the main User model
  interests: IUserInterest[];
  integrations: IIntegration[];
  userGoals: IUserGoal[]; // User-defined goals
  globalPrompt?: string; // Custom prompt applied to all AI interactions
  // Add other user-specific state fields here later (e.g., social maps, preferences)
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schemas
const InterestSchema = new Schema<IUserInterest>(
  {
    topic: { type: String, required: true },
    level: { type: Number, min: 1, max: 5, default: 3 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
); // No separate _id for subdocuments unless needed

const IntegrationSchema = new Schema<IIntegration>(
  {
    platform: {
      type: String,
      required: true,
    },
    credentials: { type: Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: false },
    lastSync: Date,
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const UserGoalSchema = new Schema<IUserGoal>(
  {
    goal: { type: String, required: true },
    priority: { type: Number, min: 1, max: 10, default: 5 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserStateSchema = new Schema<IUserState>(
  {
    userId: {
      type: String, // Storing as String, assuming User ID is managed elsewhere
      required: true,
      unique: true,
      index: true,
    },
    interests: {
      type: [InterestSchema],
      default: [],
    },
    integrations: {
      type: [IntegrationSchema],
      default: [],
    },
    userGoals: {
      type: [UserGoalSchema],
      default: [],
    },
    globalPrompt: {
      type: String,
      default: "",
    },
    // Add other fields here
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

export const UserState = mongoose.model<IUserState>(
  "UserState",
  UserStateSchema
);

export default UserState;
