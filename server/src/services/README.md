# Services Directory

This directory contains the core business logic of the Synapse Express Server. Each service is responsible for a specific aspect of the application's functionality.

## Service Overview

### Core Services

- **ai.service.ts**: Handles AI processing using Ollama or fallback providers. Responsible for generating responses to user messages and managing AI-related functionality.
- **chat-session.service.ts**: Manages in-memory chat session state, including messages and session metadata.
- **session.service.ts**: Handles persistent session storage and retrieval, working alongside chat-session.service.ts.
- **context.service.ts**: Manages contextual information for conversations, including time awareness, weather data, and other environmental factors.
- **memory.service.ts**: Implements the memory system (short-term, medium-term, and long-term) for the AI companion.

### Data Management Services

- **vector-db.service.ts**: Abstract interface for vector database operations.
- **mongo-vector-db.service.ts**: MongoDB implementation of the vector database service.
- **vector.service.ts**: Handles vector operations for semantic search and similarity.

### Feature Services

- **enhanced-chat.service.ts**: Provides advanced chat features beyond basic messaging.
- **notes.service.ts**: Manages user notes and related functionality.
- **triggers.service.ts**: Handles event triggers and automated actions.
- **action-manager.service.ts**: Manages actions that can be performed by the AI companion.
- **ai-action-suggester.service.ts**: Suggests possible actions based on conversation context.
- **companion-state.service.ts**: Manages the state of the AI companion, including mood and personality.
- **scheduler.service.ts**: Handles scheduled tasks and background processing.
- **serendipity.service.ts**: Implements serendipitous content discovery and suggestions.

### Integration Services

- **telegram.service.ts**: Integrates with Telegram messaging platform.
- **social.service.ts**: Manages social media integrations and interactions.

## Service Relationships

### Chat Flow

The chat functionality involves multiple services working together:
1. **chat.routes.ts** receives user messages and manages API endpoints
2. **session.service.ts** handles persistent session data
3. **chat-session.service.ts** manages in-memory chat state
4. **context.service.ts** provides contextual information
5. **ai.service.ts** generates AI responses
6. **memory.service.ts** stores and retrieves memories

### Memory System

The memory system uses several services:
1. **memory.service.ts** provides the main interface
2. **vector-db.service.ts** and **mongo-vector-db.service.ts** handle storage
3. **vector.service.ts** performs vector operations for semantic search

### Telegram Integration

The Telegram bot functionality uses:
1. **telegram.service.ts** for the core Telegram functionality
2. **ai.service.ts** for generating responses
3. **memory.service.ts** for maintaining conversation context
4. **session.service.ts** for managing user sessions

## Adding New Services

When adding a new service:
1. Create a new file with the naming convention `feature-name.service.ts`
2. Implement the service as a class with clear method names
3. Export a singleton instance
4. Update this README to document the new service and its relationships