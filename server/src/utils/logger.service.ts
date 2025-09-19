import winston from "winston";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "info";
};

// Custom format - include timestamp and structured format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "label"],
  }),
  winston.format.printf((info) => {
    // Extract trace info from metadata if available
    const traceInfo = info.metadata?.traceId
      ? `[traceId=${info.metadata.traceId}${info.metadata.spanId ? ` spanId=${info.metadata.spanId}` : ""}]`
      : "";

    // Extract session and user info
    const sessionInfo = info.metadata?.sessionId
      ? `[sessionId=${info.metadata.sessionId}]`
      : "";
    const userInfo = info.metadata?.userId
      ? `[userId=${info.metadata.userId}]`
      : "";

    // Additional context segments
    const service = info.metadata?.service ? `[${info.metadata.service}]` : "";

    // Format the message
    return `${info.timestamp} ${info.level.toUpperCase()} ${service}${traceInfo}${sessionInfo}${userInfo}: ${info.message}${
      Object.keys(info.metadata).length > 0 &&
      !info.metadata.service &&
      !info.metadata.traceId &&
      !info.metadata.spanId &&
      !info.metadata.sessionId &&
      !info.metadata.userId
        ? ` ${JSON.stringify(info.metadata)}`
        : ""
    }${info.stack ? `\n${info.stack}` : ""}`;
  })
);

// Define transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: "logs/all.log",
    maxsize: 5242880, // 5MB
    maxFiles: 10,
  }),
];

// Create the logger
const defaultLogger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  defaultMeta: { service: "synapse-api" },
});

class Logger {
  private namespace: string;
  private defaultMeta: Record<string, any>;

  constructor(namespace: string, defaultMeta: Record<string, any> = {}) {
    this.namespace = namespace;
    this.defaultMeta = {
      ...defaultMeta,
      service: namespace,
    };
  }

  /**
   * Log an informational message
   * @param message The message to log
   * @param meta Additional metadata
   */
  info(message: string, meta: Record<string, any> = {}) {
    defaultLogger.info(message, { ...this.defaultMeta, ...meta });
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param meta Additional metadata
   */
  warn(message: string, meta: Record<string, any> = {}) {
    defaultLogger.warn(message, { ...this.defaultMeta, ...meta });
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error Optional error object
   * @param meta Additional metadata
   */
  error(
    message: string,
    error?: Error | Record<string, any>,
    meta: Record<string, any> = {}
  ) {
    const errorMeta =
      error instanceof Error
        ? { error: { message: error.message, stack: error.stack } }
        : typeof error === "object"
          ? error
          : {};

    defaultLogger.error(message, {
      ...this.defaultMeta,
      ...errorMeta,
      ...meta,
    });
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param meta Additional metadata
   */
  debug(message: string, meta: Record<string, any> = {}) {
    defaultLogger.debug(message, { ...this.defaultMeta, ...meta });
  }

  /**
   * Log an HTTP request
   * @param message The message to log
   * @param meta Additional metadata
   */
  http(message: string, meta: Record<string, any> = {}) {
    defaultLogger.http(message, { ...this.defaultMeta, ...meta });
  }

  /**
   * Create a child logger with additional context
   * @param context Additional context to include in logs
   * @returns A new logger with the combined context
   */
  withContext(context: Record<string, any>): Logger {
    return new Logger(this.namespace, { ...this.defaultMeta, ...context });
  }

  /**
   * Create a child logger with trace context
   * @param traceId The trace ID
   * @param spanId Optional span ID
   * @returns A new logger with the trace context
   */
  withTraceContext(traceId: string, spanId?: string): Logger {
    return this.withContext({ traceId, spanId });
  }

  /**
   * Create a child logger with session context
   * @param sessionId The session ID
   * @returns A new logger with the session context
   */
  withSessionContext(sessionId: string): Logger {
    return this.withContext({ sessionId });
  }

  /**
   * Create a child logger with user context
   * @param userId The user ID
   * @returns A new logger with the user context
   */
  withUserContext(userId: string): Logger {
    return this.withContext({ userId });
  }
}

class LoggerFactory {
  private loggers: Map<string, Logger> = new Map();

  /**
   * Get or create a logger for a specific namespace
   * @param namespace The namespace for the logger
   * @returns A logger for the specified namespace
   */
  getLogger(namespace: string): Logger {
    if (!this.loggers.has(namespace)) {
      this.loggers.set(namespace, new Logger(namespace));
    }
    return this.loggers.get(namespace)!;
  }
}

export const loggerFactory = new LoggerFactory();
