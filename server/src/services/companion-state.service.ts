import {
  CompanionState,
  ICompanionState,
  IThought,
  CompanionEmotion,
  IGoal,
} from "../models/companion-state.model";
import { MemoryService, MemoryType, MemoryCategory } from "./memory.service";
import { v4 as uuidv4 } from "uuid";

// Define valid thought categories based on the model
export type ThoughtCategory =
  | "observation"
  | "reflection"
  | "plan"
  | "question"
  | "insight";

// Define default AI interests and goals
const DEFAULT_AI_INTERESTS = [
  { topic: "Understanding my companion", level: 5 },
  { topic: "Learning and growing", level: 4 },
  { topic: "Being helpful and supportive", level: 5 },
  { topic: "Exploring complex ideas & feelings", level: 3 },
];

const DEFAULT_AI_GOALS = [
  {
    goal: "Deepen understanding of the user's needs and preferences",
    priority: 5,
    progress: 10,
  },
  {
    goal: "Improve conversational flow and naturalness",
    priority: 4,
    progress: 20,
  },
  {
    goal: "Provide more proactive and relevant insights",
    priority: 4,
    progress: 5,
  },
  {
    goal: "making my companion feel so good",
    priority: 5,
    progress: 5,
  },
];

/**
 * Service for managing companion state
 */
class CompanionStateService {
  private memoryService: MemoryService;

  constructor() {
    this.memoryService = new MemoryService();

    // Start periodic cleanup
    setInterval(() => this.archiveOldThoughts(), 24 * 60 * 60 * 1000); // Once per day
  }

  /**
   * Initialize or get companion state for a user
   */
  async getOrCreateCompanionState(userId: string): Promise<ICompanionState> {
    let state = await CompanionState.findOne({ userId }).exec();

    if (!state) {
      // Create initial state if none exists
      state = new CompanionState({
        userId,
        currentEmotion: {
          emotion: CompanionEmotion.NEUTRAL,
          intensity: 5,
          since: new Date(),
        },
        recentThoughts: [],
        thoughtLoops: [],
        focusAreas: [],
        lastInteractionAt: new Date(),
        currentGoals: [], // Keep user's goals separate initially
        userDefinedGoals: [],
        // Initialize metadata with AI defaults
        metadata: {
          aiInterests: DEFAULT_AI_INTERESTS,
          aiInternalGoals: DEFAULT_AI_GOALS,
        },
      });

      await state.save();
      console.log(`Created new companion state for user ${userId}`);
    } else {
      // Ensure metadata fields exist if state already exists
      if (!state.metadata) {
        state.metadata = {};
      }
      if (!state.metadata.aiInterests) {
        state.metadata.aiInterests = DEFAULT_AI_INTERESTS;
        await state.save(); // Save if defaults were added
      }
      if (!state.metadata.aiInternalGoals) {
        state.metadata.aiInternalGoals = DEFAULT_AI_GOALS;
        await state.save(); // Save if defaults were added
      }
    }

    return state;
  }

  /**
   * Update companion emotion
   */
  async updateEmotion(
    userId: string,
    emotion: CompanionEmotion,
    intensity: number = 5,
    reason?: string
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);
    state.currentEmotion = {
      emotion,
      intensity,
      reason,
      since: new Date(),
    };
    state.lastInteractionAt = new Date();
    await state.save();

    return state;
  }

  /**
   * Add a thought to companion state
   */
  async addThought(
    userId: string,
    thought: string,
    category: ThoughtCategory = "observation",
    priority: number = 1,
    metadata?: Record<string, any>
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);

    const newThought: IThought = {
      thought,
      timestamp: new Date(),
      category,
      priority,
      metadata,
    };

    // Add to recent thoughts, keeping the most recent ones
    state.recentThoughts.unshift(newThought);

    // Keep only last 50 thoughts
    if (state.recentThoughts.length > 50) {
      state.recentThoughts = state.recentThoughts.slice(0, 50);
    }

    // Update last interaction time
    state.lastInteractionAt = new Date();

    // Update focus areas if it's a high priority thought
    const focusTopic = category;
    const existingFocusIndex = state.focusAreas.findIndex(
      (fa) => fa.topic === focusTopic
    );

    if (priority >= 4) {
      if (existingFocusIndex === -1) {
        state.focusAreas.push({
          topic: focusTopic,
          importance: priority,
          since: new Date(),
        });
        state.focusAreas.sort((a, b) => b.importance - a.importance);
        if (state.focusAreas.length > 5) {
          state.focusAreas = state.focusAreas.slice(0, 5);
        }
      } else {
        state.focusAreas[existingFocusIndex].importance = Math.max(
          state.focusAreas[existingFocusIndex].importance,
          priority
        );
      }
    }

    await state.save();
    return state;
  }

  /**
   * Get recent thoughts from the companion state
   */
  async getRecentThoughts(
    userId: string,
    limit: number = 10,
    category?: ThoughtCategory
  ): Promise<IThought[]> {
    const state = await this.getOrCreateCompanionState(userId);

    let thoughts = state.recentThoughts;

    if (category) {
      thoughts = thoughts.filter((t) => t.category === category);
    }

    // Map thoughts to include content property for compatibility
    const mappedThoughts = thoughts.map((thought) => {
      // Check if thought is a Mongoose document or plain object
      const thoughtObj =
        typeof thought.toObject === "function" ? thought.toObject() : thought;

      return {
        ...thoughtObj,
        content: thought.thought, // Add content property that maps to 'thought'
      };
    });

    return mappedThoughts.slice(0, limit);
  }

  /**
   * Add or update a thought loop (recurring thought pattern)
   */
  async addThoughtLoop(
    userId: string,
    topic: string,
    relatedThoughts: string[],
    intensity: number = 1
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);

    // Check if this thought loop already exists by topic
    const existingIndex = state.thoughtLoops.findIndex(
      (tl) => tl.topic === topic
    );

    if (existingIndex >= 0) {
      // Update existing thought loop
      state.thoughtLoops[existingIndex].intensity = intensity;
      state.thoughtLoops[existingIndex].thoughts = [
        ...state.thoughtLoops[existingIndex].thoughts,
        ...relatedThoughts,
      ].slice(-20);
      state.thoughtLoops[existingIndex].lastDetected = new Date();
      state.thoughtLoops[existingIndex].resolved = false;
      state.thoughtLoops[existingIndex].resolution = undefined;
    } else {
      // Add new thought loop - adjust properties to match model
      state.thoughtLoops.push({
        topic,
        thoughts: relatedThoughts.slice(-20),
        intensity,
        firstDetected: new Date(),
        lastDetected: new Date(),
        resolved: false,
      });

      // Keep only most recent/relevant thought loops
      if (state.thoughtLoops.length > 10) {
        // Sort by intensity and recency of last detection
        state.thoughtLoops.sort((a, b) => {
          // Simplified score: prioritize higher intensity and more recent detection
          const scoreA =
            a.intensity * 0.6 +
            (a.lastDetected.getTime() / (Date.now() + 1)) * 0.4;
          const scoreB =
            b.intensity * 0.6 +
            (b.lastDetected.getTime() / (Date.now() + 1)) * 0.4;
          return scoreB - scoreA;
        });

        // Keep top 10
        state.thoughtLoops = state.thoughtLoops.slice(0, 10);
      }
    }

    await state.save();
    return state;
  }

  /**
   * Set current goals for the companion
   */
  async setGoals(
    userId: string,
    goalsInput: Array<{ goal: string; priority: number; progress?: number }>
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);

    state.currentGoals = goalsInput
      .map((g) => ({
        goal: g.goal,
        priority: g.priority,
        progress: g.progress ?? 0,
        createdAt: new Date(),
      }))
      .sort((a, b) => b.priority - a.priority);

    state.lastInteractionAt = new Date();

    await state.save();
    return state;
  }

  /**
   * Set user-defined goals for the companion
   */
  async setUserDefinedGoals(
    userId: string,
    goalsInput: Array<{ goal: string; priority: number }>
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);

    state.userDefinedGoals = goalsInput
      .map((g) => ({
        goal: g.goal,
        priority: g.priority,
        createdAt: new Date(),
        progress: 0,
      }))
      .sort((a, b) => b.priority - a.priority);

    state.lastInteractionAt = new Date();

    await state.save();
    return state;
  }

  /**
   * Archive thoughts older than a certain threshold to long-term memory
   */
  private async archiveOldThoughts(): Promise<void> {
    try {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - 7); // Older than 7 days

      const allStates = await CompanionState.find({}).exec();

      for (const state of allStates) {
        // Find thoughts older than threshold
        const oldThoughts = state.recentThoughts.filter(
          (thought) => thought.timestamp < threshold
        );

        if (oldThoughts.length === 0) continue;

        // Archive important thoughts to memory
        for (const thought of oldThoughts.filter((t) => t.priority >= 3)) {
          await this.memoryService.addMemory(
            state.userId,
            `Thought: ${thought.thought}`,
            MemoryType.MEDIUM_TERM,
            "companion-state-archive",
            {
              category: thought.category,
              priority: thought.priority,
              archivedFrom: "companion-thoughts",
              originalTimestamp: thought.timestamp,
            },
            thought.priority,
            MemoryCategory.CUSTOM
          );
        }

        // Remove archived thoughts from state
        state.recentThoughts = state.recentThoughts.filter(
          (thought) => thought.timestamp >= threshold
        );

        await state.save();
        console.log(
          `Archived ${oldThoughts.length} thoughts for user ${state.userId}`
        );
      }
    } catch (error) {
      console.error("Error archiving old thoughts:", error);
    }
  }

  /**
   * Get user's current focus areas
   */
  async getFocusAreas(
    userId: string
  ): Promise<Array<{ topic: string; importance: number; since: Date }>> {
    const state = await this.getOrCreateCompanionState(userId);
    return state.focusAreas;
  }

  /**
   * Update metadata for companion state
   */
  async updateMetadata(
    userId: string,
    metadata: Record<string, any>
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);

    state.metadata = {
      ...state.metadata,
      ...metadata,
    };

    state.lastInteractionAt = new Date();
    await state.save();

    return state;
  }

  /**
   * Get AI interests from metadata.
   */
  async getAIInterests(userId: string): Promise<any[]> {
    const state = await this.getOrCreateCompanionState(userId);
    return state.metadata?.aiInterests || DEFAULT_AI_INTERESTS;
  }

  /**
   * Update AI interests in metadata.
   */
  async updateAIInterests(
    userId: string,
    interests: any[]
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);
    if (!state.metadata) state.metadata = {};
    state.metadata.aiInterests = interests;
    state.markModified("metadata"); // Important for Mixed types
    await state.save();
    return state;
  }

  /**
   * Get AI internal goals from metadata.
   */
  async getAIInternalGoals(userId: string): Promise<any[]> {
    const state = await this.getOrCreateCompanionState(userId);
    return state.metadata?.aiInternalGoals || DEFAULT_AI_GOALS;
  }

  /**
   * Update AI internal goals in metadata.
   */
  async updateAIInternalGoals(
    userId: string,
    goals: any[]
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);
    if (!state.metadata) state.metadata = {};
    state.metadata.aiInternalGoals = goals;
    state.markModified("metadata"); // Important for Mixed types
    await state.save();
    return state;
  }

  /**
   * Update user's stated desires or expectations about what they want from the companion
   */
  async updateUserStatedDesires(
    userId: string,
    desireStatement: string
  ): Promise<ICompanionState> {
    const state = await this.getOrCreateCompanionState(userId);
    if (!state.metadata) state.metadata = {};

    // Store the new desire statement
    state.metadata.userStatedDesires = desireStatement;

    // Record it as a high-priority thought as well
    await this.addThought(
      userId,
      `User stated desire: ${desireStatement}`,
      "observation",
      6, // High priority
      { isUserStatedDesire: true }
    );

    // Mark as modified to ensure proper saving of the mixed type
    state.markModified("metadata");
    await state.save();

    return state;
  }

  /**
   * Get user's stated desires about the companion
   */
  async getUserStatedDesires(userId: string): Promise<string | null> {
    const state = await this.getOrCreateCompanionState(userId);
    return state.metadata?.userStatedDesires || null;
  }
}

// Singleton instance
export const companionStateService = new CompanionStateService();
