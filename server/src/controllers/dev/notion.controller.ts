import express, { Request, Response } from "express";import { authMiddleware } from "../../middlewares/auth.middleware";
import { loggerFactory } from "../../utils/logger.service";
import { userStateService } from "../../services/user-state.service";
import { notionService } from "../../services/productivity/notion.service";
import axios from "axios";

const logger = loggerFactory.getLogger("NotionController");
const router = express.Router();

// Apply auth middleware to all notion routes
router.use(authMiddleware);

/**
 * Save user's Notion integration settings
 * PUT /api/notion/settings
 */
router.put("/settings", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = req.user.id;
  const { token, pageId, enabled = true } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Notion API token is required" });
  }

  try {
    let workspaceInfo = null;

    // Try to get workspace info for metadata
    try {
      const response = await axios.get("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      });

      workspaceInfo = {
        workspaceName: response.data.workspace_name || "Notion Workspace",
        userId: response.data.id,
      };

      // Also update the in-memory cache in notionService
      notionService.setCredentials(userId, {
        accessToken: token,
        pageId: pageId,
        workspaceId: response.data.id,
      });
    } catch (error) {
      logger.error("Error fetching Notion workspace info:", error);
      // Continue even if this fails
    }

    // Save credentials using the user state service
    const notionIntegration = await userStateService.saveNotionCredentials(
      userId,
      {
        token,
        pageId,
        enabled,
      }
    );

    // If we have workspace info, update the metadata
    if (workspaceInfo && notionIntegration) {
      // Find integration index again
      const userState = await userStateService.getOrCreateUserState(userId);
      const integrationIndex = userState.integrations.findIndex(
        (i) => i.platform === "notion"
      );

      if (integrationIndex >= 0) {
        userState.integrations[integrationIndex].metadata = workspaceInfo;
        await userState.save();
      }
    }

    return res.json({
      success: true,
      message: "Notion integration settings saved successfully",
      integration: {
        platform: "notion",
        enabled,
        lastSync: new Date(),
        metadata: workspaceInfo || {},
      },
    });
  } catch (error) {
    logger.error("Error saving Notion integration settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save Notion integration settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get user's Notion integration settings
 * GET /api/notion/settings
 */
router.get("/settings", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = req.user.id;

  try {
    // Use the dedicated method to get Notion credentials
    const credentials = await userStateService.getNotionCredentials(userId);

    if (!credentials) {
      return res.json({
        success: true,
        message: "Notion integration not set up yet",
        configured: false,
      });
    }

    // Get the full integration object for metadata
    const userState = await userStateService.getOrCreateUserState(userId);
    const notionIntegration = userState.integrations.find(
      (i) => i.platform === "notion"
    );

    return res.json({
      success: true,
      configured: true,
      integration: {
        platform: "notion",
        enabled: credentials.enabled,
        lastSync: notionIntegration?.lastSync,
        metadata: notionIntegration?.metadata || {},
        // Don't send sensitive credentials back
        hasPageId: !!credentials.pageId,
      },
    });
  } catch (error) {
    logger.error("Error retrieving Notion integration settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve Notion integration settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Test a Notion connection with provided credentials
 * POST /api/notion/test-connection
 */
router.post("/test-connection", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { token, pageId } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Notion API token is required",
    });
  }

  try {
    // Test the token by making a request to Notion API
    const response = await axios.get("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28", // Use the latest version
      },
    });

    // Get the workspace name for the user
    const workspaceName = response.data.workspace_name || "Notion Workspace";

    // If pageId is provided, attempt to verify it
    if (pageId) {
      try {
        await axios.get(`https://api.notion.com/v1/pages/${pageId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
          },
        });

        // Page is valid, return success
        return res.json({
          success: true,
          message: "Connection successful. Page access confirmed.",
          workspaceName,
        });
      } catch (pageError) {
        // Page access failed
        return res.json({
          success: false,
          message: "Token valid but could not access the specified page ID.",
          workspaceName,
        });
      }
    }

    // No pageId, just return success for the token
    return res.json({
      success: true,
      message: "Connection to Notion successful! Page ID not verified.",
      workspaceName,
    });
  } catch (error: any) {
    logger.error("Notion test connection failed:", error);

    let message = "Failed to connect to Notion.";

    // Handle specific API error responses
    if (error.response) {
      if (error.response.status === 401) {
        message = "Invalid Notion API token. Please check your credentials.";
      } else if (error.response.status === 403) {
        message =
          "Access denied. Your token doesn't have the required permissions.";
      } else if (error.response.status === 404) {
        message = "Resource not found. Please check the provided page ID.";
      } else {
        message = `Notion API error: ${error.response.status} - ${error.response.data?.message || "Unknown error"}`;
      }
    } else if (error.request) {
      message =
        "Could not reach Notion API. Please check your network connection.";
    }

    return res.status(200).json({
      success: false,
      message,
    });
  }
});

/**
 * Basic pages listing
 * POST /api/notion/pages
 */
router.post("/pages", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Notion API token is required" });
  }

  try {
    // Get a list of pages using Notion's search API
    const response = await axios.post(
      "https://api.notion.com/v1/search",
      {
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 10, // Limit to 10 for demo purposes
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );

    // Format the results
    const pages = response.data.results.map((page: any) => ({
      id: page.id,
      title:
        page.properties?.title?.title?.[0]?.plain_text ||
        page.properties?.Name?.title?.[0]?.plain_text ||
        "Untitled",
      url: page.url,
    }));

    return res.json(pages);
  } catch (error: any) {
    logger.error("Notion pages fetch failed:", error);

    return res.status(400).json({
      message: "Failed to fetch Notion pages",
      error: error.message,
    });
  }
});

/**
 * Get user's connected pages (using stored credentials)
 * GET /api/notion/user-pages
 */
router.get("/user-pages", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = req.user.id;

  try {
    // Get user's Notion credentials
    const credentials = await notionService.getCredentials(userId);

    if (!credentials?.accessToken) {
      return res.status(400).json({
        success: false,
        message: "Notion not connected. Please set up your Notion integration.",
      });
    }

    // Get a list of pages using Notion's search API
    const response = await axios.post(
      "https://api.notion.com/v1/search",
      {
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 10, // Limit to 10 for simplicity
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );

    // Format the results
    const pages = response.data.results.map((page: any) => ({
      id: page.id,
      title:
        page.properties?.title?.title?.[0]?.plain_text ||
        page.properties?.Name?.title?.[0]?.plain_text ||
        "Untitled",
      url: page.url,
    }));

    return res.json({
      success: true,
      pages,
    });
  } catch (error: any) {
    logger.error("User Notion pages fetch failed:", error);

    return res.status(400).json({
      success: false,
      message: "Failed to fetch your Notion pages",
      error: error.message,
    });
  }
});

/**
 * Search Notion content
 * POST /api/notion/search
 */
router.post("/search", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Get the user's Notion integration from their user state
  // This would require accessing the user's saved integration
  // As a placeholder, we'll just return an error

  return res.status(501).json({
    message:
      "Search functionality coming soon. For now, please configure your Notion integration in Settings.",
  });
});

export default router;
