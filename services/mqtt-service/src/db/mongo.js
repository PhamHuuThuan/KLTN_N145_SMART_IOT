const mongoose = require('mongoose');
const config = require('../config');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;

  const uri = config.mongo.uri;
  const dbName = config.mongo.dbName;

  try {
    console.log('📊 Connecting to MongoDB...');
    console.log(`🔗 URI: ${uri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs
    console.log(`📁 Database: ${dbName}`);

    await mongoose.connect(uri, {
      dbName,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('✅ MongoDB connected successfully!');
    
    // Test the connection
    const adminDb = mongoose.connection.db.admin();
    await adminDb.ping();
    console.log('🏓 MongoDB ping successful');
    
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('🔍 Error details:', error);
    throw error;
  }
}

module.exports = { connectMongo };


