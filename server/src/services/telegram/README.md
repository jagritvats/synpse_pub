# Telegram Service
This service integrates the Telegram Bot API with the Synapse AI system, allowing users to interact with the AI through Telegram.

## Features

- Seamless integration with the AI service using the same `processUserMessage` method as the chat routes
- Persistent conversation sessions with memory and context
- User identification and session management
- Command handling for common operations

## Commands

- `/start` - Start or resume a conversation
- `/help` - Show available commands
- `/clear` - Clear conversation history
- `/remember` - Store the last message as a memory
- `/memories` - Show your recent memories
- `/newsession` - Start a new conversation session

## Implementation Details

The Telegram service uses the Grammy library to interact with the Telegram Bot API. It maintains session state for each user, including:

- User ID (prefixed with `telegram_` if not linked to a system user)
- Session ID (linked to the chat session manager)
- Message history
- Last interaction time

When a user sends a message, the service:

1. Identifies the user and retrieves or creates a session
2. Processes the message using `aiService.processUserMessage()`
3. Stores the message and response in both the Telegram session and the chat session manager
4. Returns the AI's response to the user

## Integration with AI Service

The Telegram service uses the same `processUserMessage` method as the chat routes, ensuring consistent behavior across different interfaces. This integration provides:

- Shared memory and context between web and Telegram interfaces
- Consistent conversation history
- Same AI capabilities and features

## Configuration

To use the Telegram service, set the `TELEGRAM_BOT_TOKEN` environment variable with your bot token from the [BotFather](https://t.me/botfather).

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

The service will automatically start when the Express server starts if the token is provided.

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather and use the `/newbot` command
3. Follow the prompts to create your bot
   - Provide a name for your bot
   - Provide a username for your bot (must end with "bot")
4. BotFather will provide a token for your bot - save this token

### 2. Configure Environment Variables

Add the following variables to your `.env` file:

```
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_BOT_USERNAME=YourBotUsername
```

### 3. Start the Bot

The bot will start automatically when the Express server starts if the token is provided in the environment variables.

You can also control the bot through the API endpoints:

```
POST /api/telegram/start - Start the bot (admin only)
POST /api/telegram/stop - Stop the bot (admin only)
```

## Usage

### Available Commands

The Telegram bot responds to the following commands:

- `/start` - Begin a conversation with the AI assistant
- `/help` - Show available commands
- `/clear` - Clear conversation history
- `/remember` - Store the last message as a memory
- `/memories` - Show your recent memories

### Linking Your Account

To link your Telegram account with your Synapse account:

1. Log in to your Synapse account on the web app
2. Go to Profile > Connected Accounts
3. Click "Connect Telegram"
4. Send the provided code to your bot
5. Your accounts will be linked

Alternatively, you can use the API endpoint:

```
POST /api/telegram/link
Body: { "telegramUserId": "your-telegram-user-id" }
```

## Development Notes

### Architecture

The Telegram integration consists of:

- `telegram-bot.service.ts` - Core service that interacts with the Telegram API
- `telegram.controller.ts` - Express routes for managing the bot

### AI Integration

The bot uses the same AI service as the rest of the application, configured to use Ollama as the primary LLM provider with fallback to Google's Gemini if needed.

### Session Management

User sessions are stored in memory with the grammy session middleware. In a production environment, you should implement a persistent session store.

### Security Considerations

- Only admins can start/stop the bot
- Users can only interact with their own data
- Message history is limited to prevent token overflow
- All interactions are logged for monitoring

## Extending the Bot

To add new commands or features:

1. Modify the `setupCommandHandlers` or `setupMessageHandlers` methods in `telegram-bot.service.ts`
2. Add any necessary controller methods in `telegram.controller.ts`

## Troubleshooting

Common issues:

- **Bot not responding**: Ensure the bot is started and the token is correct
- **Authentication errors**: Check your Telegram bot token
- **Rate limiting**: Telegram enforces rate limits for bots (20 messages per minute to the same chat)
- **Connection errors**: Verify your server has internet access and can reach the Telegram API

For more assistance, check the Telegram Bot API documentation or grammy library documentation.
