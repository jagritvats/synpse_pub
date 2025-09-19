import {  serendipityService,
  SerendipitousSuggestion,
} from "../services/serendipity.service";
import { memoryService } from "../services/memory.service";
import { aiService } from "../services/ai.service";
import { contextService } from "../services/context.service";
import { socialMediaService } from "../services/social/social-media.service";
import { MemoryType } from "../models/memory.model";
import { summaryService } from "../services/summary.service";

// Mock dependencies
jest.mock("../services/memory.service", () => ({
  memoryService: {
    getUserMemories: jest.fn(),
    getRelevantMemories: jest.fn(),
    generateUserSummary: jest.fn(),
  },
}));

jest.mock("../services/ai.service", () => ({
  aiService: {
    generateResponse: jest.fn(),
  },
}));

jest.mock("../services/context.service", () => ({
  contextService: {
    generateContext: jest.fn(),
  },
}));

jest.mock("../services/social/social-media.service", () => ({
  socialMediaService: {
    generateSocialSummary: jest.fn(),
  },
}));

describe("SerendipityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateSuggestions", () => {
    it("should return empty array when not enough memories", async () => {
      // Mock memory service to return fewer than 3 memories
      (memoryService.getUserMemories as jest.Mock).mockReturnValue([]);

      const result = await serendipityService.generateSuggestions("user123");

      expect(result).toEqual([]);
      expect(memoryService.getUserMemories).toHaveBeenCalledWith("user123");
    });

    it("should generate suggestions when enough memories exist", async () => {
      // Mock memory service to return memories
      (memoryService.getUserMemories as jest.Mock).mockReturnValue([
        { id: "1", type: MemoryType.LONG_TERM, content: "Memory 1" },
        { id: "2", type: MemoryType.MEDIUM_TERM, content: "Memory 2" },
        { id: "3", type: MemoryType.SHORT_TERM, content: "Memory 3" },
        { id: "4", type: MemoryType.LONG_TERM, content: "Memory 4" },
      ]);

      // Mock context service
      (contextService.generateContext as jest.Mock).mockResolvedValue(
        "Current context"
      );

      // Mock AI service
      (aiService.generateResponse as jest.Mock).mockResolvedValue({
        text: JSON.stringify([
          {
            title: "Suggestion 1",
            description: "Description 1",
            type: "activity",
          },
          {
            title: "Suggestion 2",
            description: "Description 2",
            type: "idea",
          },
        ]),
      });

      const result = await serendipityService.generateSuggestions("user123");

      expect(result.length).toBe(2);
      expect(result[0].title).toBe("Suggestion 1");
      expect(result[0].type).toBe("activity");
      expect(result[1].title).toBe("Suggestion 2");
      expect(result[1].type).toBe("idea");

      expect(memoryService.getUserMemories).toHaveBeenCalledWith("user123");
      expect(contextService.generateContext).toHaveBeenCalledWith(true, true);
      expect(aiService.generateResponse).toHaveBeenCalled();
    });

    it("should handle AI service errors", async () => {
      // Mock memory service to return memories
      (memoryService.getUserMemories as jest.Mock).mockReturnValue([
        { id: "1", type: MemoryType.LONG_TERM, content: "Memory 1" },
        { id: "2", type: MemoryType.MEDIUM_TERM, content: "Memory 2" },
        { id: "3", type: MemoryType.SHORT_TERM, content: "Memory 3" },
      ]);

      // Mock context service
      (contextService.generateContext as jest.Mock).mockResolvedValue(
        "Current context"
      );

      // Mock AI service to throw error
      (aiService.generateResponse as jest.Mock).mockRejectedValue(
        new Error("AI service error")
      );

      const result = await serendipityService.generateSuggestions("user123");

      expect(result).toEqual([]);
      expect(memoryService.getUserMemories).toHaveBeenCalledWith("user123");
      expect(contextService.generateContext).toHaveBeenCalledWith(true, true);
      expect(aiService.generateResponse).toHaveBeenCalled();
    });
  });

  describe("findCrossContextConnections", () => {
    it("should find connections between social media and personal data", async () => {
      // Mock social media service
      (socialMediaService.generateSocialSummary as jest.Mock).mockResolvedValue(
        "Social summary"
      );

      // Mock summary service
      (summaryService.generateUserSummary as jest.Mock).mockResolvedValue(
        "User summary"
      );

      // Mock context service
      (contextService.generateContext as jest.Mock).mockResolvedValue(
        "Current context"
      );

      // Mock AI service
      (aiService.generateResponse as jest.Mock).mockResolvedValue({
        text: JSON.stringify([
          {
            title: "Connection 1",
            description: "Description 1",
            type: "connection",
          },
        ]),
      });

      const result =
        await serendipityService.findCrossContextConnections("user123");

      expect(result.length).toBe(1);
      expect(result[0].title).toBe("Connection 1");
      expect(result[0].type).toBe("connection");

      expect(socialMediaService.generateSocialSummary).toHaveBeenCalledWith(
        "user123"
      );
      expect(summaryService.generateUserSummary).toHaveBeenCalledWith(
        "user123"
      );
      expect(contextService.generateContext).toHaveBeenCalledWith(true, true);
      expect(aiService.generateResponse).toHaveBeenCalled();
    });
  });

  describe("generateSerendipitousMoment", () => {
    it("should generate a serendipitous moment", async () => {
      // Mock context service
      (contextService.generateContext as jest.Mock).mockResolvedValue(
        "Current context"
      );

      // Mock memory service
      (memoryService.getRelevantMemories as jest.Mock).mockReturnValue([
        { id: "1", content: "Relevant memory 1" },
        { id: "2", content: "Relevant memory 2" },
      ]);

      // Mock AI service
      (aiService.generateResponse as jest.Mock).mockResolvedValue({
        text: JSON.stringify({
          title: "Serendipitous Moment",
          description: "This is a special moment",
          type: "activity",
        }),
      });

      const result =
        await serendipityService.generateSerendipitousMoment("user123");

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Serendipitous Moment");
      expect(result?.type).toBe("activity");

      expect(contextService.generateContext).toHaveBeenCalledWith(true, true);
      expect(memoryService.getRelevantMemories).toHaveBeenCalledWith(
        "user123",
        "Current context",
        3
      );
      expect(aiService.generateResponse).toHaveBeenCalled();
    });

    it("should return null when AI service fails", async () => {
      // Mock context service
      (contextService.generateContext as jest.Mock).mockResolvedValue(
        "Current context"
      );

      // Mock memory service
      (memoryService.getRelevantMemories as jest.Mock).mockReturnValue([
        { id: "1", content: "Relevant memory 1" },
      ]);

      // Mock AI service to throw error
      (aiService.generateResponse as jest.Mock).mockRejectedValue(
        new Error("AI service error")
      );

      const result =
        await serendipityService.generateSerendipitousMoment("user123");

      expect(result).toBeNull();
      expect(contextService.generateContext).toHaveBeenCalledWith(true, true);
      expect(memoryService.getRelevantMemories).toHaveBeenCalledWith(
        "user123",
        "Current context",
        3
      );
      expect(aiService.generateResponse).toHaveBeenCalled();
    });
  });
});
