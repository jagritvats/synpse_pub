import type { ObjectId } from "mongodb";

export interface User {
  id: string;
  name: string;
  email: string;
  subscription: "FREE" | "PREMIUM";
  verified: boolean;
}

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  subscription: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AITimelineEvent {
  id: string;
  type: "thought" | "action";
  content: string;
  timestamp: Date;
  relatedThoughtId?: string;
}

export interface UserSettings {
  userId: string | ObjectId;
  interests?: string[];
  globalPrompt?: string;
  integrations?: {
    notion?: {
      token: string;
      pageId: string;
    };
    twitter?: {
      token: string;
    };
    // Add more integrations as needed
  };
}

export interface MongoUser {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  verified: boolean;
  verificationCode?: string | null;
  verificationExpires?: Date | null;
  subscription: "FREE" | "PREMIUM";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
