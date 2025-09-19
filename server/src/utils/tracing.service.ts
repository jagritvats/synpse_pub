import { v4 as uuidv4 } from "uuid";
import { loggerFactory } from "./logger.service";

const logger = loggerFactory.getLogger("TracingService");

/**
 * Service for distributed tracing across system boundaries
 */
export class TracingService {
  // Use AsyncLocalStorage to maintain trace context across async boundaries
  private static traceStorage = new Map<string, TraceContext>();

  /**
   * Generate a new trace ID for a request
   * @param sessionId The session ID to associate with the trace
   * @param userId The user ID to associate with the trace
   * @param operation Optional operation name
   * @returns The generated trace ID
   */
  static startTrace(
    sessionId: string,
    userId: string,
    operation?: string
  ): string {
    const timestamp = Date.now();
    const randomSuffix = uuidv4().split("-")[0]; // Use first segment of UUID for brevity
    const traceId = `${sessionId}-${timestamp}-${randomSuffix}`;

    const context: TraceContext = {
      traceId,
      sessionId,
      userId,
      operation: operation || "unknown",
      startTime: timestamp,
      spans: [],
    };

    this.traceStorage.set(traceId, context);
    logger.debug(
      `Started trace ${traceId} for session ${sessionId}, operation: ${context.operation}`
    );

    return traceId;
  }

  /**
   * Get the current trace context by trace ID
   */
  static getTraceContext(traceId: string): TraceContext | undefined {
    return this.traceStorage.get(traceId);
  }

  /**
   * Start a new span within the current trace
   */
  static startSpan(traceId: string, spanName: string): string {
    const context = this.traceStorage.get(traceId);
    if (!context) {
      logger.warn(
        `Attempted to start span ${spanName} for unknown trace ${traceId}`
      );
      return "";
    }

    const spanId = `${traceId}-${context.spans.length + 1}`;
    const span: TraceSpan = {
      spanId,
      name: spanName,
      startTime: Date.now(),
      endTime: 0,
      metadata: {},
    };

    context.spans.push(span);
    logger.debug(`Started span ${spanName} (${spanId}) for trace ${traceId}`);

    return spanId;
  }

  /**
   * End a span within the current trace
   */
  static endSpan(
    traceId: string,
    spanId: string,
    metadata?: Record<string, any>
  ): void {
    const context = this.traceStorage.get(traceId);
    if (!context) {
      logger.warn(
        `Attempted to end span ${spanId} for unknown trace ${traceId}`
      );
      return;
    }

    const span = context.spans.find((s) => s.spanId === spanId);
    if (!span) {
      logger.warn(
        `Attempted to end unknown span ${spanId} for trace ${traceId}`
      );
      return;
    }

    span.endTime = Date.now();
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }

    const duration = span.endTime - span.startTime;
    logger.debug(
      `Ended span ${span.name} (${spanId}) for trace ${traceId}, duration: ${duration}ms`
    );
  }

  /**
   * Add metadata to a trace
   */
  static addTraceMetadata(
    traceId: string,
    metadata: Record<string, any>
  ): void {
    const context = this.traceStorage.get(traceId);
    if (!context) {
      logger.warn(`Attempted to add metadata to unknown trace ${traceId}`);
      return;
    }

    context.metadata = { ...context.metadata, ...metadata };
  }

  /**
   * Add metadata to a span
   */
  static addSpanMetadata(
    traceId: string,
    spanId: string,
    metadata: Record<string, any>
  ): void {
    const context = this.traceStorage.get(traceId);
    if (!context) {
      logger.warn(
        `Attempted to add metadata to span in unknown trace ${traceId}`
      );
      return;
    }

    const span = context.spans.find((s) => s.spanId === spanId);
    if (!span) {
      logger.warn(
        `Attempted to add metadata to unknown span ${spanId} for trace ${traceId}`
      );
      return;
    }

    span.metadata = { ...span.metadata, ...metadata };
  }

  /**
   * End a trace and get the complete trace information
   * @returns The complete trace information or undefined if the trace doesn't exist
   */
  static endTrace(traceId: string): TraceContext | undefined {
    const context = this.traceStorage.get(traceId);
    if (!context) {
      logger.warn(`Attempted to end unknown trace ${traceId}`);
      return undefined;
    }

    context.endTime = Date.now();
    const duration = context.endTime - context.startTime;

    logger.info(
      `Ended trace ${traceId} for session ${context.sessionId}, operation: ${context.operation}, duration: ${duration}ms`
    );

    // Handle any spans that weren't explicitly ended
    context.spans.forEach((span) => {
      if (span.endTime === 0) {
        span.endTime = Date.now();
        logger.warn(
          `Auto-ending unclosed span ${span.name} for trace ${traceId}`
        );
      }
    });

    // For now, we'll keep the trace in storage, but we could remove it or export it
    // this.traceStorage.delete(traceId);

    return context;
  }

  /**
   * Clean up old traces to prevent memory leaks
   * This should be called periodically (e.g., via a cron job)
   * @param maxAgeMs Maximum age of traces to keep in milliseconds
   */
  static cleanupOldTraces(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [traceId, context] of this.traceStorage.entries()) {
      if (now - context.startTime > maxAgeMs) {
        this.traceStorage.delete(traceId);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      logger.info(`Cleaned up ${cleanupCount} old traces`);
    }
  }

  /**
   * Format trace info for logs
   */
  static formatTraceInfo(traceId: string): string {
    return `[trace=${traceId}]`;
  }
}

/**
 * Interface for trace context
 */
export interface TraceContext {
  traceId: string;
  sessionId: string;
  userId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  spans: TraceSpan[];
  metadata?: Record<string, any>;
}

/**
 * Interface for trace spans
 */
export interface TraceSpan {
  spanId: string;
  name: string;
  startTime: number;
  endTime: number;
  metadata: Record<string, any>;
}

// Create a singleton instance
export const tracingService = new TracingService();
