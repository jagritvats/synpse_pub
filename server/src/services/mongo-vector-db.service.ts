import {
  VectorDocument,
  IVectorDocument,
} from "../models/vector-document.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Interface for vector search results
 */
export interface VectorSearchResult {
  document: IVectorDocument;
  score: number;
}

/**
 * MongoDB-based vector database service
 * A more production-ready implementation than the in-memory version
 */
class MongoVectorDbService {
  /**
   * Add a document to the vector database
   */
  async addDocument(
    userId: string,
    text: string,
    type: string,
    sourceId?: string,
    metadata?: Record<string, any>
  ): Promise<IVectorDocument> {
    // In a real implementation, we would generate embeddings using an embedding model
    // For now, we'll just use a simple mock embedding (random values)
    const mockEmbedding = Array.from(
      { length: 384 },
      () => Math.random() * 2 - 1
    );

    const document = new VectorDocument({
      userId,
      text,
      embedding: mockEmbedding,
      metadata: metadata || {},
      createdAt: new Date(),
      type,
      sourceId,
    });

    await document.save();
    console.log(`Added document to MongoDB vector store: ${document._id}`);
    return document;
  }

  /**
   * Search for documents similar to the query text
   * In a real implementation, this would use cosine similarity with embeddings
   */
  async searchSimilar(
    userId: string,
    queryText: string,
    type?: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    // Build query
    const query: any = { userId };

    if (type) {
      query.type = type;
    }

    // Get documents for the user
    const documents = await VectorDocument.find(query).exec();

    if (documents.length === 0) {
      return [];
    }

    // Generate a simple mock embedding for the query
    // In production, you would use a real embedding model
    const mockQueryEmbedding = Array.from(
      { length: 384 },
      () => Math.random() * 2 - 1
    );

    // Compute simple similarity scores
    // In production, you would use a real vector similarity search
    const results = documents.map((doc) => {
      // Compute simple keyword similarity
      const keywords = queryText.toLowerCase().split(/\s+/);
      const textContent = doc.text.toLowerCase();

      let score = 0;

      // Add bonus for keyword matches
      keywords.forEach((keyword) => {
        if (keyword.length > 3 && textContent.includes(keyword)) {
          score += 0.2;
        }
      });

      // Dot product with embedding (simulated)
      // In production, you would compute actual cosine similarity
      if (doc.embedding && doc.embedding.length > 0) {
        // Add a small random factor for demo purposes
        score += Math.random() * 0.3;
      }

      return { document: doc, score };
    });

    // Sort by score and return top results
    return results
      .filter((result) => result.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<IVectorDocument | null> {
    return VectorDocument.findById(id).exec();
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    try {
      const result = await VectorDocument.findByIdAndDelete(id).exec();
      return !!result;
    } catch (error) {
      console.error(`Error deleting vector document ${id}:`, error);
      return false;
    }
  }

  /**
   * Delete all documents for a user of a specific type
   */
  async deleteUserDocuments(userId: string, type?: string): Promise<number> {
    try {
      const query: any = { userId };

      if (type) {
        query.type = type;
      }

      const result = await VectorDocument.deleteMany(query).exec();
      return result.deletedCount || 0;
    } catch (error) {
      console.error(`Error deleting user vector documents:`, error);
      return 0;
    }
  }

  /**
   * Count documents for a user
   */
  async countUserDocuments(userId: string, type?: string): Promise<number> {
    const query: any = { userId };

    if (type) {
      query.type = type;
    }

    return VectorDocument.countDocuments(query).exec();
  }

  /**
   * Update a document's text and regenerate embedding
   */
  async updateDocument(
    id: string,
    updates: {
      text?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<IVectorDocument | null> {
    try {
      const doc = await VectorDocument.findById(id).exec();

      if (!doc) {
        return null;
      }

      // Update fields
      if (updates.text) {
        doc.text = updates.text;

        // Regenerate embedding if text changed
        // In production, you would use a real embedding model
        doc.embedding = Array.from(
          { length: 384 },
          () => Math.random() * 2 - 1
        );
      }

      if (updates.metadata) {
        doc.metadata = {
          ...doc.metadata,
          ...updates.metadata,
        };
      }

      // Save and return updated document
      await doc.save();
      return doc;
    } catch (error) {
      console.error(`Error updating vector document ${id}:`, error);
      return null;
    }
  }
}

// Create singleton instance
export const mongoVectorDbService = new MongoVectorDbService();
