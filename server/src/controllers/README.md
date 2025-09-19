# Controllers Directory

This directory contains controller modules that handle the business logic between routes and services in the Synapse Express Server.

## Role of Controllers

Controllers serve as an intermediate layer in the application architecture:

1. They receive requests from route handlers
2. Process and validate input data
3. Coordinate calls to one or more services
4. Format the response data
5. Handle errors and return appropriate responses

This separation of concerns helps keep route files focused on HTTP request/response handling while controllers handle the application-specific logic.

## Controller Overview

### Action Management

- **action-manager.controller.ts**: Handles the management of AI actions and capabilities, coordinating with the action manager service.

### AI Configuration

- **ai-parameters.controller.ts**: Manages AI behavior parameters and configuration settings.

### Context Management

- **context.controller.ts**: Processes context-related operations, working with the context service to maintain conversation context.

### Memory Management

- **memory.controller.ts**: Handles memory operations, including storing, retrieving, and managing different types of memories.

### Notes

- **notes.controller.ts**: Manages user notes functionality, including creation, retrieval, and organization.

### Scheduling

- **scheduler.controller.ts**: Controls scheduled tasks and background processes.

### Serendipity

- **serendipity.controller.ts**: Manages serendipitous content discovery and suggestions.

### Telegram Integration

- **telegram.controller.ts**: Handles Telegram bot integration and message processing.

### Triggers

- **triggers.controller.ts**: Manages event triggers and automated actions.

## Controller-Service Relationships

Controllers typically work with one or more services:

- **memory.controller.ts** primarily works with `memory.service.ts`
- **telegram.controller.ts** works with `telegram.service.ts` and may coordinate with other services like `ai.service.ts`
- **context.controller.ts** works with `context.service.ts`

## Controller Design Patterns

Controllers in this application follow these patterns:

1. **Method-based organization**: Each controller method typically handles a specific operation
2. **Service injection**: Controllers receive service instances through constructor injection or imports
3. **Error handling**: Controllers include try/catch blocks to handle errors and return appropriate HTTP responses
4. **Input validation**: Controllers validate input data before passing it to services
5. **Response formatting**: Controllers format service responses into consistent HTTP responses

## Adding New Controllers

When adding a new controller:

1. Create a new file with the naming convention `feature-name.controller.ts`
2. Import necessary services
3. Define controller methods that handle specific operations
4. Export the controller (typically as a singleton instance)
5. Update this README to document the new controller