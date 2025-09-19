import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs";import { loggerFactory } from "../../utils/logger.service";

const logger = loggerFactory.getLogger("KafkaService");

/**
 * Service for handling Kafka operations
 */
class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private isConnected: boolean = false;

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "synapse-app",
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    logger.info(`Initialized Kafka with brokers: ${brokers.join(", ")}`);
  }

  /**
   * Check if Kafka is enabled
   */
  isEnabled(): boolean {
    return process.env.ENABLE_KAFKA !== "false";
  }

  /**
   * Get the producer instance, connecting if needed
   */
  async getProducer(): Promise<Producer> {
    if (!this.isConnected || !this.producer) {
      await this.connect();
    }

    if (!this.producer) {
      throw new Error("Failed to initialize Kafka producer");
    }

    return this.producer;
  }

  /**
   * Connect to Kafka and initialize producer
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug("Already connected to Kafka, skipping connection");
      return;
    }

    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

    try {
      logger.info(
        `Attempting to connect to Kafka brokers: ${brokers.join(", ")}`
      );

      if (!this.producer) {
        this.producer = this.kafka.producer();
        logger.debug("Kafka producer instance created");
      }

      await this.producer.connect();
      this.isConnected = true;
      logger.info("Successfully connected to Kafka and producer initialized");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(`Failed to connect to Kafka: ${errorMessage}`, {
        brokers,
        clientId: process.env.KAFKA_CLIENT_ID || "synapse-app",
        error: error instanceof Error ? error.stack : String(error),
      });

      this.isConnected = false;
      this.producer = null;

      throw new Error(`Kafka connection failed: ${errorMessage}`);
    }
  }

  /**
   * Produce a message to a topic
   */
  async produceMessage(
    topic: string,
    message: any,
    key?: string
  ): Promise<void> {
    if (!this.isConnected || !this.producer) {
      await this.connect();
    }

    try {
      await this.producer!.send({
        topic,
        messages: [
          {
            key: key || Date.now().toString(),
            value: JSON.stringify(message),
          },
        ],
      });
      logger.debug(`Produced message to topic ${topic}`);
    } catch (error) {
      logger.error(`Error producing message to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Create a consumer for a specific topic
   */
  async createConsumer(
    groupId: string,
    topics: string[],
    messageHandler: (message: EachMessagePayload) => Promise<void>
  ): Promise<void> {
    try {
      const consumer = this.kafka.consumer({ groupId });
      await consumer.connect();

      for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
      }

      await consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            await messageHandler(payload);
          } catch (error) {
            logger.error(
              `Error processing message from topic ${payload.topic}:`,
              error
            );
          }
        },
      });

      this.consumers.set(groupId, consumer);
      logger.info(
        `Consumer created for topics: ${topics.join(", ")} with group ID: ${groupId}`
      );
    } catch (error) {
      logger.error(
        `Error creating consumer for topics ${topics.join(", ")}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Consume messages from a specific topic with a message handler
   * This is a convenience method that creates a consumer and starts consuming messages
   */
  async consumeMessages(
    topic: string,
    groupId: string,
    messageHandler: (payload: EachMessagePayload) => Promise<void>
  ): Promise<void> {
    return this.createConsumer(groupId, [topic], messageHandler);
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }

      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        logger.info(`Disconnected consumer with group ID: ${groupId}`);
      }

      this.isConnected = false;
      logger.info("Disconnected from Kafka");
    } catch (error) {
      logger.error("Error disconnecting from Kafka:", error);
      throw error;
    }
  }
}

export const kafkaService = new KafkaService();
