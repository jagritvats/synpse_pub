import SSE from "express-sse";
import { Request, Response } from "express";
import { loggerFactory } from "./logger.service";

const logger = loggerFactory.getLogger("SSEWrapper");

/**
 * Wrapper for Express SSE that handles common issues like:
 * - Missing res.flush() method
 * - Headers already sent
 * - Connection management
 * - CORS support
 */
export class SSEWrapper {
  private sse: SSE;
  private res: Response;
  private req: Request;
  private initialized: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private sessionId: string;
  private userId: string;

  constructor(sessionId: string, userId: string) {
    this.sse = new SSE();
    this.sessionId = sessionId;
    this.userId = userId;
  }

  /**
   * Safely set headers for SSE if they haven't been sent
   */
  private setSSEHeaders(res: Response, req: Request): boolean {
    if (res.headersSent) {
      logger.warn(
        `Headers already sent for session ${this.sessionId}. Cannot set SSE headers.`
      );
      return false;
    }

    try {
      // Set required SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Handle CORS properly by respecting the origin
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        // Default CORS headers if no origin specified
        res.setHeader("Access-Control-Allow-Origin", "*");
      }

      // Set response status
      res.status(200);
      return true;
    } catch (error) {
      logger.error(
        `Error setting SSE headers for session ${this.sessionId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Initialize the SSE connection safely
   */
  public init(req: Request, res: Response): boolean {
    this.req = req;
    this.res = res;

    // Try to set headers if they haven't been set yet
    const headersSet = this.setSSEHeaders(res, req);

    if (headersSet) {
      // Write initial newline to help some clients
      try {
        res.write("\n");
      } catch (error) {
        logger.warn(
          `Error writing initial newline for session ${this.sessionId}:`,
          error
        );
      }

      // Manually write initial connection event
      this.writeEvent("system", {
        message: "SSE connection established",
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      });

      // Try to initialize the underlying SSE instance ONLY if we set the headers
      try {
        this.sse.init(req, res);
        this.initialized = true; // Mark as initialized only if sse.init() succeeded
        logger.info(
          `SSE connection established and initialized for session ${this.sessionId}, user ${this.userId}.`
        );
      } catch (error) {
        logger.warn(
          `Error initializing underlying SSE instance for session ${this.sessionId}:`,
          error
        );
        logger.info(
          `Falling back to fully manual SSE handling for session ${this.sessionId}`
        );
        this.initialized = false; // Ensure it's false if sse.init failed
      }
    } else {
      logger.warn(
        `Using manual SSE handling for session ${this.sessionId} due to headers issue.`
      );
      // Do not call sse.init() if headers are already sent
      this.initialized = false; // Explicitly set to false for manual handling

      // Still attempt to write the initial event manually if possible
      this.writeEvent("system", {
        message: "SSE connection (re)established (manual mode)",
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    // Set up ping interval (works regardless of initialization status)
    this.startPinging();

    // Handle client disconnect (works regardless of initialization status)
    req.on("close", () => {
      logger.info(
        `SSE connection closed for session ${this.sessionId}, user ${this.userId}.`
      );
      this.cleanup();
    });

    // Handle errors on the response (works regardless of initialization status)
    res.on("error", (err) => {
      logger.error(`SSE response error for session ${this.sessionId}:`, err);
      this.cleanup();
    });

    return true; // Return true as the wrapper itself is set up
  }

  /**
   * Safely send an event to the client, falling back to manual writing if needed
   */
  public send(data: any, eventType?: string): void {
    if (!this.res || this.res.writableEnded) {
      logger.warn(
        `Cannot send to closed connection for session ${this.sessionId}`
      );
      return;
    }

    try {
      if (this.initialized) {
        // Try using the SSE instance first
        this.sse.send(data, eventType);
      } else {
        // Fall back to manual event writing
        this.writeEvent(eventType || "message", data);
      }
    } catch (error) {
      logger.warn(
        `Error sending SSE event for session ${this.sessionId}:`,
        error
      );
      // Try manual writing as fallback
      try {
        this.writeEvent(eventType || "message", data);
      } catch (writeError) {
        logger.error(`Failed manual event writing fallback:`, writeError);
        // The connection might be broken at this point
        this.checkConnectionStatus();
      }
    }
  }

  /**
   * Check if the connection is still valid
   */
  private checkConnectionStatus(): void {
    if (!this.res || this.res.writableEnded || !this.res.writable) {
      logger.warn(`Connection lost for session ${this.sessionId}, cleaning up`);
      this.cleanup();
    }
  }

  /**
   * Write an event to the response stream directly
   */
  private writeEvent(event: string, data: any): void {
    if (!this.res || this.res.writableEnded) return;

    try {
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error(
        `Error writing event to response for session ${this.sessionId}:`,
        error
      );
      this.checkConnectionStatus();
    }
  }

  /**
   * Send a ping comment to keep the connection alive
   */
  private ping(): void {
    if (!this.res || this.res.writableEnded) {
      this.cleanup();
      return;
    }

    try {
      this.res.write(": ping\n\n");
    } catch (error) {
      logger.error(`Error sending ping for session ${this.sessionId}:`, error);
      this.cleanup();
    }
  }

  /**
   * Start the ping interval
   */
  private startPinging(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      this.ping();
    }, 15000);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    logger.debug(`SSE resources cleaned up for session ${this.sessionId}`);
  }

  /**
   * Close the connection
   */
  public close(): void {
    this.cleanup();

    if (this.res && !this.res.writableEnded) {
      try {
        this.res.end();
      } catch (error) {
        logger.error(
          `Error closing SSE connection for session ${this.sessionId}:`,
          error
        );
      }
    }
  }

  /**
   * Extract and verify authentication from request
   * This provides an alternative authentication mechanism for SSE
   *
   * @param req The Express request object
   * @returns Boolean indicating if authentication was successful
   */
  public extractAndVerifyAuth(req: Request): Promise<boolean> {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // Check Authorization header first
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
      logger.debug(
        `SSE Auth: Using token from Authorization header for session ${this.sessionId}`
      );
    }
    // Then check query parameter as fallback
    else if (req.query.token) {
      token = req.query.token as string;
      logger.debug(
        `SSE Auth: Using token from query parameter for session ${this.sessionId}`
      );
    }

    // If no token was found, fail authentication
    if (!token) {
      logger.warn(`SSE Auth: No token found for session ${this.sessionId}`);
      return Promise.resolve(false);
    }

    // Verify the token
    return new Promise<boolean>((resolve) => {
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          logger.error("JWT_SECRET is not defined for SSE auth verification");
          resolve(false);
          return;
        }

        const decoded = require("jsonwebtoken").verify(token, secret) as {
          id: string;
        };
        if (decoded && decoded.id) {
          // Successfully verified token
          logger.debug(
            `SSE Auth: Token verified for user ${decoded.id}, session ${this.sessionId}`
          );
          resolve(true);
        } else {
          logger.warn(
            `SSE Auth: Invalid token for session ${this.sessionId} (decoded but no id)`
          );
          resolve(false);
        }
      } catch (error) {
        logger.warn(
          `SSE Auth: Token verification failed for session ${this.sessionId}: ${error}`
        );
        resolve(false);
      }
    });
  }
}
