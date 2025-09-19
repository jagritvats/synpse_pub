import { v4 as uuidv4 } from "uuid";

/**
 * Interface for a document to be stored in the vector database
 * Inspired by NestJS implementation in ../server/src/shared/services/vector-db.service.ts
 */
export interface VectorDocument {
  id: string;
  userId: string;
  text: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Interface for vector search results
 */
export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
}

/**
 * Simple in-memory vector database service
 * In production, this would be replaced with a real vector database like Pinecone, Qdrant, or MongoDB Atlas
 */
class VectorDbService {
  private documents: Map<string, VectorDocument> = new Map();

  /**
   * Add a document to the vector database
   */
  async addDocument(
    userId: string,
    text: string,
    metadata?: Record<string, any>
  ): Promise<VectorDocument> {
    // In a real implementation, we would generate embeddings using an embedding model
    // For now, we'll just use a simple mock embedding (random values)
    const mockEmbedding = Array.from(
      { length: 384 },
      () => Math.random() * 2 - 1
    );

    const document: VectorDocument = {
      id: uuidv4(),
      userId,
      text,
      embedding: mockEmbedding,
      metadata,
      createdAt: new Date().toISOString(),
    };

    this.documents.set(document.id, document);

    console.log(`Added document to vector store: ${document.id}`);
    return document;
  }

  /**
   * Search for documents similar to the query text
   * In a real implementation, this would use cosine similarity with embeddings
   */
  async searchSimilar(
    userId: string,
    queryText: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    // For now, we'll use a simple keyword matching approach
    const userDocuments = Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId
    );

    if (userDocuments.length === 0) {
      return [];
    }

    // Generate a simple mock embedding for the query
    const mockQueryEmbedding = Array.from(
      { length: 384 },
      () => Math.random() * 2 - 1
    );

    // Compute simple dot product similarity (not normalized)
    const results = userDocuments.map((doc) => {
      // If no embedding, use a low similarity score
      if (!doc.embedding) {
        return { document: doc, score: 0.1 };
      }

      // Compute dot product between query embedding and document embedding
      let dotProduct = 0;
      for (let i = 0; i < mockQueryEmbedding.length; i++) {
        dotProduct += mockQueryEmbedding[i] * doc.embedding[i];
      }

      // Keyword matching bonus
      const keywords = queryText.toLowerCase().split(/\s+/);
      const textContent = doc.text.toLowerCase();

      // Add bonus for keyword matches
      keywords.forEach((keyword) => {
        if (keyword.length > 3 && textContent.includes(keyword)) {
          dotProduct += 0.2;
        }
      });

      return { document: doc, score: dotProduct };
    });

    // Sort by score and return top results
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null;
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  /**
   * Delete all documents for a user
   */
  async deleteUserDocuments(userId: string): Promise<number> {
    let count = 0;

    for (const [id, doc] of this.documents.entries()) {
      if (doc.userId === userId) {
        this.documents.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Count documents for a user
   */
  async countUserDocuments(userId: string): Promise<number> {
    let count = 0;

    for (const doc of this.documents.values()) {
      if (doc.userId === userId) {
        count++;
      }
    }

    return count;
  }
}

// Create a singleton instance
export const vectorDbService = new VectorDbService();
