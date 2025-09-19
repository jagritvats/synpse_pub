import { apiClient } from "./api-client";
import {
  IUserState,
  IUserInterest,
  IIntegration,
  IUserGoal,
} from "@/../server/src/models/user-state.model"; // Adjust path if needed
import { IGoal } from "@/../server/src/models/companion-state.model"; // Adjust path if needed

// --- User State API ---
// These functions manage the user state including interests and integrations

/**
 * Fetches the entire user state object
 */
export const fetchUserState = async (): Promise<IUserState> => {
  return apiClient("/user-state", { targetBackend: "express" });
};

/**
 * Fetches just the user interests array
 */
export const fetchUserInterests = async (): Promise<IUserInterest[]> => {
  return apiClient("/user-state/interests", { targetBackend: "express" });
};

/**
 * Updates the user interests array
 */
export const updateUserInterests = async (
  interests: IUserInterest[]
): Promise<IUserInterest[]> => {
  try {
    console.log("Updating interests:", interests);

    // Validate that interests have the correct structure
    interests.forEach((interest) => {
      if (
        !interest.topic ||
        typeof interest.level !== "number" ||
        !interest.addedAt
      ) {
        console.error("Invalid interest structure:", interest);
        throw new Error(
          "Each interest must have topic, level, and addedAt properties"
        );
      }
    });

    const response = await apiClient("/user-state/interests", {
      method: "PUT",
      body: { interests },
      targetBackend: "express",
    });

    console.log("Interests update response:", response);
    return response;
  } catch (error) {
    console.error("Failed to update interests:", error);
    throw error;
  }
};

/**
 * Fetches the user integrations array
 */
export const fetchUserIntegrations = async (): Promise<IIntegration[]> => {
  return apiClient("/user-state/integrations", {
    targetBackend: "express",
  });
};

/**
 * Updates the user integrations array
 */
export const updateUserIntegrations = async (
  integrations: IIntegration[]
): Promise<IIntegration[]> => {
  return apiClient("/user-state/integrations", {
    method: "PUT",
    body: { integrations },
    targetBackend: "express",
  });
};

// --- Companion State API (for Settings) ---
// These functions manage the companion state including goals and interests

/**
 * Fetches user-defined goals
 */
export const fetchUserDefinedGoals = async (): Promise<IUserGoal[]> => {
  try {
    // Use the new user-state endpoint
    return await apiClient("/user-state/user-goals", {
      targetBackend: "express",
    });
  } catch (error) {
    console.warn(
      "Failed to fetch from /user-state/user-goals, trying fallback..."
    );
    try {
      // Fallback to the companion-state endpoint for backward compatibility
      return await apiClient("/companion-state/user-goals", {
        targetBackend: "express",
      });
    } catch (innerError) {
      console.error("All goals endpoints failed:", innerError);
      throw innerError;
    }
  }
};

/**
 * Updates user-defined goals
 */
export const updateUserDefinedGoals = async (
  goals: Partial<IUserGoal>[]
): Promise<IUserGoal[]> => {
  try {
    // Use the new user-state endpoint
    return await apiClient("/user-state/user-goals", {
      method: "PUT",
      body: { goals },
      targetBackend: "express",
    });
  } catch (error) {
    console.warn(
      "Failed to update via /user-state/user-goals, trying fallback..."
    );
    // Fallback to the companion-state endpoint for backward compatibility
    return await apiClient("/companion-state/user-goals", {
      method: "PUT",
      body: { goals },
      targetBackend: "express",
    });
  }
};

/**
 * Fetches AI's internal interests
 * These are read-only system-generated interests
 */
export const fetchAIInterests = async (): Promise<any[]> => {
  try {
    // This will continue using companion-state for now
    return await apiClient("/companion-state/ai/interests", {
      targetBackend: "express",
    });
  } catch (error) {
    console.warn(
      "Failed to fetch from /companion-state/ai/interests, trying fallback..."
    );
    try {
      // Fallback to user-state if we move this feature in the future
      return await apiClient("/user-state/ai-interests", {
        targetBackend: "express",
      });
    } catch (innerError) {
      console.error("All AI interests endpoints failed:", innerError);
      throw innerError;
    }
  }
};

/**
 * Updates AI's internal interests (admin or system use only)
 */
export const updateAIInterests = async (interests: any[]): Promise<any[]> => {
  try {
    // This will continue using companion-state for now
    return await apiClient("/companion-state/ai/interests", {
      method: "PUT",
      body: { interests },
      targetBackend: "express",
    });
  } catch (error) {
    console.warn(
      "Failed to update via /companion-state/ai/interests, trying fallback..."
    );
    try {
      // Fallback to user-state if we move this feature in the future
      return await apiClient("/user-state/ai-interests", {
        method: "PUT",
        body: { interests },
        targetBackend: "express",
      });
    } catch (innerError) {
      console.error("All AI interests update endpoints failed:", innerError);
      throw innerError;
    }
  }
};

/**
 * Fetches AI's internal goals
 * These are read-only system-generated goals
 */
export const fetchAIGoals = async (): Promise<any[]> => {
  return apiClient("/companion-state/ai/goals", {
    targetBackend: "express",
  });
};

/**
 * Updates AI's internal goals (admin or system use only)
 */
export const updateAIGoals = async (goals: any[]): Promise<any[]> => {
  return apiClient("/companion-state/ai/goals", {
    method: "PUT",
    body: { goals },
    targetBackend: "express",
  });
};

// --- User Global Prompt API ---
// These functions manage the user's global prompt for the AI

/**
 * Fetches the user's global prompt
 */
export const fetchGlobalPrompt = async (): Promise<{ prompt: string }> => {
  // GET /api/user-state/global-prompt
  return apiClient("/user-state/global-prompt", {
    targetBackend: "express",
  });
};

/**
 * Updates the user's global prompt
 */
export const updateGlobalPrompt = async (
  prompt: string
): Promise<{ prompt: string }> => {
  // PUT /api/user-state/global-prompt
  return apiClient("/user-state/global-prompt", {
    method: "PUT",
    body: { prompt },
    targetBackend: "express",
  });
};

// --- AI Timeline API ---
// These functions manage the AI timeline events

/**
 * Fetches timeline events with an optional limit
 */
export const fetchTimelineEvents = async (
  limit: number = 50
): Promise<any[]> => {
  return apiClient(`/timeline?limit=${limit}`, {
    targetBackend: "express",
  });
};

// --- User Profile API ---
// These functions manage the user profile

/**
 * Interface for user profile data
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferences?: Record<string, any>;
  interests?: string[];
  socialConnections?: Array<{
    platform: string;
    username: string;
    connected: boolean;
    lastSynced?: string;
  }>;
}

/**
 * Fetches the user profile
 */
export const fetchUserProfile = async (): Promise<UserProfile> => {
  return apiClient("/users/profile", {
    targetBackend: "express",
  });
};

/**
 * Updates the user profile
 */
export const updateUserProfile = async (
  profileData: Partial<UserProfile>
): Promise<UserProfile> => {
  return apiClient("/users/profile", {
    method: "PUT",
    body: profileData,
    targetBackend: "express",
  });
};
