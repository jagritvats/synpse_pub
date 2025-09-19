import mongoose, { Document, Schema } from "mongoose"; /**
 * Enum representing different activity types
 */
export enum ActivityType {
  NORMAL = "normal",
  ROLEPLAY = "roleplay",
  GAME = "game",
  BRAINSTORM = "brainstorm",
  CUSTOM = "custom",
}

/**
 * Base interface for the activity state data
 */
export interface IActivityState {
  type: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Interface for roleplay activity state
 */
export interface IRoleplayState {
  scenario: string;
  setting?: string;
  era?: string;
  currentLocation?: string;
  characters: Array<{
    name: string;
    description?: string;
    personality?: string;
    background?: string;
    appearance?: string;
    motivation?: string;
    goal?: string;
    role?: string;
    status?: string;
    mood?: string;
  }>;
  plot?: string;
  currentScene?: string;
  recentEvents?: string[];
  userCharacter?: string;
  aiCharacter?: string;
  mood?: string;
  items?: Record<string, any>;
  locations?: Record<string, any>;
  eventLog?: IRoleplayEventLogEntry[];
}

/**
 * Interface for an entry in the roleplay event log
 */
export interface IRoleplayEventLogEntry {
  event: string;
  mood?: string; // Mood at the time of the event
  timestamp: Date;
}

/**
 * Interface for game activity state
 */
export interface IGameState {
  gameType: string;
  goal?: string;
  board?: any;
  currentPlayer?: string;
  moves?: number;
  winner?: string | null;
  score?: Record<string, number>;
  rules?: string;
  difficulty?: string;
  timeLimit?: number;
  timeRemaining?: number;
}

/**
 * Interface for brainstorm activity state
 */
export interface IBrainstormState {
  topic: string;
  ideas: Array<{
    id: string;
    text: string;
    category?: string;
    votes?: number;
    createdAt: Date;
  }>;
  categories?: string[];
  phase?: "ideation" | "grouping" | "voting" | "refinement";
  goal?: string;
  constraints?: string[];
}

/**
 * Interface for activity engagement tracking
 */
export interface IActivityEngagement {
  messageCount: number;
  lastRelevantMessageId?: string;
  lastRelevantMessageTime?: Date;
  relevanceScores: number[]; // Array of recent message relevance scores
  consecutiveIrrelevantMessages: number;
  userParticipationScore: number; // 0-10 scale
  lastPromptTime?: Date;
}

/**
 * Interface representing an activity document in MongoDB
 */
export interface IActivity extends Document {
  _id: string;
  userId: string;
  sessionId: string;
  type: ActivityType;
  name: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  state: IActivityState;
  contextIds: string[]; // References to context IDs associated with this activity
  messageIds: string[]; // References to message IDs associated with this activity
  engagement?: IActivityEngagement;
  goal?: string;
  userGoal?: string;
  assistantGoal?: string;
  summaryMemoryId?: string;
  metadata?: Record<string, any>;
}

/**
 * Schema for activity state
 */
const ActivityStateSchema = new Schema<IActivityState>(
  {
    type: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

/**
 * Schema for activity engagement tracking
 */
const ActivityEngagementSchema = new Schema(
  {
    messageCount: {
      type: Number,
      default: 0,
    },
    lastRelevantMessageId: String,
    lastRelevantMessageTime: Date,
    relevanceScores: {
      type: [Number],
      default: [],
    },
    consecutiveIrrelevantMessages: {
      type: Number,
      default: 0,
    },
    userParticipationScore: {
      type: Number,
      default: 5,
    },
    lastPromptTime: Date,
  },
  { _id: false }
);

/**
 * Mongoose schema for activities
 */
const ActivitySchema = new Schema<IActivity>(
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
    type: {
      type: String,
      required: true,
      enum: Object.values(ActivityType),
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endTime: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    state: {
      type: ActivityStateSchema,
      required: true,
    },
    contextIds: [
      {
        type: String,
      },
    ],
    messageIds: [
      {
        type: String,
      },
    ],
    engagement: {
      type: ActivityEngagementSchema,
      default: () => ({
        messageCount: 0,
        relevanceScores: [],
        consecutiveIrrelevantMessages: 0,
        userParticipationScore: 5,
      }),
    },
    goal: { type: String },
    userGoal: { type: String },
    assistantGoal: { type: String },
    summaryMemoryId: { type: String },
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
ActivitySchema.index({ userId: 1, isActive: 1 });
ActivitySchema.index({ sessionId: 1, isActive: 1 });
ActivitySchema.index({ userId: 1, type: 1 });
ActivitySchema.index({ userId: 1, createdAt: -1 });

// Create the model
export const Activity = mongoose.model<IActivity>("Activity", ActivitySchema);

export default Activity;
