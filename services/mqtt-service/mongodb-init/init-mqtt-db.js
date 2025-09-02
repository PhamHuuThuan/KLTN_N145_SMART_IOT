// MongoDB initialization script for MQTT Service
// This script sets up the initial database structure

// Switch to mqtt_service database
db = db.getSiblingDB('mqtt_service');

// Create collections with proper indexes
db.createCollection('mqtt_messages');
db.createCollection('device_sessions');
db.createCollection('topic_subscriptions');
db.createCollection('message_history');

// Create indexes for better performance
db.mqtt_messages.createIndex({ "topic": 1 });
db.mqtt_messages.createIndex({ "timestamp": -1 });
db.mqtt_messages.createIndex({ "device_id": 1 });
db.mqtt_messages.createIndex({ "message_type": 1 });

db.device_sessions.createIndex({ "client_id": 1 }, { unique: true });
db.device_sessions.createIndex({ "last_seen": -1 });
db.device_sessions.createIndex({ "device_id": 1 });

db.topic_subscriptions.createIndex({ "topic": 1 });
db.topic_subscriptions.createIndex({ "client_id": 1 });
db.topic_subscriptions.createIndex({ "timestamp": -1 });

db.message_history.createIndex({ "topic": 1 });
db.message_history.createIndex({ "timestamp": -1 });
db.message_history.createIndex({ "device_id": 1 });

// Create TTL index for message history (auto-delete after 30 days)
db.message_history.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 2592000 });

// Insert sample data for testing
db.mqtt_messages.insertOne({
    topic: "iot/test/telemetry",
    payload: {
        device_id: "TEST-ESP32-001",
        temperature: 25.5,
        humidity: 60.2,
        timestamp: new Date()
    },
    qos: 1,
    retain: false,
    timestamp: new Date(),
    message_type: "telemetry"
});

db.device_sessions.insertOne({
    client_id: "TEST-ESP32-001",
    device_id: "TEST-ESP32-001",
    ip_address: "192.168.1.100",
    connected_at: new Date(),
    last_seen: new Date(),
    status: "connected",
    topics: ["iot/test/telemetry", "iot/test/control"]
});

db.topic_subscriptions.insertOne({
    topic: "iot/+/telemetry",
    client_id: "mqtt-service",
    qos: 1,
    timestamp: new Date(),
    active: true
});

print("MQTT Service database initialized successfully!");
print("Collections created: mqtt_messages, device_sessions, topic_subscriptions, message_history");
print("Indexes created for optimal performance");
print("Sample data inserted for testing");
