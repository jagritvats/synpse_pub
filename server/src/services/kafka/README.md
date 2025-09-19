# Kafka Integration
This directory contains services for Kafka integration, providing asynchronous processing capabilities for various operations in the system.

## Overview

The Kafka integration consists of several components:

- **Kafka Service**: Core service for Kafka connection management
- **Message Producer Service**: Produces messages to Kafka topics
- **Message Consumer Service**: Consumes messages from Kafka topics and processes them

## Flow Configuration

The Kafka integration supports granular configuration of which flows use Kafka via environment variables. Each flow can be individually enabled or disabled, with the global `ENABLE_KAFKA` variable as a fallback.

### Environment Variables

| Environment Variable      | Default      | Purpose                                              |
| ------------------------- | ------------ | ---------------------------------------------------- |
| ENABLE_KAFKA              | true         | Global enablement for all Kafka operations           |
| KAFKA_CHAT_MESSAGES       | ENABLE_KAFKA | Enable/disable Kafka for chat message processing     |
| KAFKA_SUMMARIZATION       | ENABLE_KAFKA | Enable/disable Kafka for summarization requests      |
| KAFKA_CONTEXT_ANALYSIS    | ENABLE_KAFKA | Enable/disable Kafka for context analysis (thoughts) |
| KAFKA_MEMORY_OPERATIONS   | ENABLE_KAFKA | Enable/disable Kafka for memory operations           |
| KAFKA_SESSION_OPERATIONS  | ENABLE_KAFKA | Enable/disable Kafka for session operations          |
| KAFKA_ACTIVITY_OPERATIONS | ENABLE_KAFKA | Enable/disable Kafka for activity operations         |
| KAFKA_ACTION_OPERATIONS   | ENABLE_KAFKA | Enable/disable Kafka for action operations           |

### Example Configurations

**Enable all Kafka flows:**

```
ENABLE_KAFKA=true
```

**Disable all Kafka flows:**

```
ENABLE_KAFKA=false
```

**Mixed configuration:**

```
ENABLE_KAFKA=true
KAFKA_CHAT_MESSAGES=true
KAFKA_SUMMARIZATION=false
KAFKA_CONTEXT_ANALYSIS=true
KAFKA_MEMORY_OPERATIONS=false
```

### Fallback Behavior

When a flow's Kafka processing is disabled (either through the specific environment variable or the global `ENABLE_KAFKA`), the system will automatically fall back to synchronous processing. This ensures the system can operate even without Kafka.

Additionally, if a Kafka operation fails (e.g., Kafka is down or unreachable), the system will attempt synchronous processing as a fallback to maintain functionality.

## Topics

The following Kafka topics are used:

| Topic                     | Purpose                  |
| ------------------------- | ------------------------ |
| chat-message-requests     | Chat message processing  |
| summarization-requests    | User summary generation  |
| context-analysis-requests | AI thought processing    |
| memory-operations         | Memory CRUD operations   |
| session-operations        | Session CRUD operations  |
| activity-operations       | Activity CRUD operations |
| action-operations         | Action execution         |

## Operation Types

Each topic handles specific operation types:

- **Chat Messages**: create, update, delete
- **Summarization**: generate, update
- **Context Analysis**: analyze, evaluate
- **Memory Operations**: create, update, delete, query
- **Session Operations**: create, update, delete, query
- **Activity Operations**: create, update, end
- **Action Operations**: execute, complete

## Tracing

The Kafka integration includes tracing support to track operations across the system. When a message is produced, a trace context is created and injected into the message. When the message is consumed, the trace context is extracted and used to continue the trace.

## Error Handling

If a Kafka operation fails, the system will:

1. Log the error with the trace context
2. Attempt synchronous processing as a fallback
3. If synchronous processing also fails, propagate the error to the caller

## Scalability

The Kafka integration allows the system to scale horizontally by distributing processing across multiple consumers. Each consumer can handle a specific topic or set of topics, allowing for specialized processing and load balancing.
