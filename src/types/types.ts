export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "ERROR";

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  clientTempId?: string; // For matching SSE updates with client-generated messages
  metadata?: {
    activityId?: string;
    activityType?: string;
    activityName?: string;
    error?: boolean;
    errorMessage?: string;
    // Action execution fields
    actionExecuted?: boolean;
    actionId?: string;
    actionName?: string;
    actionSuccess?: boolean;
    actionMessage?: string;
    [key: string]: any;
  };
  isDeleted?: boolean; // Flag to mark the message as deleted
}

export type SessionStatus = "active" | "archived" | "favorite";

export type Thread = {
  id: string;
  title: string;
  sessionId: string;
  userId: string;
  status: SessionStatus;
  lastActive: Date;
  messages: Message[];
  metadata?: Record<string, any>;
};

export type Mood = {
  emoji: string;
  description: string;
};

// Import the new API client
import { apiClient } from "@/lib/api-client";

// --- API Definitions using apiClient --- G

export const chatApi = {
  // Fetches all threads (sessions) for the current user
  fetchThreads: async (): Promise<Thread[]> => {
    try {
      // Endpoint assumes the base URL includes /api
      // The backend needs to handle routing /chat/sessions
      const sessions: any[] = await apiClient("/chat/sessions");

      // Map backend sessions to frontend Threads
      const threads = sessions.map((session: any) => ({
        id: session._id,
        sessionId: session._id, // Use _id as sessionId for consistency
        title:
          session.metadata?.title || `Session ${session._id.substring(0, 5)}`,
        userId: session.userId,
        status: session.metadata?.status || "active",
        lastActive: new Date(session.updatedAt || session.createdAt),
        messages: [], // Messages fetched separately
        metadata: session.metadata,
      }));
      return threads;
    } catch (error) {
      console.error("Failed to fetch threads:", error);
      // Return empty array or handle error as appropriate
      return [];
    }
  },

  // Creates a new thread (session)
  createThread: async (title: string): Promise<Thread | null> => {
    try {
      const newSession: any = await apiClient("/chat/sessions", {
        method: "POST",
        body: {
          metadata: {
            title: title,
            status: "active",
          },
        },
      });

      return {
        id: newSession._id,
        sessionId: newSession._id,
        title: newSession.metadata?.title || title,
        userId: newSession.userId,
        status: newSession.metadata?.status || "active",
        lastActive: new Date(newSession.updatedAt || newSession.createdAt),
        messages: [],
        metadata: newSession.metadata,
      };
    } catch (error) {
      console.error("Failed to create thread:", error);
      return null;
    }
  },

  // Fetches messages for a specific thread (session)
  fetchMessages: async (sessionId: string): Promise<Message[]> => {
    const backendSessionId = sessionId;
    try {
      const messages: any[] = await apiClient(
        `/chat/${backendSessionId}/messages`
      );

      return messages.map((msg) => ({
        id: msg._id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.timestamp),
        sessionId: msg.sessionId,
        status: msg.status,
        metadata: msg.metadata,
      }));
    } catch (error: any) {
      // Handle 404 specifically
      if (error.status === 404) {
        console.warn(
          `Session ${backendSessionId} not found, returning empty messages.`
        );
        return [];
      }
      console.error(
        `Failed to fetch messages for session ${backendSessionId}:`,
        error
      );
      return [];
    }
  },

  // Sends a message to a specific thread (session)
  sendMessage: async (
    sessionId: string,
    messageContent: string,
    clientTempId: string
  ): Promise<void> => {
    const backendSessionId = sessionId;
    try {
      await apiClient(`/chat/${backendSessionId}/message`, {
        method: "POST",
        body: {
          message: messageContent,
          clientTempId: clientTempId,
        },
      });
    } catch (error) {
      console.error(
        `Failed to send message to session ${backendSessionId}:`,
        error
      );
      throw error; // Re-throw for UI handling
    }
  },

  // Update session status (e.g., favorite, archive)
  updateSessionStatus: async (
    sessionId: string,
    status: SessionStatus
  ): Promise<boolean> => {
    const backendSessionId = sessionId;
    console.log(`Updating status for session ${backendSessionId} to ${status}`);
    try {
      await apiClient(`/chat/sessions/${backendSessionId}/status`, {
        method: "PATCH",
        body: { status: status },
      });
      console.log(`Session ${backendSessionId} status updated successfully.`);
      return true;
    } catch (error: any) {
      console.error(
        `Error updating status for session ${backendSessionId}:`,
        error
      );
      return false;
    }
  },

  // Soft delete a message
  deleteMessage: async (
    sessionId: string,
    messageId: string
  ): Promise<boolean> => {
    try {
      await apiClient(`/chat/${sessionId}/messages/${messageId}`, {
        method: "DELETE",
      });
      console.log(`Message ${messageId} deleted successfully.`);
      return true;
    } catch (error: any) {
      console.error(`Error deleting message ${messageId}:`, error);
      return false;
    }
  },

  // Restore a soft-deleted message
  restoreMessage: async (
    sessionId: string,
    messageId: string
  ): Promise<boolean> => {
    try {
      await apiClient(`/chat/${sessionId}/messages/${messageId}/restore`, {
        method: "PATCH",
      });
      console.log(`Message ${messageId} restored successfully.`);
      return true;
    } catch (error: any) {
      console.error(`Error restoring message ${messageId}:`, error);
      return false;
    }
  },

  // Fetch action logs for a message
  getActionLogsForMessage: async (messageId: string): Promise<any[]> => {
    try {
      const response = await apiClient(`/action-logs/message/${messageId}`);
      return response.actionLogs || [];
    } catch (error) {
      console.error(
        `Error fetching action logs for message ${messageId}:`,
        error
      );
      return [];
    }
  },

  // Fetch action logs for a session
  getActionLogsForSession: async (sessionId: string): Promise<any[]> => {
    try {
      const response = await apiClient(`/action-logs/session/${sessionId}`);
      return response.actionLogs || [];
    } catch (error) {
      console.error(
        `Error fetching action logs for session ${sessionId}:`,
        error
      );
      return [];
    }
  },

  // --- SSE Listener Setup --- G
  // Note: EventSource doesn't easily support custom headers like Authorization.
  // We'll need to pass the token via query parameter, requiring backend adjustment.
  listenToSessionEvents: (
    sessionId: string,
    onMessage: (message: Message) => void,
    onStatusUpdate: (update: any) => void,
    onTyping: (typing: any) => void,
    onActivityUpdate?: (activityUpdate: any) => void
  ) => {
    const backendSessionId = sessionId;
    console.log(`Setting up SSE listener for session: ${backendSessionId}`);

    let connectionFailed = false;
    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      // Clear any existing reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const token = localStorage.getItem("authToken");

      // Only proceed if a valid token exists
      if (!token) {
        console.warn(
          `SSE Connection Aborted: No auth token found for session ${backendSessionId}. User needs to log in.`
        );
        return; // Don't attempt to connect without a token
      }

      const backendBaseUrl =
        process.env.NEXT_PUBLIC_EXPRESS_API_BASE_URL ||
        "http://localhost:5000/api";

      // Keep the token in query params for backward compatibility
      const url = `${backendBaseUrl}/chat/${backendSessionId}/events?token=${encodeURIComponent(
        token
      )}`;

      if (eventSource) {
        // Close any existing connection before creating a new one
        try {
          eventSource.close();
        } catch (err) {
          console.warn("Error closing previous EventSource:", err);
        }
      }

      try {
        console.log("SSE Connecting to:", url);

        // Create EventSource with additional headers using fetch for initial request
        const eventSourceInit = {
          headers: {
            Authorization: `Bearer ${token}`, // Add authorization header for middleware
          },
        };
        // @ts-ignore - EventSource constructor with options is not in the standard type definitions
        eventSource = new EventSource(url, eventSourceInit);

        // Handle successful connection
        eventSource.onopen = () => {
          console.log(
            "SSE connection established for session:",
            backendSessionId
          );
          connectionFailed = false; // Reset failure flag on successful connection
          reconnectAttempts = 0; // Reset reconnect attempts counter
        };

        // Handle special 'connected' event from our server
        eventSource.addEventListener("connected", (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("SSE initial connection confirmed:", data);
          } catch (e) {
            console.warn("Error parsing connected event:", event.data);
          }
        });

        // Handle special 'error' event from our server
        eventSource.addEventListener("error", (event) => {
          try {
            // Check if event.data exists before parsing
            if (event.data) {
              const data = JSON.parse(event.data);
              console.error("SSE server error:", data.error);

              // Show user-friendly error message
              if (data.error && !connectionFailed) {
                connectionFailed = true;
                onMessage({
                  id: `error-${Date.now()}`,
                  content: `⚠️ Connection error: ${data.error}`,
                  role: "assistant",
                  timestamp: new Date(),
                  sessionId: backendSessionId,
                  status: "ERROR",
                });
              }
            } else {
              console.error("SSE connection error without data");
            }
          } catch (e) {
            console.warn("Error parsing error event:", event.data || "No data");
          }
        });

        // Handle regular events
        eventSource.addEventListener("messageUpdate", (event) => {
          try {
            const messageData = JSON.parse(event.data);
            console.log("SSE messageUpdate:", messageData);
            const mappedMessage = {
              id: messageData.messageId,
              clientTempId: messageData.clientTempId,
              content: messageData.content,
              role: messageData.role,
              timestamp: new Date(messageData.timestamp),
              sessionId: messageData.sessionId,
              status: messageData.status,
              metadata: messageData.metadata,
            } as Message & { clientTempId?: string };
            onMessage(mappedMessage);
          } catch (e) {
            console.error("Error parsing messageUpdate event:", event.data, e);
          }
        });

        eventSource.addEventListener("statusUpdate", (event) => {
          try {
            const statusData = JSON.parse(event.data);
            console.log("SSE statusUpdate:", statusData);
            onStatusUpdate(statusData);
          } catch (e) {
            console.error("Error parsing statusUpdate event:", event.data, e);
          }
        });

        eventSource.addEventListener("typing", (event) => {
          try {
            const typingData = JSON.parse(event.data);
            console.log("SSE typing:", typingData);
            onTyping(typingData);
          } catch (e) {
            console.error("Error parsing typing event:", event.data, e);
          }
        });

        // Add handler for activity updates
        eventSource.addEventListener("activityUpdate", (event) => {
          try {
            const activityData = JSON.parse(event.data);
            console.log("SSE activityUpdate:", activityData);

            // Ensure activityData has expected properties
            const safeActivityData = {
              activityId: activityData?.activityId || null,
              isActive:
                activityData?.isActive !== undefined
                  ? activityData.isActive
                  : null,
              type: activityData?.type || null,
              name: activityData?.name || null,
              endTime: activityData?.endTime || null,
            };

            // If callback provided, send data to it
            if (onActivityUpdate) {
              onActivityUpdate(safeActivityData);
            }

            // Also dispatch a DOM event for components that need to react to activity changes
            const customEvent = new CustomEvent("sse:activityUpdate", {
              detail: safeActivityData,
            });
            document.querySelector("body")?.dispatchEvent(customEvent);
          } catch (e) {
            console.error("Error parsing activityUpdate event:", event.data, e);
          }
        });

        // Handle connection errors
        eventSource.onerror = (error) => {
          console.error(
            `SSE connection error for session ${backendSessionId}:`,
            error
          );

          if (!connectionFailed) {
            connectionFailed = true;
            onMessage({
              id: `error-${Date.now()}`,
              content:
                "⚠️ Real-time connection interrupted. Attempting to reconnect...",
              role: "assistant",
              timestamp: new Date(),
              sessionId: backendSessionId,
              status: "ERROR",
            });

            // Dispatch a custom error event for components to handle
            const customEvent = new CustomEvent("sse:error", {
              detail: {
                error:
                  "Real-time connection interrupted. Attempting to reconnect...",
                sessionId: backendSessionId,
                timestamp: new Date().toISOString(),
              },
            });
            document.querySelector("body")?.dispatchEvent(customEvent);
          }

          // Close the errored connection
          if (eventSource) {
            try {
              eventSource.close();
              eventSource = null;
            } catch (closeError) {
              console.warn(
                "Error closing EventSource after error:",
                closeError
              );
            }
          }

          // Implement retry with exponential backoff
          const reconnectDelay = Math.min(
            1000 * Math.pow(1.5, reconnectAttempts),
            30000
          );
          reconnectAttempts++;

          console.log(
            `Will attempt to reconnect in ${reconnectDelay}ms (attempt #${reconnectAttempts})`
          );
          reconnectTimer = setTimeout(connect, reconnectDelay);
        };
      } catch (connectionError) {
        console.error("Error creating EventSource:", connectionError);

        // If we hit an exception creating the EventSource, also try to reconnect
        const reconnectDelay = Math.min(
          1000 * Math.pow(1.5, reconnectAttempts),
          30000
        );
        reconnectAttempts++;

        console.log(
          `Will attempt to reconnect in ${reconnectDelay}ms (attempt #${reconnectAttempts})`
        );
        reconnectTimer = setTimeout(connect, reconnectDelay);
      }
    };

    connect(); // Initial connection attempt

    // Return cleanup function
    return () => {
      console.log(`Closing SSE listener for session: ${backendSessionId}`);

      // Clear any pending reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Close the connection
      if (eventSource) {
        try {
          eventSource.close();
          eventSource = null;
        } catch (error) {
          console.warn("Error during EventSource cleanup:", error);
        }
      }
    };
  },
};
