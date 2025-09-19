import mongoose from "mongoose";import dotenv from "dotenv";
import { EventEmitter } from "events";

// Load environment variables
dotenv.config();

// MongoDB connection string from environment variables
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/synapse";

// Connection options
const options = {
  autoIndex: true,
  minPoolSize: 5, // Maintain at least 5 connections
  maxPoolSize: 10, // Maintain up to 10 connections
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

/**
 * Database connection manager for centralized connection handling
 */
class DatabaseService extends EventEmitter {
  private connectionPromise: Promise<typeof mongoose> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectInterval = 30000; // 30 seconds
  private maxReconnectAttempts = 10;
  private reconnectAttempts = 0;

  constructor() {
    super();

    // Set up connection event listeners
    mongoose.connection.on("error", (err) => {
      console.error(`MongoDB connection error: ${err}`);
      this.emit("error", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
      this.emit("disconnected");
      this.scheduleReconnect();
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
      this.emit("reconnected");
      this.reconnectAttempts = 0;
    });

    // Connect on initialization
    this.connect();
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<typeof mongoose> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = mongoose
      .connect(MONGODB_URI, options)
      .then((connection) => {
        console.log(`MongoDB connected: ${connection.connection.host}`);
        this.emit("connected");
        this.reconnectAttempts = 0;
        return connection;
      })
      .catch((error) => {
        console.error(
          `Error connecting to MongoDB: ${error instanceof Error ? error.message : String(error)}`
        );
        this.emit("error", error);
        this.connectionPromise = null;
        this.scheduleReconnect();
        throw error;
      });

    return this.connectionPromise;
  }

  /**
   * Disconnect from MongoDB - useful for graceful shutdowns
   */
  async disconnect(): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      await mongoose.disconnect();
      console.log("MongoDB disconnected");
      this.connectionPromise = null;
    } catch (error) {
      console.error(
        `Error disconnecting from MongoDB: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if MongoDB is connected
   */
  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): number {
    return mongoose.connection.readyState;
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (
      this.reconnectTimer ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error(
          `Max reconnect attempts (${this.maxReconnectAttempts}) reached`
        );
        this.emit("maxReconnectAttemptsReached");
      }
      return;
    }

    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      console.log(
        `Attempting to reconnect to MongoDB (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      this.reconnectTimer = null;
      this.connect().catch(() => {}); // Catch to prevent unhandled promise rejection
    }, this.reconnectInterval);
  }
}

// Create a singleton instance
export const databaseService = new DatabaseService();

// Connect to MongoDB
export const connectToDatabase = async (): Promise<typeof mongoose> => {
  return databaseService.connect();
};

/**
 * Disconnect from MongoDB - useful for graceful shutdowns
 */
export const disconnectFromDatabase = async (): Promise<void> => {
  return databaseService.disconnect();
};

// Handle application shutdown
process.on("SIGINT", async () => {
  await disconnectFromDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectFromDatabase();
  process.exit(0);
});

// Export the mongoose connection
export default mongoose.connection;
