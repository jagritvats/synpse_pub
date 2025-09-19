import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { userService } from "../services/user.service"; // Import UserService
import { loggerFactory } from "../utils/logger.service";
// import { User } from "../../../server/src/core/entities/user.entity";
// import { SECRET_KEY } from "../config/env"; // Assuming env config path

const logger = loggerFactory.getLogger("AuthMiddleware");

/**
 * Authentication middleware that verifies JWT tokens in the request
 * For development purposes, this can be set to bypass authentication
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if this is an SSE request
  const isSSE = req.path.includes("/events") && req.method === "GET";

  // SSE endpoints have their own auth handling, so we can bypass the middleware
  // to avoid double-checking the token and potentially generating conflicting headers
  if (isSSE) {
    logger.debug(
      `Bypassing auth middleware for SSE endpoint: ${req.path} - Auth will be handled in the endpoint`
    );
    return next();
  }

  let token: string | undefined;

  // First try to get token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
    logger.debug(
      `Using token from Authorization header for ${req.method} ${req.path}`
    );
  }
  // Then check query parameters for other requests
  else if (req.query.token) {
    token = req.query.token as string;
    logger.debug(
      `Using token from query parameter for ${req.method} ${req.path}`
    );
  }

  if (!token) {
    logger.warn(
      `Authentication failed: No token provided for ${req.method} ${req.path}`
    );
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  try {
    // Ensure SECRET_KEY is defined
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error("JWT_SECRET is not defined in environment variables.");
      res.status(500).json({
        message: "Internal server error: Authentication configuration missing.",
      });
      return;
    }

    const decoded = jwt.verify(token, secret) as { id: string }; // Adjust payload type if needed
    logger.debug(`Token verified for user ID: ${decoded.id}`);

    // Fetch user using UserService
    const user = await userService.findUserById(decoded.id);

    if (!user) {
      logger.warn(`Authentication failed: User ${decoded.id} not found`);
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    // Attach user to request (ensure type compatibility)
    req.user = {
      id: user._id.toString(), // Use _id from Mongoose doc
      email: user.email,
      // Add role or other fields if necessary
    };

    logger.debug(
      `User ${user._id} authenticated for ${req.method} ${req.path}`
    );
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`JWT verification failed: ${error.message}`);
      res.status(401).json({ message: `Unauthorized: ${error.message}` });
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`Token expired for ${req.method} ${req.path}`);
      res.status(401).json({ message: "Unauthorized: Token expired" });
    } else {
      logger.error(
        `Auth Middleware Error: ${error instanceof Error ? error.message : String(error)}`
      );
      res
        .status(500)
        .json({ message: "Internal server error during authentication." });
    }
  }
};

export const validateRequest = authMiddleware;

/**
 * Type definition for the authenticated user
 */
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role?: string;
    }

    interface Request {
      user?: User;
    }
  }
}

/**
 * Optional authentication middleware that doesn't require auth
 * but will still set req.user if a valid token is provided
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if this is an SSE request
  const isSSE = req.path.includes("/events") && req.method === "GET";

  // SSE endpoints have their own auth handling
  if (isSSE) {
    logger.debug(
      `Bypassing optional auth middleware for SSE endpoint: ${req.path}`
    );
    return next();
  }

  let token: string | undefined;

  // First try to get token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
    logger.debug(
      `Using token from Authorization header for optional auth: ${req.method} ${req.path}`
    );
  }
  // Then check query parameters for other requests
  else if (req.query.token) {
    token = req.query.token as string;
    logger.debug(
      `Using token from query parameter for optional auth: ${req.method} ${req.path}`
    );
  }

  if (token) {
    // Handle regular JWT tokens
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        logger.error(
          "JWT_SECRET is not defined in environment variables for optional auth."
        );
        // Proceeding without auth for optional middleware
        return next();
      }

      const decoded = jwt.verify(token, secret) as { id: string };
      logger.debug(`Optional auth: Token verified for user ID: ${decoded.id}`);

      // Fetch user using UserService
      const user = await userService.findUserById(decoded.id);

      if (user) {
        // Attach user to request (ensure type compatibility)
        req.user = {
          id: user._id.toString(),
          email: user.email,
        };
        logger.debug(
          `Optional auth: User ${user._id} identified for ${req.method} ${req.path}`
        );
      } else {
        logger.warn(
          `Optional auth: JWT decoded for user ${decoded.id}, but user not found.`
        );
        // Proceed without req.user
      }
    } catch (error) {
      // Ignore JWT errors for optional auth, just proceed without authentication
      logger.warn(
        `Optional auth failed for ${req.method} ${req.path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    logger.debug(
      `Optional auth: No token found for ${req.method} ${req.path}, proceeding without user.`
    );
  }

  next();
};
