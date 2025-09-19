import { Request, Response, Router } from "express";
import {
  aiService,
  AIParameters,
  LLMProvider,
} from "../../services/ai.service";
import { authMiddleware } from "../../middlewares/auth.middleware";

/**
 * Controller for managing AI model parameters
 */
class AIParametersController {
  /**
   * Get AI parameters for the authenticated user
   */
  async getParameters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const parameters = aiService.getUserParameters(userId);

      res.status(200).json({
        success: true,
        data: parameters,
      });
    } catch (error) {
      console.error("Error getting AI parameters:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get AI parameters",
      });
    }
  }

  /**
   * Update AI parameters for the authenticated user
   */
  async setParameters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const parameters: Partial<AIParameters> = req.body;

      // Validate parameters
      if (
        parameters.temperature !== undefined &&
        (parameters.temperature < 0 || parameters.temperature > 2)
      ) {
        res.status(400).json({
          success: false,
          error: "Temperature must be between 0 and 2",
        });
        return;
      }

      if (
        parameters.maxTokens !== undefined &&
        (parameters.maxTokens < 1 || parameters.maxTokens > 8192)
      ) {
        res.status(400).json({
          success: false,
          error: "Max tokens must be between 1 and 8192",
        });
        return;
      }

      if (
        parameters.topP !== undefined &&
        (parameters.topP < 0 || parameters.topP > 1)
      ) {
        res.status(400).json({
          success: false,
          error: "Top P must be between 0 and 1",
        });
        return;
      }

      // Update parameters
      const updatedParameters = aiService.setUserParameters(userId, parameters);

      res.status(200).json({
        success: true,
        data: updatedParameters,
      });
    } catch (error) {
      console.error("Error setting AI parameters:", error);
      res.status(500).json({
        success: false,
        error: "Failed to set AI parameters",
      });
    }
  }

  /**
   * Get available AI models
   */
  async getAvailableModels(req: Request, res: Response): Promise<void> {
    try {
      // Define available models per provider
      const availableModels = {
        [LLMProvider.OLLAMA]: [
          {
            id: "llama3",
            name: "Llama 3 (Default)",
            description: "Meta's Llama 3 model",
          },
          {
            id: "mistral",
            name: "Mistral",
            description: "Mistral 7B open model",
          },
          {
            id: "codellama",
            name: "Code Llama",
            description: "Optimized for coding tasks",
          },
          {
            id: "llama3:8b",
            name: "Llama 3 (8B)",
            description: "Smaller and faster Llama 3 model",
          },
        ],
        [LLMProvider.GOOGLE]: [
          {
            id: "gemini-pro",
            name: "Gemini Pro",
            description: "Google's Gemini Pro model",
          },
        ],
        [LLMProvider.OPENAI]: [
          {
            id: "gpt-3.5-turbo",
            name: "GPT-3.5 Turbo",
            description: "OpenAI's GPT-3.5 model",
          },
          { id: "gpt-4", name: "GPT-4", description: "OpenAI's GPT-4 model" },
        ],
      };

      // Check for actually available Ollama models if possible
      try {
        // Get default config to find Ollama endpoint
        const defaultConfig = aiService.getUserParameters("default");

        if (
          defaultConfig.provider === LLMProvider.OLLAMA &&
          defaultConfig.endpointUrl
        ) {
          const response = await fetch(`${defaultConfig.endpointUrl}/api/tags`);

          if (response.ok) {
            const data = await response.json();

            // Replace Ollama models with actual available models
            if (data.models && Array.isArray(data.models)) {
              availableModels[LLMProvider.OLLAMA] = data.models.map(
                (model: any) => ({
                  id: model.name,
                  name: model.name,
                  description: `${model.details?.family || "AI"} model, ${Math.round(model.size / (1024 * 1024))}MB`,
                })
              );
            }
          }
        }
      } catch (ollamaError) {
        console.warn("Could not fetch Ollama models:", ollamaError);
        // Continue with predefined models
      }

      res.status(200).json({
        success: true,
        data: {
          providers: Object.values(LLMProvider),
          models: availableModels,
        },
      });
    } catch (error) {
      console.error("Error getting available models:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get available models",
      });
    }
  }
}

// Create a singleton instance
const controller = new AIParametersController();

// Create and configure the router
const router = Router();

// Define routes
router.get("/", authMiddleware, controller.getParameters.bind(controller));
router.post("/", authMiddleware, controller.setParameters.bind(controller));
router.get("/models", controller.getAvailableModels.bind(controller));

// Export the router as default
export default router;
