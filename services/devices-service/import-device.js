import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Device model
import Device from './src/models/Device.js';

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_iot');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

// Import device data
const importDevice = async () => {
  try {
    // Read device data from JSON file
    const deviceDataPath = path.join(__dirname, 'device-import.json');
    const deviceData = JSON.parse(fs.readFileSync(deviceDataPath, 'utf8'));
    
    console.log('📋 Device data loaded:', deviceData.length, 'devices');
    
    // Clear existing devices (optional)
    const deleteResult = await Device.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing devices`);
    
    // Import new devices
    const importedDevices = await Device.insertMany(deviceData);
    console.log(`✅ Successfully imported ${importedDevices.length} devices`);
    
    // Display imported devices
    importedDevices.forEach((device, index) => {
      console.log(`\n📱 Device ${index + 1}:`);
      console.log(`   ID: ${device.deviceId}`);
      console.log(`   Name: ${device.name}`);
      console.log(`   Type: ${device.type}`);
      console.log(`   Status: ${device.status}`);
      console.log(`   Outlets: ${device.outlets.length}`);
    });
    
    console.log('\n🎉 Device import completed successfully!');
    
  } catch (error) {
    console.error('❌ Error importing devices:', error.message);
    console.error('🔍 Error details:', error);
  }
};

// Main execution
const main = async () => {
  try {
    console.log('🚀 Starting device import...');
    
    // Connect to MongoDB
    await connectDB();
    
    // Import devices
    await importDevice();
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
};

// Run the script
main();
