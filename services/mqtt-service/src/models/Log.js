const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['telemetry', 'ack', 'command'], required: true },
    deviceId: { type: String, index: true },
    topic: { type: String },
    payload: { type: Object },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Log', LogSchema);


