import mongoose from 'mongoose';
import SupportConversation from '../models/SupportConversation.js';
import SupportMessage from '../models/SupportMessage.js';

const paginate = (page = 1, limit = 50) => ({
  page: parseInt(page, 10) || 1,
  limit: Math.min(parseInt(limit, 10) || 50, 100)
});

const buildConversationIdFilter = (conversationId) => {
  const stringId = conversationId?.toString();
  if (!stringId) return { conversationId: null };
  if (mongoose.Types.ObjectId.isValid(stringId)) {
    return {
      $or: [
        { conversationId: stringId },
        { conversationId: new mongoose.Types.ObjectId(stringId) }
      ]
    };
  }
  return { conversationId: stringId };
};

const deriveUserId = (user) =>
  (user?.userId || user?.sub || user?.id || user?._id || '').toString();

const deriveUserName = (user, fallback = 'User') =>
  user?.name || user?.fullName || user?.email || deriveUserId(user) || fallback;

const deriveAdminId = (user) =>
  (user?.id || user?._id || user?.userId || user?.sub || '').toString();

const getAdminIdentity = (user) => ({
  adminId: deriveAdminId(user) || 'admin',
  adminName: deriveUserName(user, 'Admin')
});

const activeConversationQuery = (extra = {}) => ({
  deletedAt: null,
  ...extra
});

const findActiveConversationById = (conversationId) =>
  SupportConversation.findOne(activeConversationQuery({ _id: conversationId }));

export const createOrGetConversation = async (req, res) => {
  try {
    const userId = deriveUserId(req.user);
    const userName = deriveUserName(req.user, 'User');
    const { initialMessage } = req.body || {};

    let conversation = await SupportConversation.findOne(
      activeConversationQuery({
        userId,
        status: { $in: ['open', 'pending'] }
      })
    );

    if (!conversation) {
      conversation = await SupportConversation.create({
        userId,
        userName,
        status: 'open',
        lastMessage: initialMessage || 'Conversation created',
        lastMessageAt: new Date(),
        unreadForAdmin: initialMessage ? 1 : 0
      });

      if (initialMessage) {
        await SupportMessage.create({
          conversationId: conversation._id.toString(),
          senderType: 'user',
          senderId: userId,
          message: initialMessage
        });
      }
    }

    if (!conversation.userName) {
      conversation.userName = userName;
      await conversation.save();
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating support conversation',
      error: error.message
    });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const userId = deriveUserId(req.user);
    const { conversationId } = req.params;
    const { page, limit } = paginate(req.query.page, req.query.limit);

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await SupportMessage.find(buildConversationIdFilter(conversationId))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: messages.reverse(),
      pagination: { page, limit }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

const appendMessage = async ({ conversation, senderType, senderId, message }) => {
  const msg = await SupportMessage.create({
    conversationId: conversation._id.toString(),
    senderType,
    senderId,
    message
  });

  conversation.lastMessage = message;
  conversation.lastMessageAt = msg.createdAt;
  if (senderType === 'user') {
    conversation.unreadForAdmin += 1;
    conversation.unreadForUser = 0;
    if (conversation.status === 'open') {
      conversation.status = 'pending';
    }
  } else {
    conversation.unreadForUser += 1;
    conversation.unreadForAdmin = 0;
    if (conversation.status === 'pending') {
      conversation.status = 'open';
    }
  }
  await conversation.save();
  return msg;
};

export const postUserMessage = async (req, res) => {
  try {
    const userId = deriveUserId(req.user);
    const { conversationId } = req.params;
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const msg = await appendMessage({
      conversation,
      senderType: 'user',
      senderId: userId,
      message
    });

    res.json({ success: true, data: msg });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const userId = deriveUserId(req.user);
    const { conversationId } = req.params;

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conversation.unreadForUser = 0;
    await conversation.save();

    await SupportMessage.updateMany(
      {
        ...buildConversationIdFilter(conversationId),
        senderType: 'admin',
        readAt: null
      },
      { readAt: new Date() }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking conversation as read',
      error: error.message
    });
  }
};

// Admin controllers
export const getAdminConversations = async (req, res) => {
  try {
    const { status, userId, page, limit } = req.query;
    const pagination = paginate(page, limit);

    const query = activeConversationQuery({});
    if (status && status !== 'all') query.status = status;
    if (userId) query.userId = userId;

    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    const total = await SupportConversation.countDocuments(query);

    res.json({
      success: true,
      data: conversations,
      pagination: {
        ...pagination,
        total,
        pages: Math.ceil(total / pagination.limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
};

export const getConversationMessagesAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page, limit } = paginate(req.query.page, req.query.limit);

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await SupportMessage.find(buildConversationIdFilter(conversationId))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: messages.reverse(),
      pagination: { page, limit }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

export const postAdminMessage = async (req, res) => {
  try {
    const { adminId, adminName } = getAdminIdentity(req.user);
    const { conversationId } = req.params;
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.adminId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation chưa được nhận xử lý'
      });
    }

    if (conversation.adminId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Conversation đang do quản trị viên khác xử lý'
      });
    }

    const msg = await appendMessage({
      conversation,
      senderType: 'admin',
      senderId: adminId,
      message
    });

    res.json({ success: true, data: msg });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

export const assignConversation = async (req, res) => {
  try {
    const { adminId, adminName } = getAdminIdentity(req.user);
    const { conversationId } = req.params;

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conversation.adminId = adminId;
    conversation.adminName = adminName;
    conversation.status = 'open';
    await conversation.save();

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning conversation',
      error: error.message
    });
  }
};

export const updateConversationStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body || {};

    if (!['open', 'pending', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.adminName && conversation.adminId) {
      conversation.adminName = req.user.name || conversation.adminId;
    }

    conversation.status = status;
    if (status === 'closed') {
      conversation.unreadForAdmin = 0;
      conversation.unreadForUser = 0;
    }
    await conversation.save();

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating conversation status',
      error: error.message
    });
  }
};

export const markConversationReadAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await findActiveConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conversation.unreadForAdmin = 0;
    await conversation.save();

    await SupportMessage.updateMany(
      {
        ...buildConversationIdFilter(conversationId),
        senderType: 'user',
        readAt: null
      },
      { readAt: new Date() }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking conversation as read',
      error: error.message
    });
  }
};

export const deleteConversationAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.deletedAt) {
      conversation.deletedAt = new Date();
      conversation.status = 'closed';
      conversation.unreadForAdmin = 0;
      conversation.unreadForUser = 0;
      await conversation.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting conversation',
      error: error.message
    });
  }
};
