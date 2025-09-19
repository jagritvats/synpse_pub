import { IIntegration } from "@/../server/src/models/user-state.model";
import { apiClient } from "./api-client";

// Base API URL
const API_BASE = "/api";

// Fetch all user integrations
export async function fetchUserIntegrations(): Promise<IIntegration[]> {
  try {
    return await apiClient<IIntegration[]>("/user-state/integrations", {
      targetBackend: "express",
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch integrations");
  }
}

// Update user integrations
export async function updateUserIntegrations(
  integrations: IIntegration[]
): Promise<IIntegration[]> {
  try {
    return await apiClient<IIntegration[]>("/user-state/integrations", {
      method: "PUT",
      targetBackend: "express",
      body: { integrations },
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to update integrations");
  }
}

// Fetch specific integration details
export async function fetchIntegration(
  platform: string
): Promise<IIntegration | null> {
  try {
    return await apiClient<IIntegration>(
      `/user-state/integration/${platform}`,
      {
        targetBackend: "express",
      }
    );
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw new Error(error.message || `Failed to fetch ${platform} integration`);
  }
}

// Update specific integration
export async function updateIntegration(
  platform: string,
  data: Partial<IIntegration>
): Promise<IIntegration> {
  try {
    return await apiClient<IIntegration>(
      `/user-state/integration/${platform}`,
      {
        method: "PUT",
        targetBackend: "express",
        body: data,
      }
    );
  } catch (error: any) {
    throw new Error(
      error.message || `Failed to update ${platform} integration`
    );
  }
}

// Notion specific APIs
export interface NotionCredentials {
  token: string;
  pageId?: string;
}

export interface NotionTestResponse {
  success: boolean;
  message: string;
  workspaceName?: string;
  pages?: NotionPage[];
}

export interface NotionPage {
  id: string;
  title: string;
  icon?: string;
  url?: string;
  parent_id?: string;
  created_time?: string;
  last_edited_time?: string;
}

// Test Notion connection
export async function testNotionConnection(
  credentials: NotionCredentials
): Promise<NotionTestResponse> {
  try {
    return await apiClient<NotionTestResponse>("/notion/test-connection", {
      method: "POST",
      targetBackend: "express",
      body: credentials,
    });
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to connect to Notion",
    };
  }
}

// Get Notion pages
export async function getNotionPages(
  credentials: NotionCredentials
): Promise<NotionPage[]> {
  try {
    return await apiClient<NotionPage[]>("/notion/pages", {
      method: "POST",
      targetBackend: "express",
      body: credentials,
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch Notion pages");
  }
}

// Get user's Notion settings
export async function getNotionSettings(): Promise<{
  success: boolean;
  configured: boolean;
  integration?: {
    platform: string;
    enabled: boolean;
    lastSync: string;
    metadata: Record<string, any>;
    hasPageId: boolean;
  };
  message?: string;
}> {
  try {
    return await apiClient("/notion/settings", {
      targetBackend: "express",
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch Notion settings");
  }
}

// Update user's Notion settings
export async function updateNotionSettings(
  settings: NotionCredentials & { enabled?: boolean }
): Promise<{
  success: boolean;
  message: string;
  integration?: {
    platform: string;
    enabled: boolean;
    lastSync: string;
    metadata: Record<string, any>;
  };
}> {
  try {
    return await apiClient("/notion/settings", {
      method: "PUT",
      targetBackend: "express",
      body: {
        token: settings.token,
        pageId: settings.pageId,
        enabled: settings.enabled !== false, // Default to true if not specified
      },
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to update Notion settings");
  }
}

// Get user's connected Notion pages
export async function getUserNotionPages(): Promise<{
  success: boolean;
  pages?: NotionPage[];
  message?: string;
}> {
  try {
    return await apiClient("/notion/user-pages", {
      targetBackend: "express",
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch your Notion pages");
  }
}
