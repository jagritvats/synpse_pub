import { v4 as uuidv4 } from "uuid";

/**
 * Note model interface
 * Inspired by NestJS implementation in ../server/src/shared/services/notes.service.ts
 */
export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for managing user notes
 */
class NotesService {
  // In-memory storage - would be replaced with a database in production
  private notes: Map<string, Note> = new Map();

  /**
   * Create a new note
   */
  createNote(
    userId: string,
    title: string,
    content: string,
    tags?: string[],
    source?: string,
    metadata?: Record<string, any>
  ): Note {
    const timestamp = new Date().toISOString();

    const note: Note = {
      id: uuidv4(),
      userId,
      title,
      content,
      createdAt: timestamp,
      updatedAt: timestamp,
      tags,
      source,
      metadata,
    };

    this.notes.set(note.id, note);
    return note;
  }

  /**
   * Get all notes for a user
   */
  getUserNotes(userId: string): Note[] {
    return Array.from(this.notes.values())
      .filter((note) => note.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  /**
   * Get a specific note by ID
   */
  getNote(noteId: string): Note | undefined {
    return this.notes.get(noteId);
  }

  /**
   * Update an existing note
   */
  updateNote(
    noteId: string,
    updates: {
      title?: string;
      content?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Note | undefined {
    const note = this.notes.get(noteId);

    if (!note) {
      return undefined;
    }

    const updatedNote: Note = {
      ...note,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.notes.set(noteId, updatedNote);
    return updatedNote;
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    return this.notes.delete(noteId);
  }

  /**
   * Search notes by content or title
   */
  searchNotes(userId: string, searchTerm: string): Note[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getUserNotes(userId);
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    return Array.from(this.notes.values())
      .filter(
        (note) =>
          note.userId === userId &&
          (note.title.toLowerCase().includes(lowerSearchTerm) ||
            note.content.toLowerCase().includes(lowerSearchTerm) ||
            note.tags?.some((tag) =>
              tag.toLowerCase().includes(lowerSearchTerm)
            ))
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  /**
   * Get notes by tag
   */
  getNotesByTag(userId: string, tag: string): Note[] {
    return Array.from(this.notes.values())
      .filter(
        (note) =>
          note.userId === userId &&
          note.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  /**
   * Get all unique tags for a user
   */
  getUserTags(userId: string): string[] {
    const tagSet = new Set<string>();

    Array.from(this.notes.values())
      .filter(
        (note) => note.userId === userId && note.tags && note.tags.length > 0
      )
      .forEach((note) => {
        note.tags?.forEach((tag) => tagSet.add(tag));
      });

    return Array.from(tagSet).sort();
  }

  /**
   * Generate a summary from multiple notes
   * For integration with AI services
   */
  generateSummaryFromNotes(notes: Note[]): string {
    if (notes.length === 0) {
      return "No notes available.";
    }

    const notesText = notes
      .map((note) => `Note: ${note.title}\n${note.content}`)
      .join("\n\n");

    return notesText;
  }
}

// Create a singleton instance
export const notesService = new NotesService();
