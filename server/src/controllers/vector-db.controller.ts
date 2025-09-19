import { Request, Response, Router } from "express";import { mongoVectorDbService } from "../services/mongo-vector-db.service"; // Assuming service path
// Removed express import as Router is used directly

const router = Router();

class VectorDbController {
  // POST /:userId/documents
  async addDocument(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { text, type, sourceId, metadata } = req.body;

      if (!text || !type) {
        res.status(400).json({ error: "Text and type are required" });
        return;
      }

      const document = await mongoVectorDbService.addDocument(
        userId,
        text,
        type,
        sourceId,
        metadata
      );
      res.status(201).json(document);
    } catch (error) {
      console.error("Error adding document to vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to add document to vector DB",
          details: (error as Error).message,
        });
    }
  }

  // GET /:userId/search
  async searchSimilar(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { query, type } = req.query;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!query) {
        res.status(400).json({ error: "Query is required" });
        return;
      }

      const results = await mongoVectorDbService.searchSimilar(
        userId,
        query as string,
        type as string,
        limit
      );
      res.json(results);
    } catch (error) {
      console.error("Error searching vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to search vector DB",
          details: (error as Error).message,
        });
    }
  }

  // GET /documents/:documentId
  async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const document = await mongoVectorDbService.getDocument(documentId);
      if (!document) {
        res.status(404).json({ error: "Document not found" });
        return;
      }
      res.json(document);
    } catch (error) {
      console.error("Error getting document from vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to get document from vector DB",
          details: (error as Error).message,
        });
    }
  }

  // PUT /documents/:documentId
  async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { text, metadata } = req.body;

      if (!text && !metadata) {
        res
          .status(400)
          .json({ error: "Either text or metadata must be provided" });
        return;
      }

      const document = await mongoVectorDbService.updateDocument(documentId, {
        text,
        metadata,
      });
      if (!document) {
        res.status(404).json({ error: "Document not found" });
        return;
      }
      res.json(document);
    } catch (error) {
      console.error("Error updating document in vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to update document in vector DB",
          details: (error as Error).message,
        });
    }
  }

  // DELETE /documents/:documentId
  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const success = await mongoVectorDbService.deleteDocument(documentId);
      if (!success) {
        res
          .status(404)
          .json({ error: "Document not found or could not be deleted" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document from vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to delete document from vector DB",
          details: (error as Error).message,
        });
    }
  }

  // DELETE /:userId/documents
  async deleteUserDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { type } = req.query;
      const deletedCount = await mongoVectorDbService.deleteUserDocuments(
        userId,
        type as string
      );
      res.json({ deletedCount });
    } catch (error) {
      console.error("Error deleting user documents from vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to delete user documents from vector DB",
          details: (error as Error).message,
        });
    }
  }

  // GET /:userId/count
  async countUserDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { type } = req.query;
      const count = await mongoVectorDbService.countUserDocuments(
        userId,
        type as string
      );
      res.json({ count });
    } catch (error) {
      console.error("Error counting user documents in vector DB:", error);
      res
        .status(500)
        .json({
          error: "Failed to count user documents in vector DB",
          details: (error as Error).message,
        });
    }
  }
}

const controller = new VectorDbController();

// Define routes
router.post("/:userId/documents", controller.addDocument.bind(controller));
router.get("/:userId/search", controller.searchSimilar.bind(controller));
router.get("/documents/:documentId", controller.getDocument.bind(controller));
router.put(
  "/documents/:documentId",
  controller.updateDocument.bind(controller)
);
router.delete(
  "/documents/:documentId",
  controller.deleteDocument.bind(controller)
);
router.delete(
  "/:userId/documents",
  controller.deleteUserDocuments.bind(controller)
);
router.get("/:userId/count", controller.countUserDocuments.bind(controller));

export default router;
