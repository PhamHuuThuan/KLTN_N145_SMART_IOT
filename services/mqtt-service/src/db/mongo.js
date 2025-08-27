const mongoose = require('mongoose');
const config = require('../config');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;

  const uri = config.mongo.uri;
  const dbName = config.mongo.dbName;

  await mongoose.connect(uri, {
    dbName,
  });

  isConnected = true;
  return mongoose.connection;
}

module.exports = { connectMongo };


