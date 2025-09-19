// import { Ollama } from "@langchain/ollama";
// import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
// import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  ChatMessageModel,
  MessageRole,
  MessageStatus,
} from "../models/chat.model";
import { contextService } from "./context.service";
import { memoryService, MemoryType, MemoryCategory } from "./memory.service";
import { actionManager } from "./action-manager.service";
import { companionThinkingService } from "./companion-thinking.service";

import { v4 as uuidv4 } from "uuid";
import MessageModel from "../models/message.model";
import { OpenAI } from "openai";
import { chatSessionManager } from "./chat-session.service";
import { sessionService } from "./session.service";
import { ISession } from "../models/session.model";
import { modelService, LLMProvider, AIParameters } from "./model.service";
import { MESSAGE_TYPE_PROMPT } from "../constants/prompts";
import { IActivity } from "../models/activity.model";
import { ActivityType } from "../models/activity.model";
import {
  IRoleplayState,
  IGameState,
  IBrainstormState,
} from "../models/activity.model";
import { modelEnum } from "../constants/models";

// Simple logger class
class Logger {
  info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

class AIService {
  private logger: Logger = new Logger();
  private userSettings: Map<string, AIParameters> = new Map();

  private historyTokenLimit: number = 1000;

  // --- Feature Flags ---
  private enableActionProcessing: boolean = true;
  private enableInsightExtraction: boolean = false;
  // --- End Feature Flags ---

  constructor() {
    this.logger.info("[AIService] Initialized.");
    this.logger.info(
      `Action Processing Enabled: ${this.enableActionProcessing}`
    );
    this.logger.info(
      `Insight Extraction Enabled: ${this.enableInsightExtraction}`
    );
  }

  /**
   * Get the default parameters for a user (delegates default model selection to ModelService).
   * Note: ModelService now handles default *model names*. AIService handles default *parameters* like temp.
   */
  private getDefaultParameters(userId?: string): AIParameters {
    return {
      model: modelEnum.sth,
      temperature: 1.2,
      max_tokens: 1000,
    };
  }

  /**
   * Get parameters for a specific user, merging with defaults.
   */
  getParameters(userId?: string): AIParameters {
    const defaults = this.getDefaultParameters(userId);
    if (userId && this.userSettings.has(userId)) {
      return { ...defaults, ...this.userSettings.get(userId)! };
    }
    return defaults;
  }

  /**
   * Set parameters for a specific user.
   */
  setParameters(
    userId: string,
    parameters: Partial<AIParameters>
  ): AIParameters {
    const currentSettings = this.getParameters(userId);
    const updatedSettings = { ...currentSettings, ...parameters };
    this.userSettings.set(userId, updatedSettings);
    this.logger.info(
      `[AIService] Updated AI parameters for user ${userId}:`,
      updatedSettings
    );
    return updatedSettings;
  }

  /**
   * Generate a response using the conversation stream approach.
   * Delegates model retrieval to ModelService.
   */
  async generateResponse(
    formattedMessages: Array<{ role: string; content: string }>,
    parameters: AIParameters,
    systemPrompt?: string,
    userId?: string
  ): Promise<{
    text: string;
    provider: LLMProvider;
  }> {
    const provider =
      parameters.provider ||
      modelService.getProviderFromModel(parameters.model);
    const effectiveParams = { ...parameters, provider };

    this.logger.info("[AIService] Generate response called with:", {
      messageCount: formattedMessages.length,
      hasUserId: !!userId,
      hasSystemPrompt: !!systemPrompt,
      provider: effectiveParams.provider,
      model: effectiveParams.model,
    });

    try {
      if (
        effectiveParams.provider === LLMProvider.OLLAMA ||
        effectiveParams.provider === LLMProvider.GOOGLE
      ) {
        const chatModel = modelService.getChatModel(effectiveParams);

        const messages: (SystemMessage | HumanMessage | AIMessage)[] = [];
        if (systemPrompt) {
          messages.push(new SystemMessage(systemPrompt));
          messages.push(new SystemMessage(MESSAGE_TYPE_PROMPT));
        }
        for (const message of formattedMessages) {
          if (message.role === "system" && systemPrompt) continue;
          if (message.role === "user")
            messages.push(new HumanMessage(message.content));
          else if (message.role === "assistant")
            messages.push(new AIMessage(message.content));
          else if (message.role === "system")
            messages.push(new SystemMessage(message.content));
        }

        this.logger.debug(
          `[AIService] Sending ${messages.length} messages to ${effectiveParams.provider} model ${effectiveParams.model}:`,
          JSON.stringify(
            messages.map((m) => ({
              role: m._getType(),
              content:
                typeof m.content === "string"
                  ? m.content
                  : JSON.stringify(m.content),
            })),
            null,
            2
          )
        );

        const response = await chatModel.invoke(messages);
        let responseText = "";
        if (response) {
          responseText = String(response.content || response);
        } else {
          this.logger.warn(
            `[AIService] Received empty response from ${effectiveParams.provider} model.`
          );
          throw new Error(
            `Empty response from ${effectiveParams.provider} model`
          );
        }

        this.logger.debug(
          `[AIService] Received ${effectiveParams.provider} response:`,
          responseText.slice(0, 100) + "..."
        );

        return {
          text: responseText,
          provider: effectiveParams.provider,
        };
      } else if (
        effectiveParams.provider === LLMProvider.OPENAI &&
        modelService.isOpenAIEnabled()
      ) {
        const openaiClient = modelService.getOpenAIClient();
        if (!openaiClient)
          throw new Error("OpenAI client not available despite being enabled.");

        const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
          [];
        if (systemPrompt)
          openAiMessages.push({ role: "system", content: systemPrompt });
        formattedMessages.forEach((msg) => {
          if (msg.role === "user" || msg.role === "assistant") {
            openAiMessages.push({ role: msg.role, content: msg.content });
          }
        });

        this.logger.debug(
          `[AIService] Sending ${openAiMessages.length} messages to OpenAI model ${effectiveParams.model}`
        );

        const completion = await openaiClient.chat.completions.create({
          model: effectiveParams.model,
          messages: openAiMessages,
          temperature: effectiveParams.temperature,
          max_tokens: effectiveParams.max_tokens,
          top_p: effectiveParams.top_p,
          frequency_penalty: effectiveParams.frequency_penalty,
          presence_penalty: effectiveParams.presence_penalty,
          stop: effectiveParams.stop_sequences,
        });

        const responseText = completion.choices[0]?.message?.content || "";
        this.logger.debug(
          "[AIService] Received OpenAI response:",
          responseText.slice(0, 100) + "..."
        );

        return {
          text: responseText,
          provider: LLMProvider.OPENAI,
        };
      } else {
        throw new Error(
          `Unsupported or disabled provider: ${effectiveParams.provider}`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `[AIService] Error generating AI response with ${effectiveParams.provider} (${effectiveParams.model}):`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate a response for auxiliary tasks like insight extraction or summarization.
   * Uses ModelService to get the appropriate model based on options.
   */
  public async generateAuxiliaryResponse(
    prompt: string,
    options: {
      temperature?: number;
      max_tokens?: number;
      model?: string; // e.g., "gemma3:4b", "gemini-pro"
      provider?: LLMProvider;
    } = {},
    systemPrompt?: string,
    userId?: string // Optional userId for context or logging
  ): Promise<{
    text: string;
    // We might not accurately track token usage here unless the model returns it
  }> {
    // Determine model and parameters
    const modelName = options.model || modelEnum.gemma3o4b; // Default small model for auxiliary tasks
    const auxParams: AIParameters = {
      model: modelName,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 150,
      provider: options.provider, // Pass provider hint if available
    };

    this.logger.info(
      `[AIService] Generating auxiliary response with model ${modelName}`
    );

    try {
      // Handle different providers appropriately
      const provider =
        auxParams.provider || modelService.getProviderFromModel(modelName);

      let responseText = "";

      if (provider === LLMProvider.OPENAI && modelService.isOpenAIEnabled()) {
        const openaiClient = modelService.getOpenAIClient()!;
        const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
          [];
        if (systemPrompt)
          openAiMessages.push({ role: "system", content: systemPrompt });
        openAiMessages.push({ role: "user", content: prompt });

        const completion = await openaiClient.chat.completions.create({
          model: auxParams.model,
          messages: openAiMessages,
          temperature: auxParams.temperature,
          max_tokens: auxParams.max_tokens,
        });
        responseText = completion.choices[0]?.message?.content || "";
      } else if (
        provider === LLMProvider.OLLAMA ||
        provider === LLMProvider.GOOGLE
      ) {
        // Get model from ModelService for Langchain compatible models
        const auxChatModel = modelService.getChatModel(auxParams);
        const messages = [
          new SystemMessage(
            systemPrompt ||
              "You are a helpful assistant performing a specific text analysis task."
          ),
          new HumanMessage(prompt),
        ];
        const response = await auxChatModel.invoke(messages);
        responseText = String(response.content || response);
      } else {
        throw new Error(
          `Unsupported provider ${provider} for auxiliary response.`
        );
      }

      this.logger.info(
        `[AIService] Auxiliary response generated (${responseText.length} chars).`
      );
      return { text: responseText };
    } catch (error) {
      this.logger.error(
        `[AIService] Error generating auxiliary response with ${modelName}:`,
        error
      );
      return { text: "[Error generating auxiliary response]" }; // Return error indicator
    }
  }

  // Define default parameters for insight extraction
  private defaultInsightParams: {
    model: string;
    temperature: number;
    max_tokens: number;
  } = {
    model: modelEnum.gemma3o4b, // Default model for insights
    temperature: 0.4,
    max_tokens: 200,
  };

  /**
   * Extracts insights from AI response text and stores them in memory.
   */
  private async _extractAndStoreInsights(
    userId: string,
    responseText: string,
    parameters: AIParameters, // Original request parameters (e.g., for metadata)
    activityId?: string // Optional activity ID
  ): Promise<void> {
    if (!this.enableInsightExtraction) {
      this.logger.debug("Insight extraction disabled, skipping.");
      return;
    }
    this.logger.debug(`Extracting insights for user ${userId}...`);

    // 1. Construct the prompt for insight extraction
    const insightPrompt = `
Extract key insights, facts, or preferences about the user OR stated by the user from the following text segment:
--- TEXT START ---
${responseText}
--- TEXT END ---

Format each distinct insight as a separate line. Focus on information that would be useful to remember for future interactions (e.g., preferences, facts about the user, important statements made by the user). Do not extract questions asked by the user. If no clear insights are found, respond ONLY with "No insights found."
Insights:`;

    try {
      // 2. Call the auxiliary generation function with default insight parameters
      const insightApiResponse = await this.generateAuxiliaryResponse(
        insightPrompt,
        this.defaultInsightParams, // Use the defined defaults
        "You are an expert AI assistant specialized in identifying key user facts and preferences from text. Respond ONLY with the extracted insights or 'No insights found.'.", // Specific system prompt
        userId
      );

      const rawInsightsText = insightApiResponse.text;

      // 3. Parse and filter insights
      if (
        !rawInsightsText ||
        rawInsightsText === "[Error generating auxiliary response]"
      ) {
        this.logger.warn(
          `Insight generation failed or returned error for user ${userId}.`
        );
        return;
      }

      const insights = rawInsightsText
        .split("\n")
        .map((line) => line.trim().replace(/^- /, ""))
        .filter(
          (line) =>
            line &&
            line.toLowerCase() !== "no insights found." &&
            line.length > 10 // Slightly longer minimum length for insights
        );

      // 4. Store each valid insight as a memory
      if (insights.length > 0) {
        this.logger.info(
          `Found ${insights.length} potential insights for user ${userId}.`
        );
        for (const insight of insights) {
          // TODO: Make memory parameters configurable (type, importance, category)
          await memoryService.addMemory(
            userId,
            insight,
            MemoryType.MEDIUM_TERM,
            "ai-generated", // Source identifier
            {
              source: "response-analysis",
              modelUsedForInsight: this.defaultInsightParams.model,
              originalResponseModel: parameters.model,
              ...(activityId && { activityId }),
            }, // Metadata
            7, // Importance score (configurable)
            MemoryCategory.FACT // Category (configurable)
          );
        }
        this.logger.info(
          `[AIService] Stored ${insights.length} insights as memories for user ${userId}.`
        );
      } else {
        this.logger.debug(`No insights found in response for user ${userId}.`);
      }
    } catch (insightError) {
      this.logger.error(
        `[AIService] Error during insight extraction/storage for user ${userId}:`,
        insightError
      );
      // Don't re-throw, just log the error
    }
  }

  /**
   * Process a user message text within a given session context,
   * generate an AI response, handle persistence FOR THE ASSISTANT MESSAGE,
   * and manage memory addition FOR THE ASSISTANT MESSAGE.
   * Assumes the user message is already handled (added/saved) by the caller.
   */
  async processUserMessage(
    userId: string,
    sessionId: string,
    messageText: string, // Keep receiving the raw text for context/memory
    clientMessageId?: string, // ID of the already added user message
    activeActivity?: IActivity | null // Pass the active activity
  ): Promise<{
    // Removed userMessage from return type
    assistantMessage: ChatMessageModel;
    actionResults?: any;
  }> {
    this.logger.info(
      `AI Processing for session ${sessionId}, user ${userId}. User msg ID: ${clientMessageId}`
    );

    const session = chatSessionManager.getSession(sessionId);
    if (!session) {
      this.logger.error(
        `Session ${sessionId} not found in ChatSessionManager during AIService.processUserMessage`
      );
      throw new Error(
        `Session ${sessionId} not found in ChatSessionManager. Ensure EnhancedChatService prepares the session.`
      );
    }

    // ---- REMOVED User Message Creation/Addition Block ----
    // const userMessage = new ChatMessageModel({ ... });
    // chatSessionManager.addMessage(sessionId, userMessage);
    // this.logger.debug(`Added user message ${userMessage.id}`);
    // ---- END REMOVED Block ----

    let aiResponseContent: string;
    let responseProvider: LLMProvider;
    let assistantMessageStatus = MessageStatus.PROCESSING;
    let actionResults: Record<string, any> = {};
    let aiError: Error | null = null;

    const parameters = this.getParameters(userId);

    try {
      const startTime = Date.now();

      // Fetch history directly from the session manager (which should include the user message added by caller)
      const fullHistoryForPrompt = session.chatHistory;

      // Instead of processing thinking synchronously, we'll inject the latest thinking
      // (if available) and just get the basic context for now

      // Ensure AI thinking is injected before building the prompt
      if (companionThinkingService.isEnabled()) {
        // No need to await this, just get existing thinking if available
        await companionThinkingService.injectLatestThinking(userId, sessionId);
        this.logger.debug(
          `Latest AI thinking injected for user ${userId}, session ${sessionId}`
        );
      }

      // Build memory query using the provided messageText and recent history
      let memoryQuery = messageText;
      if (fullHistoryForPrompt.length > 1) {
        const recentSnippet = fullHistoryForPrompt
          .slice(-3)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");
        memoryQuery = `${messageText}\n\nRecent Context:\n${recentSnippet}`;
      }

      let systemPrompt = await contextService.buildSystemPromptForAI(
        userId,
        undefined,
        memoryQuery,
        activeActivity
      );

      // Enhance system prompt if an activity is active
      if (activeActivity) {
        systemPrompt += `\n\n## Current Activity: ${activeActivity.name} (${activeActivity.type})\n`;
        if (activeActivity.goal) {
          systemPrompt += `Activity Goal: ${activeActivity.goal}\n`;
        }
        // Include relevant state details based on type
        if (activeActivity.type === ActivityType.ROLEPLAY) {
          const rpState = activeActivity.state.data as IRoleplayState;
          systemPrompt +=
            await contextService._formatRoleplayStateForPrompt(rpState);
          // Add more details like characters, setting, plot if needed
        } else if (activeActivity.type === ActivityType.GAME) {
          const gameState = activeActivity.state.data as IGameState;
          systemPrompt += `Game State (${gameState.gameType}): Current Player: ${gameState.currentPlayer}. Winner: ${gameState.winner || "None"}. Board/Score/etc. (details in context).\n`;
        } else if (activeActivity.type === ActivityType.BRAINSTORM) {
          const bsState = activeActivity.state.data as IBrainstormState;
          systemPrompt += `Brainstorm State: Topic: ${bsState.topic}. Phase: ${bsState.phase}. Ideas generated: ${bsState.ideas?.length || 0}.\n`;
        }
        systemPrompt += `Focus your response on continuing the activity unless the user clearly indicates otherwise.\n`;

        // Try to get latest thinking record for this session to include in activity prompt
        try {
          const thinkingInfo =
            await companionThinkingService.getSessionCacheInfo(sessionId);
          if (thinkingInfo && thinkingInfo.insight) {
            systemPrompt += `\n## Your current thinking about the user:\n`;
            systemPrompt += `Analysis: ${thinkingInfo.insight.analysis}\n`;
            systemPrompt += `Subconscious: ${thinkingInfo.insight.subconscious}\n`;
            systemPrompt += `Strategy: ${thinkingInfo.strategy}\n`;

            this.logger.debug(
              `Added thinking record info to activity prompt for session ${sessionId}`
            );
          }
        } catch (err) {
          this.logger.warn(
            `Failed to add thinking record to activity prompt: ${err}`
          );
        }
      }

      // Format history for the model
      const formattedHistory = contextService.formatMessageHistory(
        fullHistoryForPrompt, // Use the history from chatSessionManager
        this.historyTokenLimit
      );

      // Generate the AI response
      const aiResult = await this.generateResponse(
        formattedHistory,
        parameters,
        systemPrompt,
        userId
      );
      const endTime = Date.now();
      this.logger.info(
        `AI response generated in ${endTime - startTime}ms using ${aiResult.provider}.`
      );

      aiResponseContent = aiResult.text;
      responseProvider = aiResult.provider;
      assistantMessageStatus = MessageStatus.COMPLETED;

      // Process suggested actions if needed
      if (this.enableActionProcessing) {
        // Action processing might need activity context too, but ActionManager doesn't support it yet.
        // For now, keep it based on user text.
        actionResults = await this._processSuggestedActions(
          userId,
          messageText,
          parameters
        );
      }
    } catch (error: any) {
      this.logger.error("Error during AI processing pipeline:", error);
      aiError = error;
      aiResponseContent =
        "Sorry, I encountered an issue generating a response.";
      responseProvider =
        parameters.provider ||
        modelService.getProviderFromModel(parameters.model) ||
        LLMProvider.OLLAMA;
      assistantMessageStatus = MessageStatus.ERROR;
    }

    // Create the final assistant message
    const finalAssistantContent =
      typeof aiResponseContent === "string" && aiResponseContent.trim()
        ? aiResponseContent
        : "Sorry, I couldn't generate a valid response.";
    const assistantMessage = new ChatMessageModel({
      id: uuidv4(), // Generate new ID for assistant message
      sessionId,
      role: MessageRole.ASSISTANT,
      content: finalAssistantContent,
      status: assistantMessageStatus,
      metadata: {
        provider: responseProvider,
        error: aiError ? true : undefined,
        errorMessage: aiError ? aiError.message : undefined,
        ...(Object.keys(actionResults).length > 0 && { actionResults }),
        userMessageId: clientMessageId, // Link back to the user message if ID was provided
      },
      timestamp: new Date().toISOString(),
    });

    // Add the assistant message to memory here (if completed)
    if (assistantMessage.status === MessageStatus.COMPLETED) {
      this.addMessageToMemory(
        userId,
        sessionId,
        assistantMessage,
        activeActivity
      );
    }

    // Process companion thinking asynchronously AFTER returning the message
    // This way, the message can be sent to the frontend immediately
    if (
      companionThinkingService.isEnabled() &&
      assistantMessage.status === MessageStatus.COMPLETED
    ) {
      // Format history for thinking service
      const formattedHistoryForThinking = session.chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Instead of setTimeout, use an IIFE to ensure it's run
      (async () => {
        try {
          // Log the start of companion thinking
          this.logger.info(
            `Starting companion thinking for user ${userId}, session ${sessionId}, message ${clientMessageId || "unknown"}`
          );

          // First attempt to process and inject thinking
          const thinkingResult = await companionThinkingService.processThinking(
            userId,
            sessionId,
            messageText,
            clientMessageId,
            formattedHistoryForThinking
          );

          this.logger.debug(
            `Companion thinking process result: ${thinkingResult ? "succeeded" : "skipped/failed"} for user ${userId}, session ${sessionId}`
          );

          // Explicitly inject the latest thinking into context even if processing didn't happen
          // This helps when thinking was processed in a previous message but not injected
          if (!thinkingResult) {
            this.logger.info(
              "Attempting to inject previous thinking since processing was skipped"
            );
            await companionThinkingService.injectLatestThinking(
              userId,
              sessionId
            );
          }

          this.logger.debug(
            `Async companion thinking completed for user ${userId}, session ${sessionId}`
          );

          // Process insights extraction asynchronously too
          if (this.enableInsightExtraction) {
            await this._extractAndStoreInsights(
              userId,
              assistantMessage.content,
              parameters,
              activeActivity?.id
            );
            this.logger.debug(
              `Async insight extraction completed for user ${userId}`
            );
          }
        } catch (err) {
          this.logger.error(
            `Error in async companion thinking processing: ${err}`
          );
          // Even if thinking fails, try to inject any previous thinking
          try {
            await companionThinkingService.injectLatestThinking(
              userId,
              sessionId
            );
          } catch (injectErr) {
            this.logger.error(
              `Failed to inject previous thinking: ${injectErr}`
            );
          }
        }
      })();
    }

    // Return ONLY the assistant message
    return {
      assistantMessage,
      actionResults:
        Object.keys(actionResults).length > 0 ? actionResults : undefined,
    };
  }

  // Helper to save message (async, non-blocking)
  private saveMessageToDB(message: ChatMessageModel) {
    if (!message || !message.sessionId || !message.id) {
      this.logger.warn(
        "[AIService] Attempted to save invalid message object:",
        message
      );
      return;
    }

    const session = chatSessionManager.getSession(message.sessionId);
    if (!session) {
      this.logger.warn(
        `[AIService] Session ${message.sessionId} not found when saving message ${message.id}`
      );
      return;
    }

    const messageData = {
      ...message,
      _id: message.id,
      userId: session.userId,
      timestamp: new Date(message.timestamp),
    };

    MessageModel.create(messageData)
      .then(() => {
        this.logger.debug(`Saved message ${message.id} to DB.`);
      })
      .catch((err) => {
        this.logger.warn(
          `[AIService] Failed to save message ${message.id} to DB:`,
          err.message
        );
      });
  }

  // Helper to add message to memory (async, non-blocking)
  private addMessageToMemory(
    userId: string,
    sessionId: string,
    message: ChatMessageModel,
    activeActivity?: IActivity | null // Add activeActivity parameter
  ) {
    if (
      !message ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      this.logger.debug(
        `Skipping memory add for invalid message object or empty content: ${message?.id}`
      );
      return;
    }

    if (
      message.status !== MessageStatus.COMPLETED &&
      message.role !== MessageRole.USER
    ) {
      this.logger.debug(
        `[AIService] Skipping memory add for message ${message.id} with status ${message.status}`
      );
      return;
    }

    let importance = 1;
    if (message.role === MessageRole.USER && message.content.includes("?")) {
      importance = 2;
    } else if (
      message.role === MessageRole.ASSISTANT &&
      this.messageContainsInsight(message.content)
    ) {
      importance = 5;
    } else if (
      message.role === MessageRole.ASSISTANT &&
      message.status === MessageStatus.ERROR
    ) {
      importance = 0;
    }

    const memoryText = `${message.role}: ${message.content}`;

    memoryService
      .addMemory(
        userId,
        memoryText,
        MemoryType.SHORT_TERM,
        `chat:${sessionId}`,
        {
          messageId: message.id,
          role: message.role,
          timestamp: message.timestamp || new Date().toISOString(),
          provider: message.metadata?.provider, // Include provider if available
          // Conditionally add activityId if activeActivity exists
          ...(activeActivity?.id && { activityId: activeActivity.id }),
        },
        importance,
        MemoryCategory.CONVERSATION
      )
      .then(() => {
        this.logger.debug(
          `Added message ${message.id} to memory (importance: ${importance}).`
        );
      })
      .catch((err) => {
        this.logger.error(
          `[AIService] Failed to add message ${message.id} to memory:`,
          err
        );
      });
  }

  /**
   * Check if a message contains important insights to be remembered
   */
  private messageContainsInsight(text: string): boolean {
    if (!text || typeof text !== "string") return false;

    const lowerText = text.toLowerCase();

    const insightPhrases = [
      "i notice that you",
      "i've noticed that you",
      "i observed that",
      "it seems you",
      "you seem to",
      "you mentioned that",
      "you've shared that",
      "you told me",
      "based on what you've said",
      "from our conversation",
      "your preference for",
      "you prefer",
      "you enjoy",
      "you like",
      "you dislike",
      "you don't like",
      "you previously said",
      "you generally",
      "i remember you said",
      "remember that i",
      "don't forget that i",
      "my name is",
      "i live in",
      "my job is",
      "i am feeling",
      "my goal is",
      "i need help with",
    ];

    const memoryKeywords = [
      "remember",
      "recall",
      "memory",
      "remind me",
      "note that",
    ];

    return (
      insightPhrases.some((phrase) => lowerText.includes(phrase)) ||
      memoryKeywords.some((keyword) => lowerText.includes(keyword))
    );
  }

  // --- Private Helper Methods ---

  private async _processSuggestedActions(
    userId: string,
    responseText: string,
    parameters: AIParameters
  ): Promise<Record<string, any>> {
    if (!this.enableActionProcessing) {
      this.logger.debug("Action processing disabled, skipping.");
      return {};
    }
    this.logger.debug(`Processing actions for user ${userId}...`);
    try {
      const executionResult = await actionManager.executeTopSuggestedAction(
        userId,
        responseText
      );

      if (executionResult !== null) {
        return { executionResult };
      } else {
        this.logger.debug(
          `No high-confidence action was executed for response.`
        );
      }
    } catch (error) {
      this.logger.error(
        `[AIService] Error during action processing via ActionManager:`,
        error
      );
    }
    return {};
  }

  // --- End Private Helper Methods ---
}

export const aiService = new AIService();
