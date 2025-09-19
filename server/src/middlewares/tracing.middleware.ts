import { Request, Response, NextFunction } from "express";
import { tracingService } from "../services/tracing.service";
import { loggerFactory } from "../utils/logger.service";

const logger = loggerFactory.getLogger("TracingMiddleware");

/**
 * Helper function to safely set a response header
 * Only sets the header if the response hasn't been sent yet
 */
const safeSetHeader = (res: Response, name: string, value: string): void => {
  try {
    if (!res.headersSent) {
      res.setHeader(name, value);
    }
  } catch (error) {
    logger.debug(`Failed to set header ${name}: ${error}`);
  }
};

/**
 * Middleware that creates a trace context for each request and makes it
 * available throughout the request lifecycle.
 *
 * Extracts trace context from incoming requests if available and
 * creates a new trace context if none exists.
 */
export const tracingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract existing trace context from request headers if present
    const incomingTraceId = req.headers["x-trace-id"] as string;
    const incomingSpanId = req.headers["x-span-id"] as string;

    // Create a trace context
    let traceContext;
    if (incomingTraceId) {
      // Use the incoming trace context as parent
      const parentContext = {
        traceId: incomingTraceId,
        spanId: incomingSpanId || "",
        timestamp: Date.now(),
      };

      // Start a new span within the existing trace
      const { context } = tracingService.startSpan(
        parentContext,
        `http_${req.method.toLowerCase()}_${req.path}`,
        {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get("user-agent"),
        }
      );

      traceContext = context;
    } else {
      // Create a new root trace with a session ID if available
      const sessionId =
        (req.headers["x-session-id"] as string) ||
        (req.body && req.body.sessionId) ||
        (req.query.sessionId as string);

      const userId =
        (req.headers["x-user-id"] as string) ||
        (req.body && req.body.userId) ||
        (req as any).userId ||
        (req.query.userId as string);

      const { context } = tracingService.startSpan(
        undefined,
        `http_${req.method.toLowerCase()}_${req.path}`,
        {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get("user-agent"),
          sessionId,
          userId,
        }
      );

      traceContext = context;
    }

    // Add the trace context to the request object
    (req as any).traceContext = traceContext;

    // Add trace headers to the response (safely)
    safeSetHeader(res, "x-trace-id", traceContext.traceId);
    safeSetHeader(res, "x-span-id", traceContext.spanId);

    // Create a traced logger for this request
    const requestLogger = logger.withTraceContext(
      traceContext.traceId,
      traceContext.spanId
    );
    (req as any).logger = requestLogger;

    // Log the request
    requestLogger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Add response listener to end the span
    res.on("finish", () => {
      try {
        // Get the span ID from the request
        const spanId = traceContext.spanId;

        // Add response data to the span
        tracingService.setSpanTag(spanId, "http.status_code", res.statusCode);

        // Calculate response time if response time header is set
        let responseTime;
        try {
          responseTime = res.getHeader("x-response-time");
        } catch (error) {
          // Ignore header errors
        }

        if (responseTime) {
          tracingService.setSpanTag(
            spanId,
            "http.response_time_ms",
            responseTime
          );
        }

        // End the span
        tracingService.endSpan(spanId);

        // Log the response
        requestLogger.info(`${req.method} ${req.path} ${res.statusCode}`, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
        });
      } catch (error) {
        logger.error(`Error in finish event handler: ${error}`);
      }
    });

    next();
  } catch (error) {
    logger.error("Failed to create trace context", error);
    next();
  }
};

/**
 * Middleware that measures response time and adds it as a header
 */
export const responseTimeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Add response listener to calculate response time
  res.on("finish", () => {
    try {
      const duration = Date.now() - start;
      safeSetHeader(res, "x-response-time", `${duration}ms`);
    } catch (error) {
      logger.debug(`Failed to set response time header: ${error}`);
    }
  });

  next();
};

/**
 * CORS middleware config with trace headers
 */
export const corsMiddleware = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-trace-id",
    "x-span-id",
    "x-session-id",
    "x-user-id",
  ],
  exposedHeaders: [
    "x-trace-id",
    "x-span-id",
    "x-response-time",
    "Content-Type",
    "Cache-Control",
    "Connection",
  ],
  credentials: true,
  maxAge: 86400,
  // Custom handler for CORS preflight requests especially for SSE
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

/**
 * Helper to get the trace context from a request
 */
export const getTraceContext = (req: Request) => {
  return (req as any).traceContext;
};

/**
 * Helper to get the traced logger from a request
 */
export const getTracedLogger = (req: Request) => {
  return (req as any).logger || loggerFactory.getLogger("API");
};
