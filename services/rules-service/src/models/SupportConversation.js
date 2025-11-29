import mongoose from 'mongoose';

const supportConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    userName: {
      type: String,
      default: ''
    },
    adminId: {
      type: String,
      default: null,
      index: true
    },
    adminName: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'closed'],
      default: 'open',
      index: true
    },
    lastMessage: {
      type: String,
      default: ''
    },
    unreadForAdmin: {
      type: Number,
      default: 0
    },
    unreadForUser: {
      type: Number,
      default: 0
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

supportConversationSchema.index({ userId: 1, status: 1 });
supportConversationSchema.index({ adminId: 1, status: 1 });

const SupportConversation =
  mongoose.models.SupportConversation ||
  mongoose.model('SupportConversation', supportConversationSchema);

export default SupportConversation;
