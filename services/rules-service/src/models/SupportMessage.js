import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    senderType: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    senderId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      trim: true,
      required: true
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

supportMessageSchema.index({ conversationId: 1, createdAt: -1 });

const SupportMessage =
  mongoose.models.SupportMessage ||
  mongoose.model('SupportMessage', supportMessageSchema);

export default SupportMessage;
