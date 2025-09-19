import { aiService, AIParameters, LLMProvider } from "../services/ai.service";
import axios from "axios";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AIService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Ollama Integration", () => {
    it("should properly call Ollama API when configured", async () => {
      // Setup mock response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          model: "llama3",
          response: "This is a test response from Ollama",
          prompt_eval_count: 10,
          eval_count: 20,
        },
      });

      const response = await aiService.generateResponse("Test prompt");

      expect(response.text).toBe("This is a test response from Ollama");
      expect(response.metadata?.provider).toBe(LLMProvider.OLLAMA);
      expect(response.metadata?.usage.totalTokens).toBe(30); // 10 + 20

      // Verify axios was called with correct data
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/generate"),
        expect.objectContaining({
          model: expect.any(String),
          prompt: "Test prompt",
          temperature: expect.any(Number),
          max_tokens: expect.any(Number),
          stream: false,
        })
      );
    });

    it("should handle Ollama API errors", async () => {
      // Setup mock error
      mockedAxios.post.mockRejectedValueOnce(new Error("Connection refused"));

      // No fallback configured
      process.env.GOOGLE_API_KEY = "";

      await expect(aiService.generateResponse("Test prompt")).rejects.toThrow(
        "Failed to generate Ollama response"
      );
    });

    it("should fall back to Google API if Ollama fails and Google API key is present", async () => {
      // Setup Ollama to fail, then Google to succeed
      mockedAxios.post
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockResolvedValueOnce({
          data: {
            candidates: [
              {
                content: {
                  parts: [{ text: "This is a Google response" }],
                },
              },
            ],
          },
        });

      // Set Google API key for fallback
      process.env.GOOGLE_API_KEY = "test-api-key";

      const response = await aiService.generateResponse("Test prompt");

      expect(response.text).toBe("This is a Google response");
      expect(response.metadata?.provider).toBe(LLMProvider.GOOGLE);

      // Clear the environment variable
      process.env.GOOGLE_API_KEY = "";
    });
  });

  describe("User Parameters", () => {
    it("should store and retrieve user parameters", () => {
      const userId = "test-user-123";
      const params: Partial<AIParameters> = {
        provider: LLMProvider.OPENAI,
        model: "gpt-4",
        temperature: 0.5,
      };

      // Set parameters
      const updatedParams = aiService.setUserParameters(userId, params);

      // Verify parameters are stored
      const retrievedParams = aiService.getUserParameters(userId);

      expect(retrievedParams).toEqual(updatedParams);
      expect(retrievedParams.provider).toBe(LLMProvider.OPENAI);
      expect(retrievedParams.model).toBe("gpt-4");
      expect(retrievedParams.temperature).toBe(0.5);
    });

    it("should apply user parameters when generating responses", async () => {
      const userId = "custom-user";

      // Set custom user parameters
      aiService.setUserParameters(userId, {
        provider: LLMProvider.OLLAMA,
        model: "custom-model",
        temperature: 0.3,
      });

      // Setup mock response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          model: "custom-model",
          response: "Custom model response",
          prompt_eval_count: 5,
          eval_count: 10,
        },
      });

      // Generate response with user ID
      await aiService.generateResponse(
        "Test with user",
        undefined,
        undefined,
        userId
      );

      // Verify correct model was used
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: "custom-model",
          temperature: 0.3,
        }),
        expect.any(Object)
      );
    });
  });

  describe("Chat Config Override", () => {
    it("should override parameters with chat config when provided", async () => {
      // Setup mock response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          model: "llama3",
          response: "Response with overridden config",
          prompt_eval_count: 5,
          eval_count: 10,
        },
      });

      // Generate response with config override
      await aiService.generateResponse("Test with config", undefined, {
        model: "different-model",
        temperature: 0.9,
        maxTokens: 500,
      });

      // Verify overridden parameters were used
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: "different-model",
          temperature: 0.9,
          max_tokens: 500,
        }),
        expect.any(Object)
      );
    });
  });
});
