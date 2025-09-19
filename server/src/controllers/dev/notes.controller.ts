import { Request, Response, Router } from "express";import { notesService, Note } from "../../services/notes.service";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * Get all notes for the authenticated user
 *
 * GET /api/notes
 */
router.get("/", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const notes = notesService.getUserNotes(userId);

  return res.status(200).json({
    success: true,
    data: notes,
  });
});

/**
 * Search notes by query term
 *
 * GET /api/notes/search?q=term
 */
router.get("/search", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const searchTerm = (req.query.q as string) || "";

  const notes = notesService.searchNotes(userId, searchTerm);

  return res.status(200).json({
    success: true,
    data: notes,
  });
});

/**
 * Get notes by tag
 *
 * GET /api/notes/tag/:tag
 */
router.get("/tag/:tag", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const tag = req.params.tag;

  const notes = notesService.getNotesByTag(userId, tag);

  return res.status(200).json({
    success: true,
    data: notes,
  });
});

/**
 * Get all unique tags for the user
 *
 * GET /api/notes/tags
 */
router.get("/tags", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const tags = notesService.getUserTags(userId);

  return res.status(200).json({
    success: true,
    data: tags,
  });
});

/**
 * Get a specific note by ID
 *
 * GET /api/notes/:id
 */
router.get("/:id", authMiddleware, (req: Request, res: Response) => {
  const noteId = req.params.id;
  const note = notesService.getNote(noteId);

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  // Check if the note belongs to the requesting user
  if (note.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  return res.status(200).json({
    success: true,
    data: note,
  });
});

/**
 * Create a new note
 *
 * POST /api/notes
 */
router.post("/", authMiddleware, (req: Request, res: Response) => {
  const userId = req.user.id;
  const { title, content, tags, source, metadata } = req.body;

  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: "Title and content are required",
    });
  }

  const note = notesService.createNote(
    userId,
    title,
    content,
    tags,
    source,
    metadata
  );

  return res.status(201).json({
    success: true,
    data: note,
  });
});

/**
 * Update an existing note
 *
 * PUT /api/notes/:id
 */
router.put("/:id", authMiddleware, (req: Request, res: Response) => {
  const noteId = req.params.id;
  const { title, content, tags, metadata } = req.body;

  const existingNote = notesService.getNote(noteId);

  if (!existingNote) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  // Check if the note belongs to the requesting user
  if (existingNote.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  // Prepare updates
  const updates: Partial<Note> = {};

  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (tags !== undefined) updates.tags = tags;
  if (metadata !== undefined) updates.metadata = metadata;

  const updatedNote = notesService.updateNote(noteId, updates);

  return res.status(200).json({
    success: true,
    data: updatedNote,
  });
});

/**
 * Delete a note
 *
 * DELETE /api/notes/:id
 */
router.delete("/:id", authMiddleware, (req: Request, res: Response) => {
  const noteId = req.params.id;

  const existingNote = notesService.getNote(noteId);

  if (!existingNote) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  // Check if the note belongs to the requesting user
  if (existingNote.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  const deleted = notesService.deleteNote(noteId);

  return res.status(200).json({
    success: deleted,
    message: deleted ? "Note deleted successfully" : "Failed to delete note",
  });
});

export default router;
