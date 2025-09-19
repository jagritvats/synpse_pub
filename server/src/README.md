# Synapse Express Server Source Code

This directory contains the source code for the Synapse Express Server, which provides the backend API and services for the Synapse AI companion application.

## Directory Structure

- **config/**: Configuration files and setup for external services like MongoDB
- **controllers/**: Request handlers that process incoming HTTP requests
- **interfaces/**: TypeScript interfaces used across the application
- **middleware/**: Express middleware for request processing
- **middlewares/**: Additional middleware components (note: consider consolidating with middleware/)
- **models/**: Data models and interfaces that define the structure of application data
- **routes/**: API endpoint definitions organized by feature
- **services/**: Core business logic organized as service modules
- **tests/**: Test files for the application
- **types/**: TypeScript type definitions
- **utils/**: Utility functions and helper methods

## Key Files

- **app.ts**: Main Express application setup, middleware configuration, and route registration
- **index.ts**: Entry point for the application that starts the server

## Architecture Overview

The Synapse Express Server follows a modular architecture with clear separation of concerns:

1. **Routes** define the API endpoints and handle HTTP requests/responses
2. **Services** contain the core business logic and interact with data sources
3. **Models** define the data structures used throughout the application
4. **Middleware** processes requests before they reach the route handlers

### Request Flow

A typical request flows through the application as follows:

1. Client sends HTTP request to an endpoint
2. Express middleware processes the request (authentication, logging, etc.)
3. Route handler receives the request and extracts parameters
4. Route handler calls appropriate service method(s)
5. Service performs business logic, possibly interacting with other services
6. Service may access data through models
7. Results flow back through the service to the route handler
8. Route handler formats and sends the HTTP response

## Key Features

### AI Companion

The AI companion functionality is implemented through several cooperating services:
- `ai.service.ts`: Core AI processing
- `context.service.ts`: Contextual awareness
- `memory.service.ts`: Memory management
- `chat-session.service.ts` and `session.service.ts`: Session management

### Telegram Bot

The Telegram bot integration allows users to interact with the AI companion through Telegram:
- `telegram.service.ts`: Core Telegram functionality
- Integration with the same AI processing pipeline used by the web interface

### Memory System

The memory system provides short-term, medium-term, and long-term memory for the AI companion:
- `memory.service.ts`: Memory management
- `vector-db.service.ts` and related services: Vector storage for semantic search

## Cross-Service Relationships

The application features complex relationships between services:

- **Chat Processing**: `chat.routes.ts` → `session.service.ts` → `chat-session.service.ts` → `ai.service.ts` → `context.service.ts` → `memory.service.ts`
- **Telegram Integration**: `telegram.service.ts` → `ai.service.ts` → `context.service.ts` → `memory.service.ts`
- **Memory Management**: `memory.service.ts` → `vector-db.service.ts` → `mongo-vector-db.service.ts`

## Development Guidelines

When working on the Synapse Express Server:

1. **Maintain Modularity**: Keep services focused on specific functionality
2. **Document Relationships**: Update README files when adding new components or changing relationships
3. **Follow Naming Conventions**: Use consistent naming for files and exports
4. **Add Tests**: Ensure new functionality has appropriate test coverage
5. **Update API Documentation**: Keep the main README's API documentation up to date