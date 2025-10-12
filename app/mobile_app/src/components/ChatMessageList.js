import React, { useRef, useEffect } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import ChatMessageBubble from './ChatMessageBubble';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';

const formatDateDDMMYYYY = (d) => {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const DateSeparator = ({ date }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.separatorContainer}>
      <Text style={[styles.separatorText, { color: colors.textSecondary }]}>
        {formatDateDDMMYYYY(date)}
      </Text>
    </View>
  );
};

const ChatMessageList = ({ messages, userId, onOutletPress }) => {
  const { colors } = useTheme();
  const listRef = useRef(null);

  // Sort messages by time (newest first for inverted list)
  const sortedMessages = [...messages].sort((a, b) => b.time - a.time);

  useEffect(() => {
    if (listRef.current && sortedMessages?.length) {
      // Scroll to top when new messages are added (since list is inverted)
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [sortedMessages]);

  const renderItem = ({ item, index }) => {
    const prev = sortedMessages[index - 1];
    const next = sortedMessages[index + 1];
    const samePrev = prev && prev.userId === item.userId;
    const sameNext = next && next.userId === item.userId;
    const showDate = !prev || new Date(prev.time).toDateString() !== new Date(item.time).toDateString();
    const isFirstInGroup = !samePrev;
    const isLastInGroup = !sameNext;
    return (
      <View>
        {showDate && <DateSeparator date={item.time} />}        
        <ChatMessageBubble
          message={item}
          isOwn={item.userId === userId}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          onOutletPress={onOutletPress}
        />
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={sortedMessages}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      style={[styles.list, { backgroundColor: colors.background }]}
      inverted
    />
  );
};

const styles = StyleSheet.create({
  list: {
    // backgroundColor handled by theme
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  separatorContainer: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 0,
    marginVertical: 8,
  },
  separatorText: {
    fontSize: 12,
  },
});

export default ChatMessageList;


