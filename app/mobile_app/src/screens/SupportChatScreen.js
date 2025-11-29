import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import supportService from '../services/supportService';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const KEYBOARD_OFFSET = Platform.OS === 'ios' ? 80 : 30;

const SupportChatScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const fetchConversation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await supportService.createOrGetConversation();
      setConversation(response.data);
      await fetchMessages(response.data._id);
    } catch (err) {
      setError(err.message || t('support.chatError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      try {
        const response = await supportService.getMessages(conversationId);
        setMessages(response.data || []);
        await supportService.markRead(conversationId);
      } catch (err) {
        setError(err.message || t('support.chatError'));
      }
    },
    [t]
  );

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  const conversationId = conversation?._id;

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => {
      fetchMessages(conversationId);
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !conversation) return;
    try {
      setSending(true);
      await supportService.sendMessage(conversation._id, inputValue.trim());
      setInputValue('');
      await fetchMessages(conversation._id);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (err) {
      setError(err.message || t('support.chatError'));
    } finally {
      setSending(false);
    }
  };

  const onRefresh = async () => {
    if (!conversation) return;
    try {
      setRefreshing(true);
      await fetchMessages(conversation._id);
    } finally {
      setRefreshing(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.senderType === 'user';
    const senderLabel = isUser ? t('support.userLabel') : t('support.adminLabel');
    return (
      <View
        style={[
          styles.messageContainer,
          {
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderColor: isUser ? colors.primary : colors.border
          }
        ]}
      >
        <Text
          style={[
            styles.senderLabel,
            { color: isUser ? colors.white : colors.primary }
          ]}
        >
          {senderLabel}
        </Text>
        <Text
          style={[
            styles.messageText,
            { color: isUser ? colors.white : colors.text }
          ]}
        >
          {item.message}
        </Text>
        <Text
          style={[
            styles.messageTime,
            { color: isUser ? colors.whiteTransparent || '#ffffffaa' : colors.textSecondary }
          ]}
        >
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('support.helpSupport')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatWrapper}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={KEYBOARD_OFFSET}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.chatContent}>
            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item._id}
              renderItem={renderMessage}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              style={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              }
              ListFooterComponent={<View style={{ height: 12 }} />}
            />
            <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                placeholder={t('support.messagePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={inputValue}
                onChangeText={setInputValue}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: sending ? colors.gray : colors.primary }
                ]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Ionicons name="send" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  chatWrapper: {
    flex: 1
  },
  chatContent: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600'
  },
  headerRight: {
    width: 24
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContent: {
    padding: 16,
    gap: 12
  },
  list: {
    flex: 1
  },
  messageContainer: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '75%',
    borderWidth: 1
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  messageText: {
    fontSize: 15
  },
  messageTime: {
    fontSize: 11,
    marginTop: 6
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 150
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  error: {
    textAlign: 'center',
    marginVertical: 8
  }
});

export default SupportChatScreen;

