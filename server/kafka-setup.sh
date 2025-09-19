#!/bin/bash

# Kafka setup script for Synapse application
# This script creates all the required Kafka topics with appropriate configurations

# Config parameters
KAFKA_BOOTSTRAP_SERVER="localhost:9092"
REPLICATION_FACTOR=1  # Set to 3 for production clusters
PARTITIONS=3          # Number of partitions per topic
RETENTION_MS=604800000  # 7 days in milliseconds

# Check if Kafka is running
echo "Checking Kafka connection..."
kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Cannot connect to Kafka at $KAFKA_BOOTSTRAP_SERVER"
    echo "Make sure Kafka is running and the bootstrap server address is correct."
    exit 1
fi

# Function to create a topic if it doesn't exist
create_topic() {
    TOPIC_NAME=$1
    PARTITIONS=$2
    REPLICATION_FACTOR=$3
    RETENTION_MS=$4
    
    # Check if topic exists
    kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --list | grep -q "^$TOPIC_NAME$"
    if [ $? -eq 0 ]; then
        echo "Topic $TOPIC_NAME already exists."
    else
        echo "Creating topic $TOPIC_NAME..."
        kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP_SERVER \
            --create \
            --topic $TOPIC_NAME \
            --partitions $PARTITIONS \
            --replication-factor $REPLICATION_FACTOR \
            --config retention.ms=$RETENTION_MS \
            --config cleanup.policy=delete
        
        if [ $? -eq 0 ]; then
            echo "Successfully created topic $TOPIC_NAME"
        else
            echo "Failed to create topic $TOPIC_NAME"
        fi
    fi
}

echo "Setting up Kafka topics for Synapse application..."

# Create topics
create_topic "chat-message-requests" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS
create_topic "summarization-requests" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS
create_topic "context-analysis-requests" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS
create_topic "memory-operations" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS
create_topic "session-operations" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS
create_topic "activity-operations" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS
create_topic "action-operations" $PARTITIONS $REPLICATION_FACTOR $RETENTION_MS

# List all topics
echo -e "\nVerifying topics..."
kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --list

echo -e "\nKafka setup completed. All required topics have been created."
echo "You can now start the Synapse application with Kafka integration enabled."
echo "Set ENABLE_KAFKA=true in your environment variables or .env file."

# Print topic details
echo -e "\nTopic details:"
for topic in "chat-message-requests" "summarization-requests" "context-analysis-requests" "memory-operations" "session-operations" "activity-operations" "action-operations"; do
    echo -e "\n$topic:"
    kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --describe --topic $topic
done 