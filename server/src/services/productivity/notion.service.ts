import axios from "axios";
import { userStateService } from "../user-state.service";

interface NotionCredentials {
  accessToken: string;
  workspaceId?: string;
  pageId?: string;
}

interface NotionPage {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, any>;
}

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, any>;
}

interface NotionTodo {
  id: string;
  title: string;
  status: "Not Started" | "In Progress" | "Completed";
  dueDate?: string;
  priority?: "Low" | "Medium" | "High";
  tags?: string[];
  url: string;
}

interface NotionGoal {
  id: string;
  title: string;
  description?: string;
  status: "Not Started" | "In Progress" | "Completed";
  dueDate?: string;
  progress?: number; // 0-100
  url: string;
}

/**
 * Service for integrating with Notion for productivity features
 */
class NotionService {
  private credentials: Map<string, NotionCredentials> = new Map();
  private API_BASE_URL =
    process.env.NOTION_API_BASE_URL || "https://api.notion.com/v1";

  /**
   * Store a user's Notion credentials
   */
  setCredentials(userId: string, credentials: NotionCredentials): void {
    this.credentials.set(userId, credentials);
  }

  /**
   * Get a user's Notion credentials from in-memory cache or database
   */
  async getCredentials(userId: string): Promise<NotionCredentials | undefined> {
    // First check in-memory cache
    if (this.credentials.has(userId)) {
      return this.credentials.get(userId);
    }

    try {
      // Try to use the dedicated method from userStateService
      const storedCredentials =
        await userStateService.getNotionCredentials(userId);

      if (storedCredentials?.token) {
        const credentials: NotionCredentials = {
          accessToken: storedCredentials.token || "",
          pageId: storedCredentials.pageId,
        };

        // Cache the credentials for future use
        this.credentials.set(userId, credentials);
        return credentials;
      }
    } catch (error) {
      console.error("Error fetching user Notion credentials:", error);
    }

    // Fallback to environment variables
    const fallbackCredentials = {
      accessToken: process.env.NOTION_ACCESS_TOKEN || "",
      pageId: process.env.NOTION_PAGE_ID,
      workspaceId: process.env.NOTION_WORKSPACE_ID,
    };

    // Only return fallback if accessToken exists
    return fallbackCredentials.accessToken ? fallbackCredentials : undefined;
  }

  /**
   * Remove a user's Notion credentials
   */
  removeCredentials(userId: string): boolean {
    return this.credentials.delete(userId);
  }

  /**
   * Check if a user has connected Notion
   */
  async isConnected(userId: string): Promise<boolean> {
    // Check in-memory cache first
    if (this.credentials.has(userId)) {
      return true;
    }

    try {
      // Then check database
      const credentials = await this.getCredentials(userId);
      return !!credentials?.accessToken;
    } catch {
      return false;
    }
  }

  /**
   * Get headers for Notion API requests
   */
  private async getHeaders(userId: string): Promise<Record<string, string>> {
    const credentials = await this.getCredentials(userId);
    if (!credentials?.accessToken) {
      throw new Error("Notion credentials not found");
    }

    return {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };
  }

  /**
   * Search for databases in the user's Notion workspace
   */
  async searchDatabases(
    userId: string,
    query?: string
  ): Promise<NotionDatabase[]> {
    try {
      const response = await axios.post(
        `${this.API_BASE_URL}/search`,
        {
          query,
          filter: { property: "object", value: "database" },
        },
        { headers: await this.getHeaders(userId) }
      );

      return response.data.results.map((db: any) => ({
        id: db.id,
        title: db.title[0]?.plain_text || "Untitled",
        url: db.url,
        properties: db.properties,
      }));
    } catch (error) {
      console.error("Error searching Notion databases:", error);
      throw new Error(
        `Failed to search Notion databases: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get todos from a Notion database
   */
  async getTodos(userId: string, databaseId: string): Promise<NotionTodo[]> {
    try {
      const response = await axios.post(
        `${this.API_BASE_URL}/databases/${databaseId}/query`,
        {},
        { headers: await this.getHeaders(userId) }
      );

      return response.data.results.map((page: any) => {
        const properties = page.properties;

        return {
          id: page.id,
          title: properties.Name?.title[0]?.plain_text || "Untitled",
          status: properties.Status?.select?.name || "Not Started",
          dueDate: properties["Due Date"]?.date?.start,
          priority: properties.Priority?.select?.name,
          tags:
            properties.Tags?.multi_select?.map((tag: any) => tag.name) || [],
          url: page.url,
        };
      });
    } catch (error) {
      console.error("Error getting Notion todos:", error);
      throw new Error(
        `Failed to get Notion todos: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create a new todo in Notion
   */
  async createTodo(
    userId: string,
    databaseId: string,
    todo: {
      title: string;
      status?: string;
      dueDate?: string;
      priority?: string;
      tags?: string[];
    }
  ): Promise<NotionTodo> {
    try {
      const properties: Record<string, any> = {
        Name: {
          title: [{ text: { content: todo.title } }],
        },
      };

      if (todo.status) {
        properties.Status = {
          select: { name: todo.status },
        };
      }

      if (todo.dueDate) {
        properties["Due Date"] = {
          date: { start: todo.dueDate },
        };
      }

      if (todo.priority) {
        properties.Priority = {
          select: { name: todo.priority },
        };
      }

      if (todo.tags && todo.tags.length > 0) {
        properties.Tags = {
          multi_select: todo.tags.map((tag) => ({ name: tag })),
        };
      }

      const response = await axios.post(
        `${this.API_BASE_URL}/pages`,
        {
          parent: { database_id: databaseId },
          properties,
        },
        { headers: await this.getHeaders(userId) }
      );

      const page = response.data;

      return {
        id: page.id,
        title: todo.title,
        status: (todo.status as any) || "Not Started",
        dueDate: todo.dueDate,
        priority: todo.priority as any,
        tags: todo.tags,
        url: page.url,
      };
    } catch (error) {
      console.error("Error creating Notion todo:", error);
      throw new Error(
        `Failed to create Notion todo: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update a todo in Notion
   */
  async updateTodo(
    userId: string,
    todoId: string,
    updates: {
      title?: string;
      status?: string;
      dueDate?: string;
      priority?: string;
      tags?: string[];
    }
  ): Promise<NotionTodo> {
    try {
      const properties: Record<string, any> = {};

      if (updates.title) {
        properties.Name = {
          title: [{ text: { content: updates.title } }],
        };
      }

      if (updates.status) {
        properties.Status = {
          select: { name: updates.status },
        };
      }

      if (updates.dueDate) {
        properties["Due Date"] = {
          date: { start: updates.dueDate },
        };
      }

      if (updates.priority) {
        properties.Priority = {
          select: { name: updates.priority },
        };
      }

      if (updates.tags) {
        properties.Tags = {
          multi_select: updates.tags.map((tag) => ({ name: tag })),
        };
      }

      const response = await axios.patch(
        `${this.API_BASE_URL}/pages/${todoId}`,
        { properties },
        { headers: await this.getHeaders(userId) }
      );

      const page = response.data;
      const pageProperties = page.properties;

      return {
        id: page.id,
        title: pageProperties.Name?.title[0]?.plain_text || "Untitled",
        status: pageProperties.Status?.select?.name || "Not Started",
        dueDate: pageProperties["Due Date"]?.date?.start,
        priority: pageProperties.Priority?.select?.name,
        tags:
          pageProperties.Tags?.multi_select?.map((tag: any) => tag.name) || [],
        url: page.url,
      };
    } catch (error) {
      console.error("Error updating Notion todo:", error);
      throw new Error(
        `Failed to update Notion todo: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create a new note in Notion
   */
  async createNote(
    userId: string,
    title: string,
    content: string,
    pageId?: string
  ): Promise<{ id: string; url: string }> {
    try {
      // Get user credentials
      const credentials = await this.getCredentials(userId);

      // Use provided pageId or fall back to user's default pageId from credentials
      const targetPageId =
        pageId || credentials?.pageId || process.env.NOTION_PAGE_ID;

      if (!targetPageId) {
        throw new Error("No Notion page ID provided or found in user settings");
      }

      const response = await axios.post(
        `${this.API_BASE_URL}/pages`,
        {
          parent: {
            type: "page_id",
            page_id: targetPageId,
          },
          properties: {
            title: {
              title: [{ text: { content: title } }],
            },
          },
          children: [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content } }],
              },
            },
          ],
        },
        { headers: await this.getHeaders(userId) }
      );

      return {
        id: response.data.id,
        url: response.data.url,
      };
    } catch (error) {
      console.error("Error creating Notion note:", error);
      throw new Error(
        `Failed to create Notion note: ${(error as Error).message}`
      );
    }
  }

  /**
   * Extract todos from a conversation and add them to Notion
   */
  async extractAndCreateTodos(
    userId: string,
    databaseId: string,
    conversationText: string
  ): Promise<NotionTodo[]> {
    // This would use AI to extract todos from conversation
    // For now, we'll use a simple regex approach to find lines that look like todos

    const todoRegex =
      /(?:todo|task|to-do|to do):?\s*(.+?)(?:\s*\(([^)]+)\))?$/gim;
    const todos: NotionTodo[] = [];

    let match;
    while ((match = todoRegex.exec(conversationText)) !== null) {
      const todoTitle = match[1].trim();
      const todoMeta = match[2]?.trim();

      let priority: string | undefined;
      let dueDate: string | undefined;

      // Try to extract priority and due date from meta
      if (todoMeta) {
        if (/high|urgent|important/i.test(todoMeta)) {
          priority = "High";
        } else if (/medium/i.test(todoMeta)) {
          priority = "Medium";
        } else if (/low/i.test(todoMeta)) {
          priority = "Low";
        }

        // Try to extract date in format YYYY-MM-DD
        const dateMatch = todoMeta.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          dueDate = dateMatch[0];
        }
      }

      try {
        const todo = await this.createTodo(userId, databaseId, {
          title: todoTitle,
          status: "Not Started",
          priority,
          dueDate,
        });

        todos.push(todo);
      } catch (error) {
        console.error(`Error creating todo "${todoTitle}":`, error);
      }
    }

    return todos;
  }
}

// Create a singleton instance
export const notionService = new NotionService();
