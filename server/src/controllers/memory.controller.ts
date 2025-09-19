import { Request, Response, Router } from "express";import {
  memoryService,
  Memory,
  MemoryType,
  MemoryCategory,
} from "../services/memory.service";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * Get all memories for the authenticated user
 *
 * GET /api/memories?type=<memory_type>
 */
router.get("/", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const type = req.query.type as MemoryType | undefined;

  // Validate memory type if provided
  if (type && !Object.values(MemoryType).includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid memory type",
    });
  }

  const memories = memoryService.getUserMemories(userId, type);

  return res.status(200).json({
    success: true,
    data: memories,
  });
});

/**
 * Search memories by text
 *
 * GET /api/memories/search?q=<search_term>
 */
router.get("/search", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const searchTerm = (req.query.q as string) || "";

  const memories = memoryService.searchMemories(userId, searchTerm);

  return res.status(200).json({
    success: true,
    data: memories,
  });
});

/**
 * Semantic search in memories
 *
 * GET /api/memories/semantic-search?q=<search_term>&limit=<limit>
 */
router.get(
  "/semantic-search",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const searchTerm = (req.query.q as string) || "";
    const limit = parseInt((req.query.limit as string) || "10", 10);

    try {
      const memories = await memoryService.semanticSearchMemories(
        userId,
        searchTerm,
        limit
      );

      return res.status(200).json({
        success: true,
        data: memories,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error performing semantic search",
        error: (error as Error).message,
      });
    }
  }
);

/**
 * Get a specific memory by ID
 *
 * GET /api/memories/:id
 */
router.get("/:id", authMiddleware, (req: Request, res: Response) => {
  const memoryId = req.params.id;
  const memory = memoryService.getMemory(memoryId);

  if (!memory) {
    return res.status(404).json({
      success: false,
      message: "Memory not found",
    });
  }

  // Check if the memory belongs to the requesting user
  if (memory.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  return res.status(200).json({
    success: true,
    data: memory,
  });
});

/**
 * Create a new memory
 *
 * POST /api/memories
 */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { text, type, source, metadata, importance } = req.body;

  if (!text || !type || !source) {
    return res.status(400).json({
      success: false,
      message: "Text, type, and source are required",
    });
  }

  // Validate memory type
  if (!Object.values(MemoryType).includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid memory type",
    });
  }

  try {
    const memory = await memoryService.addMemory(
      userId,
      text,
      type,
      source,
      metadata,
      importance
    );

    return res.status(201).json({
      success: true,
      data: memory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create memory",
      error: (error as Error).message,
    });
  }
});

/**
 * Update an existing memory
 *
 * PUT /api/memories/:id
 */
router.put("/:id", authMiddleware, (req: Request, res: Response) => {
  const memoryId = req.params.id;
  const { text, type, source, metadata, importance } = req.body;

  const existingMemory = memoryService.getMemory(memoryId);

  if (!existingMemory) {
    return res.status(404).json({
      success: false,
      message: "Memory not found",
    });
  }

  // Check if the memory belongs to the requesting user
  if (existingMemory.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  // Validate memory type if provided
  if (type && !Object.values(MemoryType).includes(type as MemoryType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid memory type",
    });
  }

  // Prepare updates
  const updates: Partial<Memory> = {};

  if (text !== undefined) updates.text = text;
  if (type !== undefined) updates.type = type as MemoryType;
  if (source !== undefined) updates.source = source;
  if (metadata !== undefined) updates.metadata = metadata;
  if (importance !== undefined) updates.importance = importance;

  const updatedMemory = memoryService.updateMemory(memoryId, updates);

  return res.status(200).json({
    success: true,
    data: updatedMemory,
  });
});

/**
 * Delete a memory
 *
 * DELETE /api/memories/:id
 */
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const memoryId = req.params.id;

  const existingMemory = memoryService.getMemory(memoryId);

  if (!existingMemory) {
    return res.status(404).json({
      success: false,
      message: "Memory not found",
    });
  }

  // Check if the memory belongs to the requesting user
  if (existingMemory.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const deleted = await memoryService.deleteMemory(memoryId);

    return res.status(200).json({
      success: deleted,
      message: deleted
        ? "Memory deleted successfully"
        : "Failed to delete memory",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting memory",
      error: (error as Error).message,
    });
  }
});

/**
 * Generate a summary from recent memories
 *
 * GET /api/memories/summary
 */
router.get("/summary", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const memories = memoryService.getUserMemories(userId);

  if (memories.length === 0) {
    return res.status(200).json({
      success: true,
      data: "No memories available.",
    });
  }

  const summary = memoryService.generateSummaryFromMemories(memories);

  return res.status(200).json({
    success: true,
    data: summary,
  });
});

/**
 * Get all memories for a user
 */
export const getUserMemories = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;

    let memoryType: MemoryType | undefined = undefined;
    if (type && Object.values(MemoryType).includes(type as MemoryType)) {
      memoryType = type as MemoryType;
    }

    const memories = memoryService.getUserMemories(userId, memoryType);

    return res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    console.error("Error getting user memories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve memories",
      error: (error as Error).message,
    });
  }
};

/**
 * Get memories by category
 */
export const getMemoriesByCategory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { category } = req.params;

    if (
      !category ||
      !Object.values(MemoryCategory).includes(category as MemoryCategory)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory category",
      });
    }

    const memories = memoryService.getMemoriesByCategory(
      userId,
      category as MemoryCategory
    );

    return res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    console.error("Error getting memories by category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve memories by category",
      error: (error as Error).message,
    });
  }
};

/**
 * Add a new memory
 */
export const addMemory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      text,
      type = MemoryType.MEDIUM_TERM,
      source,
      metadata,
      importance = 5,
    } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Text is required",
      });
    }

    if (!source) {
      return res.status(400).json({
        success: false,
        message: "Source is required",
      });
    }

    const memory = await memoryService.addMemory(
      userId,
      text,
      type as MemoryType,
      source,
      metadata,
      importance
    );

    return res.status(201).json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error("Error adding memory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add memory",
      error: (error as Error).message,
    });
  }
};

/**
 * Add AI-generated memory
 */
export const addAIGeneratedMemory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      text,
      type = MemoryType.MEDIUM_TERM,
      category = MemoryCategory.FACT,
      importance = 7,
      relatedMemories = [],
    } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Text is required",
      });
    }

    const memory = await memoryService.addAIGeneratedMemory(
      userId,
      text,
      type as MemoryType,
      category as MemoryCategory,
      importance,
      relatedMemories
    );

    return res.status(201).json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error("Error adding AI-generated memory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add AI-generated memory",
      error: (error as Error).message,
    });
  }
};

// Add default export for the router
export default router;
