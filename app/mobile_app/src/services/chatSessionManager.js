import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatSession');

class ChatSessionManager {
  constructor() {
    this.SESSION_KEY_PREFIX = 'chat_session_';
    this.CURRENT_SESSION_KEY = 'current_chat_session';
  }

  // Generate session ID based on user ID and timestamp
  generateSessionId(userId) {
    const timestamp = Date.now();
    return `${userId}_${timestamp}`;
  }

  // Get current session ID
  async getCurrentSessionId() {
    try {
      return await AsyncStorage.getItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      log.error('Error getting current session ID:', error);
      return null;
    }
  }

  // Set current session ID
  async setCurrentSessionId(sessionId) {
    try {
      await AsyncStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
      log.info('Current session ID set:', sessionId);
    } catch (error) {
      log.error('Error setting current session ID:', error);
    }
  }

  // Create new session
  async createNewSession(userId) {
    try {
      const sessionId = this.generateSessionId(userId);
      await this.setCurrentSessionId(sessionId);
      
      // Initialize session with welcome messages
      const welcomeMessages = [
        {
          id: 'welcome_1',
          userId: 'bot',
          text: 'Xin chào! Tôi có thể giúp bạn điều khiển các ổ cắm thông minh. Thử nói \'Bật ổ cắm 1\' để bật ổ cắm 1.',
          time: Date.now() - 60000
        },
        {
          id: 'welcome_2',
          userId: 'bot',
          text: 'Lệnh giọng nói: \'Bật/Tắt ổ cắm [số]\' hoặc \'Bật/Tắt tất cả ổ cắm\'',
          time: Date.now() - 30000
        }
      ];

      await this.saveMessages(sessionId, welcomeMessages);
      log.info('New session created:', sessionId);
      return sessionId;
    } catch (error) {
      log.error('Error creating new session:', error);
      return null;
    }
  }

  // Save messages to session
  async saveMessages(sessionId, messages) {
    try {
      const key = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      await AsyncStorage.setItem(key, JSON.stringify(messages));
      log.info(`Saved ${messages.length} messages to session:`, sessionId);
    } catch (error) {
      log.error('Error saving messages:', error);
    }
  }

  // Load messages from session
  async loadMessages(sessionId) {
    try {
      const key = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      const messagesJson = await AsyncStorage.getItem(key);
      
      if (messagesJson) {
        const messages = JSON.parse(messagesJson);
        log.info(`Loaded ${messages.length} messages from session:`, sessionId);
        return messages;
      }
      
      return [];
    } catch (error) {
      log.error('Error loading messages:', error);
      return [];
    }
  }

  // Add single message to current session
  async addMessage(message) {
    try {
      const sessionId = await this.getCurrentSessionId();
      if (!sessionId) {
        log.warn('No current session found, cannot add message');
        return;
      }

      const messages = await this.loadMessages(sessionId);
      messages.push(message);
      await this.saveMessages(sessionId, messages);
      log.info('Added message to session:', message.id);
    } catch (error) {
      log.error('Error adding message:', error);
    }
  }

  // Update messages in current session
  async updateMessages(messages) {
    try {
      const sessionId = await this.getCurrentSessionId();
      if (!sessionId) {
        log.warn('No current session found, cannot update messages');
        return;
      }

      await this.saveMessages(sessionId, messages);
      log.info('Updated messages in session:', sessionId);
    } catch (error) {
      log.error('Error updating messages:', error);
    }
  }

  // Get all sessions for a user
  async getUserSessions(userId) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(this.SESSION_KEY_PREFIX));
      
      const sessions = [];
      for (const key of sessionKeys) {
        const sessionId = key.replace(this.SESSION_KEY_PREFIX, '');
        if (sessionId.startsWith(userId + '_')) {
          const messages = await this.loadMessages(sessionId);
          sessions.push({
            sessionId,
            messageCount: messages.length,
            lastMessage: messages[messages.length - 1]?.time || 0,
            createdAt: parseInt(sessionId.split('_')[1])
          });
        }
      }
      
      // Sort by creation time (newest first)
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      return sessions;
    } catch (error) {
      log.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Delete session
  async deleteSession(sessionId) {
    try {
      const key = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      await AsyncStorage.removeItem(key);
      log.info('Session deleted:', sessionId);
    } catch (error) {
      log.error('Error deleting session:', error);
    }
  }

  // Clear all sessions for a user
  async clearUserSessions(userId) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => 
        key.startsWith(this.SESSION_KEY_PREFIX) && 
        key.includes(`${userId}_`)
      );
      
      await AsyncStorage.multiRemove(sessionKeys);
      log.info(`Cleared ${sessionKeys.length} sessions for user:`, userId);
    } catch (error) {
      log.error('Error clearing user sessions:', error);
    }
  }

  // Clear current session
  async clearCurrentSession() {
    try {
      await AsyncStorage.removeItem(this.CURRENT_SESSION_KEY);
      log.info('Current session cleared');
    } catch (error) {
      log.error('Error clearing current session:', error);
    }
  }

  // Initialize session on login
  async initializeSessionOnLogin(userId) {
    try {
      // Check if user already has a recent session (within last 24 hours)
      const sessions = await this.getUserSessions(userId);
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      // Find most recent session within 24 hours
      const recentSession = sessions.find(session => 
        (now - session.createdAt) < oneDayMs
      );
      
      if (recentSession) {
        // Continue existing session
        await this.setCurrentSessionId(recentSession.sessionId);
        log.info('Continuing existing session:', recentSession.sessionId);
        return recentSession.sessionId;
      } else {
        // Create new session
        return await this.createNewSession(userId);
      }
    } catch (error) {
      log.error('Error initializing session on login:', error);
      return await this.createNewSession(userId);
    }
  }

  // Clean up old sessions (older than 7 days)
  async cleanupOldSessions() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(this.SESSION_KEY_PREFIX));
      
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const keysToDelete = [];
      
      for (const key of sessionKeys) {
        const sessionId = key.replace(this.SESSION_KEY_PREFIX, '');
        const timestamp = parseInt(sessionId.split('_').pop());
        
        if (timestamp && (now - timestamp) > sevenDaysMs) {
          keysToDelete.push(key);
        }
      }
      
      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
        log.info(`Cleaned up ${keysToDelete.length} old sessions`);
      }
    } catch (error) {
      log.error('Error cleaning up old sessions:', error);
    }
  }
}

export default new ChatSessionManager();
