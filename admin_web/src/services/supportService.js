import api from '../utils/api';

class SupportService {
  async getConversations(params = {}) {
    const response = await api.get('/api/admin/support/conversations', { params });
    return response.data;
  }

  async getMessages(conversationId, params = {}) {
    const response = await api.get(`/api/admin/support/conversations/${conversationId}/messages`, {
      params
    });
    return response.data;
  }

  async sendMessage(conversationId, message) {
    const response = await api.post(`/api/admin/support/conversations/${conversationId}/messages`, {
      message
    });
    return response.data;
  }

  async assignConversation(conversationId) {
    const response = await api.patch(
      `/api/admin/support/conversations/${conversationId}/assign`
    );
    return response.data;
  }

  async updateStatus(conversationId, status) {
    const response = await api.patch(
      `/api/admin/support/conversations/${conversationId}/status`,
      { status }
    );
    return response.data;
  }

  async markRead(conversationId) {
    const response = await api.patch(`/api/admin/support/conversations/${conversationId}/read`);
    return response.data;
  }

  async deleteConversation(conversationId) {
    const response = await api.delete(`/api/admin/support/conversations/${conversationId}`);
    return response.data;
  }
}

export default new SupportService();
