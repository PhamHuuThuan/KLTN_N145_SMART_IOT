import environment from '../config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

class SupportService {
  constructor() {
    this.baseURL = environment.getApiUrl('GATEWAY');
    this.log = createLogger('SupportService');
  }

  async getAuthToken() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || token === 'null' || token === 'undefined') {
        return null;
      }
      return token;
    } catch (error) {
      this.log.error('Error getting auth token:', error);
      return null;
    }
  }

  async request(path, options = {}) {
    const authToken = await this.getAuthToken();
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (_) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  createOrGetConversation(initialMessage) {
    return this.request('/api/support/conversations', {
      method: 'POST',
      body: JSON.stringify({ initialMessage })
    });
  }

  getMessages(conversationId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `/api/support/conversations/${conversationId}/messages${query ? `?${query}` : ''}`;
    return this.request(url);
  }

  sendMessage(conversationId, message) {
    return this.request(`/api/support/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  markRead(conversationId) {
    return this.request(`/api/support/conversations/${conversationId}/read`, {
      method: 'PATCH'
    });
  }
}

export default new SupportService();



