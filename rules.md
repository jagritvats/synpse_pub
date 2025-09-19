# Development Rules and Common Patterns
## Logging

Use the Logger service for all logging operations. This ensures consistent log formatting across the application.

```typescript
import { loggerFactory } from "../utils/logger.service";

// Create a logger for your service
const logger = loggerFactory.getLogger("YourServiceName");

// Use the logger methods
logger.info("This is an info message");
logger.warn("This is a warning message");
logger.error("Error occurred", error);
logger.debug("Debug information", debugData);
```

## Service Pattern

Services should follow the singleton pattern with a consistent export approach:

```typescript
class YourService {
  // Service implementation
}

// Export a singleton instance
export const yourService = new YourService();
```

## Session Management & Chat Interaction

All primary user chat interactions (handling messages, managing sessions, generating AI responses) should be processed through the `EnhancedChatService`.
This service acts as the central orchestrator, ensuring consistent session handling (persistent and in-memory), context integration, memory management, and AI response generation across different interfaces (e.g., web API, Telegram bot).

Key responsibilities of `EnhancedChatService`:

- Receiving user messages along with user ID and optional session ID.
- Finding the correct persistent user session (`SessionService`) or ensuring the global session exists.
- Initializing/updating the in-memory chat session state (`ChatSessionManager`).
- Adding user messages to the session.
- Calling the `AIService` to generate responses.
- Saving messages to the database.
- Performing post-processing like memory extraction and title generation.

Example usage in a consumer (e.g., controller or bot service):

```typescript
import { enhancedChatService } from "../services/enhanced-chat.service";

try {
  const userId = // ... get user ID ...
  const messageText = // ... get message text ...
  const sessionId = // ... get optional session ID context ...
  const clientMessageId = // ... generate a unique ID for this message ...

  // Process the message via the central service
  const assistantMessage = await enhancedChatService.handleMessage(
    userId,
    messageText,
    sessionId,
    clientMessageId
    // Optional config object can be passed here
  );

  // Use the assistantMessage content to reply to the user
  replyToUser(assistantMessage.content);

} catch (error) {
  logger.error("Failed to process user message:", error);
  // Handle error appropriately (e.g., send error message to user)
}
```

This approach centralizes the complex chat flow logic, making controllers and other consumers simpler and focused on interface-specific tasks (like handling HTTP requests/responses or Telegram API interactions).

## Error Handling

Always use try/catch blocks for async operations and log errors appropriately:

```typescript
try {
  // Async operation
} catch (error) {
  logger.error("Operation failed", error);
  // Handle the error appropriately
}
```

## Code Organization

- Keep related functionality in dedicated services
- Use interfaces to define clear contracts between components
- Follow the dependency injection pattern where appropriate
- Extract common functionality into shared services

## Prompt Construction

- When building system prompts for the AI (`ContextService.buildSystemPromptForAI`), relevant memories are included.
- The total token count for these memories is limited (currently around 1000 tokens, estimated via character count) to prevent overly large prompts.
- Memories are fetched based on relevance to the current query and added until the token limit is approached.

## Feature: User-Defined Companion Goals

- **Description**: Allows users to specify goals they want the AI companion to focus on or help them achieve. These are separate from the companion's internal operational goals.
- **Implementation**:
  - **Frontend**: A form is added to the Settings > Prompt page (`src/app/settings/prompt/page.tsx` using `src/components/settings/user-defined-goals-form.tsx`).
  - **Backend Model**: `userDefinedGoals: IGoal[]` added to `ICompanionState` in `server/src/models/companion-state.model.ts`.
  - **Backend Service**: `setUserDefinedGoals` method added to `server/src/services/companion-state.service.ts`.
  - **Backend API**: `PUT /api/companion-state/user-goals` endpoint added in `server/src/controllers/dev/companion-state.controller.ts`.
  - **Context Integration**: `buildSystemPromptForAI` in `server/src/services/context.service.ts` now includes a distinct section `## User-Defined Goals for Companion` in the system prompt.
- **Notes**:
  - The frontend component currently uses mock data; API integration functions (`getUserDefinedGoals`, `updateUserDefinedGoals`) need implementation in the relevant frontend API library.
  - User goals are displayed alongside internal goals in the context prompt, clearly labeled.

Login Must be implemented at backend with mongodb
Prefer shadcn components for FE

# Project Rules & Conventions

## General

1.  **File Naming:** Use kebab-case (e.g., `chat-view.tsx`, `api-client.ts`).
2.  **Component Naming:** Use PascalCase (e.g., `ChatView`, `UserProfile`).
3.  **Variable/Function Naming:** Use camelCase (e.g., `fetchMessages`, `isLoading`).
4.  **Types/Interfaces:** Use PascalCase (e.g., `type Thread`, `interface IUser`). Prefix interfaces with `I` only if necessary to avoid naming conflicts (legacy convention, prefer distinct names).
5.  **Imports:** Group imports: React/Next -> External Libraries -> Internal Components/Modules -> Types -> Styles. Sort alphabetically within groups.
6.  **Styling:** Primarily use Tailwind CSS. Use `components.json` for Shadcn UI components. Custom CSS should be minimal and scoped. Theme colors TBD (currently variations of amber/gray).
7.  **Comments:** Comment complex logic, non-obvious code, or TODOs. Avoid commenting obvious code. Use JSDoc for function/component props where needed.
8.  **Error Handling:** Implement robust error handling for API calls, state updates, and potential runtime issues. Use `try...catch` and provide user feedback (e.g., toasts).
9.  **Logging:** Use `console.log` for debugging during development. Add context (e.g., `[ComponentName] Message`). Consider removing or reducing logs for production builds.
10. **State Management:** Use React Context (`useAuth`) for global state (auth). Use local component state (`useState`, `useReducer`) for UI/component-specific state. Avoid prop drilling excessively.
11. **API Client:** Use the centralized `apiClient` (`src/lib/api-client.ts`) for all backend communication.
12. **Code Formatting:** Use Prettier/ESLint (config provided) for consistent formatting. Run `npm run lint` and `npm run format`.
13. **Progress Tracking:** Update `progress.md` with completed tasks, ongoing work, and identified issues.
14. **Rules:** Update this file (`rules.md`) with any new conventions or decisions.
15. **Environment Variables:** Use `.env.local` for local secrets/config. Prefix frontend-accessible vars with `NEXT_PUBLIC_`.
16. **Server/Client Components:** Use `'use client'` directive where necessary (hooks, event handlers). Prefer Server Components for data fetching where possible.
17. **Authentication Handling:**
    - Use `useAuth` hook for accessing auth state (`user`, `isAuthenticated`, `isLoading`).
    - Redirect logic should ideally be handled within the `AuthContext` (`login`, `logout`) or centrally.
    - Pages/components requiring authentication should check `!isAuthLoading && !isAuthenticated` and redirect to `/login` if necessary.
    - Ensure components correctly react to `isLoading` state changes after login/logout/session checks.

## Backend (Express - `server/src`)

1.  **Structure:** Follow standard MVC-like pattern (models, routes, controllers, services, middlewares).
2.  **Validation:** Use `express-validator` or similar for input validation in routes/controllers.
3.  **Authentication:** Use JWT for stateless authentication. Middleware (`requireAuth`) to protect routes.
4.  **Database:** Mongoose ODM for MongoDB interaction. Define schemas in `models/`.
5.  **Error Handling:** Centralized error handling middleware. Send consistent error responses.

## Frontend (Next.js - `src`)

1.  **Routing:** Use Next.js App Router (`app/` directory).
2.  **UI Library:** Shadcn UI built on Radix UI and Tailwind CSS.
3.  **Forms:** Consider using `react-hook-form` for complex forms.
4.  **Data Fetching:** Use `useEffect` with `apiClient` for client-side fetching. Explore Next.js patterns (Server Components, Route Handlers) for optimized fetching. Use SSE for real-time updates where appropriate.

- All services that depend on a database connection (e.g., schedulers, background jobs, session fetchers) **must** be started only after the database connection is confirmed. Do not start these services before the DB is ready, to avoid fallback to in-memory or degraded modes.

- The Telegram bot must auto-register users in the users collection (with username, email, password, and display name) and auto-start sessions for any incoming message, not just /start. This ensures scheduled and first-time messages work without requiring manual /start from the user.
