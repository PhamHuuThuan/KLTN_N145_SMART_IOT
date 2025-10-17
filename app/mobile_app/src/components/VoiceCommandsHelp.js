import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const VoiceCommandsHelp = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!visible) return null;

  const commands = [
    {
      category: t('voice.outletControl') || 'Điều khiển ổ cắm',
      items: [
        { command: 'Bật ổ cắm 1', description: t('voice.turnOnOutlet1') || 'Bật ổ cắm số 1' },
        { command: 'Tắt ổ cắm 2', description: t('voice.turnOffOutlet2') || 'Tắt ổ cắm số 2' },
        { command: 'Bật tất cả ổ cắm', description: t('voice.turnOnAllOutlets') || 'Bật tất cả ổ cắm' },
        { command: 'Tắt tất cả ổ cắm', description: t('voice.turnOffAllOutlets') || 'Tắt tất cả ổ cắm' },
      ]
    },
    {
      category: t('voice.namedOutlets') || 'Điều khiển theo tên thiết bị',
      items: [
        { command: 'Bật quạt', description: 'Bật thiết bị quạt' },
        { command: 'Tắt đèn', description: 'Tắt thiết bị đèn' },
        { command: 'Bật tivi', description: 'Bật thiết bị tivi' },
        { command: 'Tắt điều hòa', description: 'Tắt thiết bị điều hòa' },
        { command: 'Bật quạt 1', description: 'Bật quạt số 1' },
        { command: 'Tắt đèn 2', description: 'Tắt đèn số 2' },
      ]
    },
    {
      category: t('voice.alternativeCommands') || 'Lệnh thay thế',
      items: [
        { command: 'Mở/Khởi động', description: t('voice.alternativeForOn') || 'Từ thay thế cho "bật"' },
        { command: 'Đóng/Dừng', description: t('voice.alternativeForOff') || 'Từ thay thế cho "tắt"' },
        { command: 'English: Turn on/off', description: t('voice.englishCommands') || 'Lệnh tiếng Anh cũng hoạt động' },
      ]
    }
  ];

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('voice.commandsHelp')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
            <Ionicons name="close" size={24} color={colors.gray} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {commands.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                {section.category}
              </Text>
              {section.items.map((item, itemIndex) => (
                <View key={itemIndex} style={[styles.commandItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.commandText}>
                    <Text style={[styles.command, { color: colors.text }]}>{item.command}</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                      {item.description}
                    </Text>
                  </View>
                  <Ionicons name="mic-outline" size={20} color={colors.gray} />
                </View>
              ))}
            </View>
          ))}
          
          <View style={[styles.tipContainer, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="bulb-outline" size={20} color={colors.primary} />
            <Text style={[styles.tipText, { color: colors.text }]}>
              {t('voice.tip') || 'Nói rõ ràng và tạm dừng ngắn giữa các từ để nhận diện tốt hơn'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    minHeight: '60%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeIcon: {
    padding: 4,
  },
  content: {
    flex: 1,
    minHeight: 300,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commandText: {
    flex: 1,
    marginRight: 12,
  },
  command: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic',
  },
});

export default VoiceCommandsHelp;
