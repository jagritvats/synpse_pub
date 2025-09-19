import { Request, Response, NextFunction } from "express";
import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("ErrorHandler");

export interface ErrorWithStatusCode extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ErrorWithStatusCode,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get trace context logger if available
  const reqLogger = (req as any).logger || logger;

  // Special handling for headers already sent error
  if (err.code === "ERR_HTTP_HEADERS_SENT") {
    reqLogger.warn(`Headers already sent error: ${err.message}`, {
      path: req.path,
      method: req.method,
      error: err.message,
    });
    return; // Can't send a response if headers already sent
  }

  // Log the error
  reqLogger.error(`Error in request: ${err.message}`, {
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
    errorCode: err.code,
    stack: err.stack,
  });

  // Don't attempt to send a response if headers are already sent
  if (res.headersSent) {
    reqLogger.debug("Headers already sent, cannot send error response");
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || "INTERNAL_SERVER_ERROR";

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
  });
};
