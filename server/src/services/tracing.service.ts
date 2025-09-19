import { v4 as uuidv4 } from "uuid";
import { loggerFactory } from "../utils/logger.service";

interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface Span {
  context: SpanContext;
  start: number;
  end?: number;
  duration?: number;
  operation: string;
  status: "started" | "completed" | "error";
  error?: Error;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }>;
  tags: Record<string, any>;
}

/**
 * TracingService provides distributed tracing capabilities for tracking operations
 * across different services and components of the application.
 *
 * It creates and manages trace contexts with unique identifiers that can be propagated
 * between services, including via Kafka messages, to maintain a connected view of
 * related operations.
 */
class TracingService {
  private activeSpans: Map<string, Span> = new Map();
  private logger = loggerFactory.getLogger("TracingService");

  /**
   * Creates a new trace context with a unique trace ID
   *
   * @param sessionId Optional session ID to associate with this trace
   * @param userId Optional user ID to associate with this trace
   * @param metadata Optional additional metadata for the trace
   * @returns A new trace context
   */
  createTraceContext(
    sessionId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): SpanContext {
    return {
      traceId: uuidv4(),
      spanId: uuidv4(),
      timestamp: Date.now(),
      sessionId,
      userId,
      metadata,
    };
  }

  /**
   * Creates a new span within an existing trace context
   *
   * @param parentContext The parent trace context
   * @param operation The name of the operation being performed
   * @param metadata Optional additional metadata for the span
   * @returns A new span object and context
   */
  startSpan(
    parentContext: SpanContext | undefined,
    operation: string,
    metadata?: Record<string, any>
  ): { span: Span; context: SpanContext } {
    // If no parent context, create a new root trace
    const context: SpanContext = parentContext
      ? {
          traceId: parentContext.traceId,
          spanId: uuidv4(),
          parentSpanId: parentContext.spanId,
          timestamp: Date.now(),
          sessionId: parentContext.sessionId,
          userId: parentContext.userId,
          metadata: { ...parentContext.metadata, ...metadata },
        }
      : this.createTraceContext(undefined, undefined, metadata);

    const span: Span = {
      context,
      start: Date.now(),
      operation,
      status: "started",
      events: [],
      tags: {},
    };

    this.activeSpans.set(span.context.spanId, span);
    this.logger.debug(
      `Started span ${operation} with ID ${span.context.spanId} in trace ${span.context.traceId}`
    );

    return { span, context };
  }

  /**
   * Ends an active span and calculates its duration
   *
   * @param spanId The ID of the span to end
   * @param error Optional error if the span ended with an error
   * @returns The completed span or undefined if not found
   */
  endSpan(spanId: string, error?: Error): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to end non-existent span with ID ${spanId}`);
      return undefined;
    }

    span.end = Date.now();
    span.duration = span.end - span.start;
    span.status = error ? "error" : "completed";

    if (error) {
      span.error = error;
      this.logger.error(
        `Span ${span.operation} failed after ${span.duration}ms`,
        {
          error,
          traceId: span.context.traceId,
          spanId,
        }
      );
    } else {
      this.logger.debug(
        `Completed span ${span.operation} in ${span.duration}ms`
      );
    }

    this.activeSpans.delete(spanId);
    return span;
  }

  /**
   * Adds an event to an active span
   *
   * @param spanId The ID of the span to add the event to
   * @param name The name of the event
   * @param attributes Optional attributes for the event
   * @returns The updated span or undefined if not found
   */
  addSpanEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, any>
  ): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(
        `Attempted to add event to non-existent span with ID ${spanId}`
      );
      return undefined;
    }

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });

    return span;
  }

  /**
   * Adds a tag to an active span
   *
   * @param spanId The ID of the span to add the tag to
   * @param key The tag key
   * @param value The tag value
   * @returns The updated span or undefined if not found
   */
  setSpanTag(spanId: string, key: string, value: any): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(
        `Attempted to set tag on non-existent span with ID ${spanId}`
      );
      return undefined;
    }

    span.tags[key] = value;
    return span;
  }

  /**
   * Gets a trace context that can be propagated to other services
   *
   * @param spanId The ID of the span whose context to get
   * @returns The span context or undefined if not found
   */
  getContext(spanId: string): SpanContext | undefined {
    const span = this.activeSpans.get(spanId);
    return span?.context;
  }

  /**
   * Extracts a trace context from a carrier object (e.g., a message or request)
   *
   * @param carrier The carrier object containing the trace context
   * @returns The extracted trace context or undefined if not found
   */
  extractContext(carrier: Record<string, any>): SpanContext | undefined {
    if (!carrier || !carrier.traceContext) {
      return undefined;
    }

    try {
      const context =
        typeof carrier.traceContext === "string"
          ? JSON.parse(carrier.traceContext)
          : carrier.traceContext;

      // Validate the context has required fields
      if (!context.traceId || !context.spanId || !context.timestamp) {
        this.logger.warn("Invalid trace context in carrier", { context });
        return undefined;
      }

      return context;
    } catch (error) {
      this.logger.error("Failed to extract trace context", { error });
      return undefined;
    }
  }

  /**
   * Injects a trace context into a carrier object (e.g., a message or request)
   *
   * @param context The trace context to inject
   * @param carrier The carrier object to inject the context into
   * @returns The carrier with the injected context
   */
  injectContext(
    context: SpanContext,
    carrier: Record<string, any>
  ): Record<string, any> {
    if (!context) {
      return carrier;
    }

    return {
      ...carrier,
      traceContext: JSON.stringify(context),
    };
  }

  /**
   * Executes a function within a traced span
   *
   * @param parentContext The parent trace context
   * @param operation The name of the operation being performed
   * @param fn The function to execute
   * @param metadata Optional additional metadata for the span
   * @returns The result of the function
   */
  async traceAsync<T>(
    parentContext: SpanContext | undefined,
    operation: string,
    fn: (spanContext: SpanContext) => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const { span, context } = this.startSpan(
      parentContext,
      operation,
      metadata
    );

    try {
      const result = await fn(context);
      this.endSpan(span.context.spanId);
      return result;
    } catch (error) {
      this.endSpan(span.context.spanId, error as Error);
      throw error;
    }
  }

  /**
   * Get all active spans for debugging or monitoring
   *
   * @returns Array of all active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }
}

// Export a singleton instance
export const tracingService = new TracingService();
