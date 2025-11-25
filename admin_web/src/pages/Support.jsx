import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import supportService from '../services/supportService';

function Support({ currentUser }) {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const currentAdminId =
    currentUser?.id || currentUser?._id || currentUser?.userId || currentUser?.sub || '';

  const fetchConversations = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await supportService.getConversations({
          status: statusFilter === 'all' ? undefined : statusFilter
        });
        const conversationList = response.data || [];
        setConversations(conversationList);
        setSelectedConversation((prev) => {
          if (!conversationList.length) return null;
          if (!prev) return conversationList[0];
          const updated = conversationList.find((conv) => conv._id === prev._id);
          return updated || conversationList[0];
        });
      } catch (err) {
        setError(t('support.loadError'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [statusFilter, t]
  );

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const response = await supportService.getMessages(conversationId);
      setMessages(response.data || []);
      await supportService.markRead(conversationId);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const selectedConversationId = selectedConversation?._id;
  const canSendMessage =
    !!selectedConversation &&
    selectedConversation.adminId &&
    selectedConversation.adminId === currentAdminId;

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId, fetchMessages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations({ silent: true });
      if (selectedConversationId) {
        fetchMessages(selectedConversationId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, selectedConversationId]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation._id);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !canSendMessage) return;
    try {
      setSending(true);
      await supportService.sendMessage(selectedConversation._id, messageInput.trim());
      setMessageInput('');
      fetchMessages(selectedConversation._id);
      fetchConversations();
    } catch (err) {
      console.error('Error sending support message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedConversation) return;
    const response = await supportService.assignConversation(selectedConversation._id);
    const updated = response?.data;
    if (updated?._id) {
      setSelectedConversation((prev) => (prev?._id === updated._id ? updated : prev));
    }
    fetchConversations();
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;
    await supportService.updateStatus(selectedConversation._id, 'closed');
    fetchConversations();
    setSelectedConversation(null);
    setMessages([]);
  };

  const handleReopenConversation = async () => {
    if (!selectedConversation) return;
    const response = await supportService.updateStatus(selectedConversation._id, 'open');
    const updated = response?.data;
    if (updated?._id) {
      setSelectedConversation((prev) => (prev?._id === updated._id ? updated : prev));
    }
    fetchConversations();
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    const confirmed = window.confirm(t('support.deleteConfirm'));
    if (!confirmed) return;
    try {
      await supportService.deleteConversation(selectedConversation._id);
      setSelectedConversation(null);
      setMessages([]);
      fetchConversations();
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{t('support.title')}</h1>
      <div style={styles.supportLayout}>
        <div style={styles.sidebar}>
          <div style={styles.filterRow}>
            <label>{t('support.statusFilter')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">{t('support.all')}</option>
              <option value="open">{t('support.open')}</option>
              <option value="pending">{t('support.pending')}</option>
              <option value="closed">{t('support.closed')}</option>
            </select>
          </div>
          {loading ? (
            <div style={styles.notice}>{t('common.loading')}</div>
          ) : conversations.length === 0 ? (
            <div style={styles.notice}>{t('support.empty')}</div>
          ) : (
            <div style={styles.list}>
              {conversations.map((conversation) => (
                <div
                  key={conversation._id}
                  style={{
                    ...styles.conversationItem,
                    ...(selectedConversation?._id === conversation._id
                      ? styles.conversationItemActive
                      : {})
                  }}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div style={styles.conversationHeader}>
                    <span style={styles.conversationUser}>
                      {t('support.user')}: {conversation.userName || conversation.userId}
                    </span>
                    <span style={styles.conversationStatus}>
                      {t(`support.${conversation.status}`)}
                    </span>
                  </div>
                  <div style={styles.conversationMessage}>{conversation.lastMessage}</div>
                  <div style={styles.handlerRow}>
                    <span style={styles.handlerLabel}>{t('support.handlerLabel')}:</span>
                    <span style={styles.handlerValue}>
                      {conversation.adminId && conversation.adminId !== conversation.userId
                        ? conversation.adminName || conversation.adminId
                        : t('support.unassigned')}
                    </span>
                  </div>
                  <div style={styles.conversationMeta}>
                    <span>
                      {t('support.updatedAt')}: {new Date(conversation.updatedAt).toLocaleString()}
                    </span>
                    {conversation.unreadForAdmin > 0 && (
                      <span style={styles.unreadBadge}>{conversation.unreadForAdmin}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.chatPanel}>
          {error && <div style={styles.error}>{error}</div>}
          {!selectedConversation ? (
            <div style={styles.placeholder}>{t('support.noConversation')}</div>
          ) : (
            <>
              <div style={styles.chatHeader}>
                <div>
                  <div style={styles.chatTitle}>
                    {selectedConversation.userName || selectedConversation.userId}
                  </div>
                  <div style={styles.chatSubtitle}>
                    {selectedConversation.adminId &&
                    selectedConversation.adminId !== selectedConversation.userId ? (
                      <>
                        <span>{t('support.handlerLabel')}:</span>{' '}
                        <strong>
                          {selectedConversation.adminName || selectedConversation.adminId}
                        </strong>
                      </>
                    ) : (
                      t('support.unassigned')
                    )}
                  </div>
                </div>
                <div style={styles.headerActions}>
                  <button style={styles.secondaryButton} onClick={handleAssign}>
                    {t('support.assign')}
                  </button>
                  {selectedConversation.status === 'closed' ? (
                    <button style={styles.primaryButton} onClick={handleReopenConversation}>
                      {t('support.reopen')}
                    </button>
                  ) : (
                    <button style={styles.dangerButton} onClick={handleCloseConversation}>
                      {t('support.close')}
                    </button>
                  )}
                  <button style={styles.deleteButton} onClick={handleDeleteConversation}>
                    {t('support.delete')}
                  </button>
                </div>
              </div>
              {!selectedConversation.adminId && (
                <div style={styles.warningBanner}>{t('support.assignRequired')}</div>
              )}
              {selectedConversation.adminId &&
                selectedConversation.adminId !== currentAdminId && (
                  <div style={styles.warningBanner}>{t('support.assignedToOther')}</div>
                )}
              <div style={styles.messages}>
                {messages.map((msg) => (
                  <div
                    key={msg._id}
                    style={{
                      ...styles.message,
                      ...(msg.senderType === 'admin'
                        ? styles.messageAdmin
                        : styles.messageUser)
                    }}
                  >
                    <div style={styles.messageMeta}>
                      {msg.senderType === 'admin' ? t('support.admin') : t('support.user')}
                      {' · '}
                      {new Date(msg.createdAt).toLocaleString()}
                    </div>
                    <div>{msg.message}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div style={styles.inputRow}>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={t('support.messagePlaceholder')}
                  style={styles.textarea}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!canSendMessage}
                />
                <button
                  style={styles.primaryButton}
                  onClick={handleSendMessage}
                  disabled={sending || !canSendMessage}
                >
                  {sending ? t('common.loading') : t('support.send')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '20px'
  },
  supportLayout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '20px'
  },
  sidebar: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    height: 'calc(100vh - 180px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  filterRow: {
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  select: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db'
  },
  list: {
    overflowY: 'auto'
  },
  conversationItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '10px',
    marginBottom: '10px',
    cursor: 'pointer'
  },
  conversationItemActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff'
  },
  conversationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    fontWeight: '600',
    flexWrap: 'wrap',
    gap: '4px'
  },
  conversationUser: {
    fontSize: '14px',
    flex: '1 1 auto',
    wordBreak: 'break-word'
  },
  conversationStatus: {
    fontSize: '12px',
    textTransform: 'none',
    color: '#2563eb',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  conversationMessage: {
    fontSize: '13px',
    color: '#4b5563',
    marginBottom: '4px'
  },
  handlerRow: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap'
  },
  handlerLabel: {
    fontWeight: '600'
  },
  handlerValue: {
    fontWeight: '500'
  },
  conversationMeta: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    color: 'white',
    borderRadius: '9999px',
    padding: '2px 8px',
    fontSize: '10px'
  },
  chatPanel: {
    backgroundColor: 'white',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 180px)'
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb'
  },
  chatTitle: {
    fontSize: '18px',
    fontWeight: '600',
    wordBreak: 'break-word'
  },
  chatSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    wordBreak: 'break-word'
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  message: {
    borderRadius: '8px',
    padding: '10px 12px',
    maxWidth: '70%'
  },
  messageUser: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6'
  },
  messageAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe'
  },
  messageMeta: {
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '4px'
  },
  inputRow: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '12px',
    display: 'flex',
    gap: '12px'
  },
  textarea: {
    flex: 1,
    borderRadius: '8px',
    padding: '10px',
    border: '1px solid #d1d5db',
    resize: 'none'
  },
  primaryButton: {
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer'
  },
  secondaryButton: {
    padding: '8px 12px',
    border: '1px solid #94a3b8',
    borderRadius: '6px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  dangerButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#ef4444',
    color: 'white',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '8px 12px',
    border: '1px solid #f87171',
    borderRadius: '6px',
    backgroundColor: '#fff5f5',
    color: '#b91c1c',
    cursor: 'pointer'
  },
  warningBanner: {
    margin: '12px 0',
    padding: '10px 14px',
    borderRadius: '6px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: '13px'
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '16px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '8px 12px',
    borderRadius: '6px',
    marginBottom: '12px'
  },
  notice: {
    color: '#6b7280',
    fontSize: '14px',
    padding: '12px'
  }
};

export default Support;
