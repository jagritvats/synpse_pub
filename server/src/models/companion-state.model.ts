import mongoose, { Document, Schema } from "mongoose";/**
 * Enum representing companion emotional states
 */
export enum CompanionEmotion {
  NEUTRAL = "neutral",
  HAPPY = "happy",
  CURIOUS = "curious",
  CONCERNED = "concerned",
  THOUGHTFUL = "thoughtful",
  EXCITED = "excited",
  CONFUSED = "confused",
  EMPATHETIC = "empathetic",
  DETERMINED = "determined",
  AMUSED = "amused",
}

/**
 * Interface representing a companion's thought process
 */
export interface IThought {
  thought: string;
  content?: string;
  timestamp: Date;
  category: "observation" | "reflection" | "plan" | "question" | "insight";
  priority: number; // 1-10
  metadata?: Record<string, any>;
}

/**
 * Represents a goal for the companion
 */
export interface IGoal {
  goal: string;
  priority: number; // Higher value means higher priority
  progress?: number; // 0-100
  createdAt: Date;
}

/**
 * Interface representing a companion state document in MongoDB
 */
export interface ICompanionState extends Document {
  userId: string;
  currentEmotion: {
    emotion: CompanionEmotion;
    intensity: number; // 1-10
    reason?: string;
    since: Date;
  };
  recentThoughts: IThought[];
  thoughtLoops: {
    topic: string;
    thoughts: string[];
    intensity: number; // 1-10
    firstDetected: Date;
    lastDetected: Date;
    resolved: boolean;
    resolution?: string;
  }[];
  focusAreas: {
    topic: string;
    importance: number; // 1-10
    since: Date;
  }[];
  lastInteractionAt: Date;
  currentGoals: IGoal[];
  userDefinedGoals: IGoal[];
  metadata: Record<string, any>;
}

/**
 * Mongoose schema for companion thoughts
 */
const ThoughtSchema = new Schema<IThought>({
  thought: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  category: {
    type: String,
    required: true,
    enum: ["observation", "reflection", "plan", "question", "insight"],
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

/**
 * Mongoose schema for companion state
 */
const CompanionStateSchema = new Schema<ICompanionState>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    currentEmotion: {
      emotion: {
        type: String,
        enum: Object.values(CompanionEmotion),
        default: CompanionEmotion.NEUTRAL,
      },
      intensity: {
        type: Number,
        min: 1,
        max: 10,
        default: 5,
      },
      reason: String,
      since: {
        type: Date,
        default: Date.now,
      },
    },
    recentThoughts: {
      type: [ThoughtSchema],
      default: [],
    },
    thoughtLoops: [
      {
        topic: String,
        thoughts: [String],
        intensity: {
          type: Number,
          min: 1,
          max: 10,
        },
        firstDetected: {
          type: Date,
          default: Date.now,
        },
        lastDetected: {
          type: Date,
          default: Date.now,
        },
        resolved: {
          type: Boolean,
          default: false,
        },
        resolution: String,
      },
    ],
    focusAreas: [
      {
        topic: String,
        importance: {
          type: Number,
          min: 1,
          max: 10,
        },
        since: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
    currentGoals: [
      {
        goal: String,
        priority: {
          type: Number,
          min: 1,
          max: 10,
        },
        progress: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    userDefinedGoals: [
      {
        goal: String,
        priority: {
          type: Number,
          min: 1,
          max: 10,
        },
        progress: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
CompanionStateSchema.index({ userId: 1 });
CompanionStateSchema.index({ lastInteractionAt: -1 });

// Create the model
export const CompanionState = mongoose.model<ICompanionState>(
  "CompanionState",
  CompanionStateSchema
);

export default CompanionState;
