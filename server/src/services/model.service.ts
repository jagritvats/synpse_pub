import { Ollama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { OpenAI } from "openai";
import { modelEnum } from "../constants/models";

// Define interfaces and enums directly or import from ai.service if they remain there
// For clarity, defining them here.
export enum LLMProvider {
  OLLAMA = "ollama",
  GOOGLE = "google",
  OPENAI = "openai",
  CUSTOM = "custom",
}

export interface AIParameters {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];
  provider?: LLMProvider; // Make provider optional, deduce if not present
  endpointUrl?: string;
  apiKey?: string;
}

interface DefaultModels {
  [LLMProvider.OLLAMA]: string;
  [LLMProvider.GOOGLE]: string;
  [LLMProvider.OPENAI]: string;
}

/**
 * Service responsible for initializing, configuring, and providing LLM instances.
 */
class ModelService {
  private ollamaModel: BaseChatModel | null = null;
  private googleModel: BaseChatModel | null = null;
  private openaiClient: OpenAI | null = null;
  private useOpenAI: boolean = false;

  private defaultModels: DefaultModels = {
    [LLMProvider.OLLAMA]: modelEnum.sth, // TODO: Make defaults configurable via env
    [LLMProvider.GOOGLE]: "gemini-pro",
    [LLMProvider.OPENAI]: "gpt-3.5-turbo",
  };

  constructor() {
    console.log("[ModelService] Initializing...");
    this.initializeDefaultModels();
    this.initializeOpenAIClient();
    console.log("[ModelService] Initialized.");
  }

  private initializeDefaultModels(): void {
    // Initialize Ollama model
    try {
      // @ts-ignore: Type compatibility issues with Ollama and BaseChatModel
      this.ollamaModel = new Ollama({
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: this.defaultModels[LLMProvider.OLLAMA],
        temperature: 0.7, // Default temp for singleton
      });
      console.log("[ModelService] Default Ollama model initialized");
    } catch (error) {
      console.error(
        "[ModelService] Failed to initialize default Ollama model:",
        error
      );
      this.ollamaModel = null;
    }

    // Initialize Google model if API key is available
    if (process.env.GOOGLE_API_KEY) {
      try {
        this.googleModel = new ChatGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_API_KEY,
          modelName: this.defaultModels[LLMProvider.GOOGLE],
          temperature: 0.7, // Default temp for singleton
          maxOutputTokens: 1000, // Default max tokens
        });
        console.log("[ModelService] Default Google AI model initialized");
      } catch (error) {
        console.error(
          "[ModelService] Failed to initialize default Google AI model:",
          error
        );
        this.googleModel = null;
      }
    } else {
      console.warn(
        "[ModelService] Google API Key not found, skipping default Google model initialization."
      );
    }
  }

  private initializeOpenAIClient(): void {
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.useOpenAI = true;
        console.log("[ModelService] OpenAI client initialized");
      } catch (error) {
        console.error(
          "[ModelService] Failed to initialize OpenAI client:",
          error
        );
        this.openaiClient = null;
        this.useOpenAI = false;
      }
    } else {
      console.warn(
        "[ModelService] OpenAI API Key not found, OpenAI provider unavailable."
      );
      this.useOpenAI = false;
    }
  }

  public getOpenAIClient(): OpenAI | null {
    return this.openaiClient;
  }

  public isOpenAIEnabled(): boolean {
    return this.useOpenAI && !!this.openaiClient;
  }

  /**
   * Determine the provider from the model name if not specified.
   */
  public getProviderFromModel(model: string): LLMProvider {
    if (model.startsWith("gemini")) return LLMProvider.GOOGLE;
    if (model.startsWith("gpt")) return LLMProvider.OPENAI;
    return LLMProvider.OLLAMA; // Default to Ollama
  }

  /**
   * Get the appropriate chat model based on parameters.
   * Creates a new instance for custom configurations, otherwise returns pre-initialized singletons.
   */
  public getChatModel(parameters: AIParameters): BaseChatModel {
    const provider =
      parameters.provider || this.getProviderFromModel(parameters.model);
    const modelName = parameters.model;

    // Check if a custom configuration is needed
    const isDefaultOllama =
      provider === LLMProvider.OLLAMA &&
      modelName === this.defaultModels[LLMProvider.OLLAMA];
    const isDefaultGoogle =
      provider === LLMProvider.GOOGLE &&
      modelName === this.defaultModels[LLMProvider.GOOGLE];
    const hasCustomParams =
      parameters.temperature !== undefined ||
      parameters.max_tokens !== undefined ||
      parameters.top_p !== undefined; // Add other params as needed

    const needsCustomInstance =
      hasCustomParams ||
      (!isDefaultOllama && !isDefaultGoogle && provider !== LLMProvider.OPENAI);

    if (!needsCustomInstance) {
      // Try returning pre-initialized default models
      if (isDefaultOllama && this.ollamaModel) return this.ollamaModel;
      if (isDefaultGoogle && this.googleModel) return this.googleModel;
      // Note: OpenAI models are handled differently (not BaseChatModel for direct API use)
    }

    // If custom or default not available, create a new instance
    console.log(
      `[ModelService] Creating custom model instance for ${provider} - ${modelName}`
    );
    return this.createCustomChatModel(parameters);
  }

  /**
   * Creates a specific instance of a chat model.
   */
  private createCustomChatModel(parameters: AIParameters): BaseChatModel {
    const provider =
      parameters.provider || this.getProviderFromModel(parameters.model);
    const modelName = parameters.model;

    try {
      switch (provider) {
        case LLMProvider.OLLAMA:
          // @ts-ignore
          return new Ollama({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model: modelName,
            temperature: parameters.temperature,
            // Add other Ollama params if needed
          });
        case LLMProvider.GOOGLE:
          if (!process.env.GOOGLE_API_KEY) {
            throw new Error(
              "Google API Key not found for custom Google model."
            );
          }
          return new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_API_KEY,
            modelName: modelName,
            temperature: parameters.temperature,
            maxOutputTokens: parameters.max_tokens,
            topP: parameters.top_p,
          });
        // case LLMProvider.OPENAI: // OpenAI handled via client, not BaseChatModel directly here
        //     throw new Error("OpenAI models accessed via getOpenAIClient, not getChatModel.");
        default:
          console.warn(
            `[ModelService] Unsupported provider for custom model: ${provider}. Falling back to default Ollama.`
          );
          // @ts-ignore
          return (
            this.ollamaModel ||
            new Ollama({
              // Return singleton or create new default
              baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
              model: this.defaultModels[LLMProvider.OLLAMA],
              temperature: 0.7,
            })
          );
      }
    } catch (error) {
      console.error(
        `[ModelService] Error creating custom ${provider} model ${modelName}:`,
        error
      );
      // Fallback strategy: Try default singleton of the *other* provider if available
      if (provider === LLMProvider.OLLAMA && this.googleModel) {
        console.warn("[ModelService] Falling back to default Google model.");
        return this.googleModel;
      }
      if (provider === LLMProvider.GOOGLE && this.ollamaModel) {
        console.warn("[ModelService] Falling back to default Ollama model.");
        return this.ollamaModel;
      }
      // Final fallback: create default Ollama
      console.error(
        "[ModelService] Critical error: No models available. Creating fallback Ollama."
      );
      // @ts-ignore
      return new Ollama({
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: this.defaultModels[LLMProvider.OLLAMA],
        temperature: 0.7,
      });
    }
  }
}

// Export a singleton instance
export const modelService = new ModelService();
