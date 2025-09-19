# Synapse Express Server
This is the Express.js backend for the Synapse AI companion application. It provides the API endpoints for chat, user management, and AI interactions.

## Features

- **AI Companion**: Conversational AI with contextual awareness
- **Memory Management**: Short, medium, and long-term memory for personalized interactions
- **Context Awareness**: Time of day and weather-based context
- **Background Processing**: Scheduled tasks for news scanning, interest-based content, and memory consolidation
- **User Management**: Authentication, profiles, and preferences
- **Social Integration**: Connect with social media platforms and productivity tools
- **Telegram Bot**: Interact with Synapse AI through Telegram messenger platform with full memory and context integration
- **Local AI Processing**: Uses Ollama as default for AI generation with fallback options
- **Asynchronous Processing**: Uses Kafka for asynchronous processing

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Ollama (for local AI processing)
- Kafka (optional, for asynchronous processing)

### Installation

1. Clone the repository
2. Navigate to the express-server directory
3. Install dependencies:

```bash
npm install
# or
yarn install
```

4. Create a `.env` file in the root directory with the following variables:

```
PORT=5000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key

# AI Services
OLLAMA_BASE_URL=http://localhost:11434
GOOGLE_API_KEY=your-google-api-key (optional for fallback)

# MongoDB (for persistent storage)
MONGODB_URI=mongodb://localhost:27017/synapse

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=YourBotUsername

# Kafka (optional, for asynchronous processing)
ENABLE_KAFKA=true
```

### Ollama Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the models you want to use:

```bash
ollama pull llama3
ollama pull mistral
```

3. Start the Ollama server:

```bash
ollama serve
```

### Development

To start the development server:

```bash
npm run dev
# or
yarn dev
```

The server will be available at http://localhost:5000.

### Production Build

To build for production:

```bash
npm run build
# or
yarn build
```

To start the production server:

```bash
npm start
# or
yarn start
```

## API Endpoints

### Health Check

- `GET /api/health`: Check server status

### Authentication

- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Login and get JWT token
- `GET /api/auth/me`: Get current user info

### Chat

- `POST /api/chat/sessions`: Create a new chat session
- `GET /api/chat/sessions`: Get all chat sessions for a user
- `GET /api/chat/sessions/:sessionId`: Get a specific chat session
- `DELETE /api/chat/sessions/:sessionId`: Delete a chat session
- `POST /api/chat/sessions/:sessionId/message`: Send a message in a chat session
- `GET /api/chat/sessions/:sessionId/typing`: SSE endpoint for typing status
- `GET /api/chat/test-conversation`: Test endpoint for conversation continuity

### Users

- `GET /api/users/profile`: Get user profile
- `PUT /api/users/profile`: Update user profile
- `PUT /api/users/preferences`: Update user preferences
- `PUT /api/users/interests`: Update user interests
- `POST /api/users/social-connections`: Add or update social connection
- `DELETE /api/users/social-connections/:platform`: Remove social connection

### Notes

- `GET /api/notes`: Get all notes
- `POST /api/notes`: Create a new note
- `GET /api/notes/:id`: Get a specific note
- `PUT /api/notes/:id`: Update a note
- `DELETE /api/notes/:id`: Delete a note
- `GET /api/notes/search`: Search notes by content
- `GET /api/notes/tag/:tag`: Get notes by tag
- `GET /api/notes/tags`: Get all user tags

### Memories

- `GET /api/memories`: Get all memories
- `POST /api/memories`: Create a new memory
- `GET /api/memories/:id`: Get a specific memory
- `PUT /api/memories/:id`: Update a memory
- `DELETE /api/memories/:id`: Delete a memory
- `GET /api/memories/search`: Search memories by text
- `GET /api/memories/semantic-search`: Semantic search in memories
- `GET /api/memories/summary`: Generate summary from memories

### Triggers

- `GET /api/triggers`: Get all triggers
- `POST /api/triggers`: Create a new trigger
- `GET /api/triggers/:id`: Get a specific trigger
- `PUT /api/triggers/:id`: Update a trigger
- `DELETE /api/triggers/:id`: Delete a trigger
- `POST /api/triggers/:id/activate`: Activate a trigger
- `POST /api/triggers/:id/deactivate`: Deactivate a trigger
- `POST /api/triggers/:id/execute`: Manually execute a trigger

### Telegram Bot

- `POST /api/telegram/start`: Start the Telegram bot (admin only)
- `POST /api/telegram/stop`: Stop the Telegram bot (admin only)
- `POST /api/telegram/link`: Link a Telegram user to a system user
- `POST /api/telegram/send`: Send a message to a Telegram user
- `GET /api/telegram/status`: Get Telegram bot status

## Architecture

The server follows a modular architecture with:

- **Routes**: API endpoint definitions
- **Controllers**: Request handling and response formatting
- **Services**: Business logic and external integrations
- **Models**: Data structures and interfaces
- **Middleware**: Request processing and authentication

## Telegram Bot Integration

The Synapse AI companion can be accessed through Telegram messaging platform. The Telegram service uses the same `processUserMessage` method as the chat routes, ensuring consistent behavior across different interfaces. This integration provides:

- Shared memory and context between web and Telegram interfaces
- Consistent conversation history
- Same AI capabilities and features

For setup and usage instructions, see [Telegram Bot Integration](./src/services/telegram/README.md).

## Background Tasks

The server includes a scheduler for background tasks:

- Hourly news scanning
- Daily weather summaries
- Interest-based content scanning
- Memory consolidation

## AI Integration

Synapse uses Ollama as the primary AI provider for local inference, with fallback to Google's Gemini API when needed. The AI service automatically handles message formatting, context management, and provider selection based on availability and user preferences.

## Future Enhancements

- Enhanced database integration (MongoDB)
- Vector storage for semantic memory
- Additional AI model integrations
- Enhanced social media integrations
- Productivity tool connections (Notion, etc.)
- Expanded memory management
- Voice and image processing capabilities

## Asynchronous Processing with Kafka

The server supports asynchronous message processing using Kafka. This allows for better scalability and responsiveness, especially for long-running operations.

### Kafka Integration

Kafka is used for asynchronous processing of various operations, including:

- Chat message processing
- User summarization
- Context analysis
- Memory operations
- Session operations
- Activity operations
- Action operations

### Message Flow

1. A client request arrives at an API endpoint
2. The request is validated and a placeholder response is sent if appropriate
3. The operation is queued in Kafka for asynchronous processing
4. A consumer processes the message and performs the required operation
5. Results are stored in the database and/or sent to clients via SSE (Server-Sent Events)

### Configuration

Kafka integration can be enabled or disabled using the `ENABLE_KAFKA` environment variable:

```
ENABLE_KAFKA=true  # Enable Kafka (default)
ENABLE_KAFKA=false # Disable Kafka and use synchronous processing
```

### Kafka Topics

The following Kafka topics are used:

- `chat-messages`: For processing user chat messages
- `summarization`: For generating user and session summaries
- `context-analysis`: For analyzing message context and generating companion thinking
- `memory-operations`: For creating, updating, querying, and deleting memories
- `session-operations`: For creating, updating, and deleting sessions
- `activity-operations`: For creating, updating, processing, and deleting activities
- `action-operations`: For processing actions

### Setup

To set up Kafka:

1. Make sure Kafka is installed and running
2. Configure Kafka connection details in the `.env` file
3. Run the Kafka setup script: `./kafka-setup.sh`

### Fallback Behavior

If Kafka is disabled or unavailable, the system falls back to synchronous processing. This ensures that the application continues to function even without Kafka.

## API Routes

### Main API Routes

- `/api/auth`: Authentication endpoints
- `/api/users`: User management
- `/api/chat`: Chat functionality
- `/api/memories`: Memory management
- `/api/actions`: Action management
- `/api/context`: Context management
- `/api/scheduler`: Scheduled tasks
- `/api/social`: Social features
- `/api/telegram`: Telegram integration

### Development API Routes

- `/api/dev/ai-parameters`: AI configuration
- `/api/dev/companion-thinking`: Companion thinking analysis
- `/api/dev/summary`: User and session summarization

## Contributing

Please see CONTRIBUTING.md for guidelines on how to contribute to this project.

## License

This project is licensed under the [MIT License](LICENSE).
