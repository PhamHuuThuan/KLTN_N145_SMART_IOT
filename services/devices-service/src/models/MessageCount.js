import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const MessageCountSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  kind: { type: String, required: true },
  topic: { type: String },
  deviceId: { type: String },
  date: { type: String },
  count: { type: Number, default: 0 }
}, { timestamps: true });

MessageCountSchema.statics.increment = async function ({ kind, topic, deviceId, date }) {
  try {
    const keyParts = [kind];
    if (topic) keyParts.push(topic);
    if (deviceId) keyParts.push(deviceId);
    if (date) keyParts.push(date);
    const key = keyParts.join('|');
    const filter = { key };
    const update = {
      $setOnInsert: { kind, topic: topic || null, deviceId: deviceId || null, date: date || null },
      $inc: { count: 1 }
    };
    const opts = { upsert: true };
    await this.updateOne(filter, update, opts).exec();
  } catch (err) {
    logger.error('MessageCount.increment error', { err: err.message });
  }
};

const MessageCount = mongoose.model('MessageCount', MessageCountSchema);

export default MessageCount;
