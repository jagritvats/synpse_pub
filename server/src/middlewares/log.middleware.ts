import { Request, Response, NextFunction } from "express";
import { loggerFactory } from "../utils/logger.service";
import { getTraceContext } from "./tracing.middleware";

const logger = loggerFactory.getLogger("HTTP");

/**
 * Middleware for HTTP request logging with trace context integration
 */
export const logMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Process the request
  res.on("finish", () => {
    const duration = Date.now() - start;
    const traceContext = getTraceContext(req);

    // Get the request logger or create a new one
    const requestLogger = traceContext
      ? logger.withTraceContext(traceContext.traceId, traceContext.spanId)
      : logger;

    // Log basic request information
    const logData = {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };

    if (res.statusCode >= 500) {
      requestLogger.error(
        `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`,
        logData
      );
    } else if (res.statusCode >= 400) {
      requestLogger.warn(
        `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`,
        logData
      );
    } else {
      requestLogger.info(
        `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`,
        logData
      );
    }
  });

  next();
};
