# Models Directory

This directory contains the data models and interfaces used throughout the Synapse Express Server. These models define the structure of data objects and provide type safety for TypeScript.

## Model Overview

### Chat Models

- **chat.model.ts**: Defines the structures for chat sessions and messages.
  - `ChatSession`: Represents a conversation session between a user and the AI.
  - `ChatMessage`: Represents a single message in a chat session.
  - `MessageRole`: Enum for message sender roles (user, assistant, system).
  - `MessageStatus`: Enum for message processing status.

### Companion State Models

- **companion-state.model.ts**: Defines the AI companion's state and personality.
  - `CompanionState`: Represents the current state of the AI companion.
  - `Personality`: Defines personality traits and characteristics.
  - `Mood`: Represents the companion's current emotional state.

### Context Models

- **context.model.ts**: Defines context-related data structures.
  - `Context`: Represents the contextual information for a conversation.
  - `TimeContext`: Time-related context (time of day, date, etc.).
  - `LocationContext`: Location-related context (city, country, etc.).
  - `WeatherContext`: Weather-related context (temperature, conditions, etc.).

### Memory Models

- **memory.model.ts**: Defines memory-related data structures.
  - `Memory`: Represents a stored memory.
  - `MemoryType`: Enum for memory types (short-term, medium-term, long-term).
  - `MemoryCategory`: Enum for memory categories (fact, preference, experience, etc.).

### Message Models

- **message.model.ts**: Defines message structures for different communication channels.
  - `Message`: Base message interface.
  - `UserMessage`: Message from a user.
  - `SystemMessage`: Internal system message.
  - `NotificationMessage`: Notification-type message.

### Vector Document Models

- **vector-document.model.ts**: Defines vector document structures for semantic search.
  - `VectorDocument`: Represents a document with vector embeddings.
  - `VectorQuery`: Represents a query for vector search.

## Model Usage

These models are used throughout the application:

1. **Services** use these models to define method parameters and return types.
2. **Routes** use these models to validate request bodies and structure responses.
3. **Controllers** use these models to process business logic.

## Model Relationships

- `ChatSession` contains an array of `ChatMessage` objects.
- `Memory` objects are associated with users and can be referenced in `Context`.
- `CompanionState` includes `Personality` and `Mood` components.
- `VectorDocument` is used by the vector database services for semantic search.

## Adding New Models

When adding a new model:
1. Create a new file with the naming convention `feature-name.model.ts`
2. Define interfaces, classes, and/or enums
3. Export all types that will be used by other parts of the application
4. Update this README to document the new model