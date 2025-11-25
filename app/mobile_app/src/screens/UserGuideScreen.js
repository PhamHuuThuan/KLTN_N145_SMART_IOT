import React, { useMemo } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const sectionOrder = [
  'quickStart',
  'homeDevices',
  'sensorsCharts',
  'outletsVoice',
  'rules',
  'notificationsEmergency',
  'support'
];

const sectionIcons = {
  quickStart: 'flash-outline',
  homeDevices: 'layers-outline',
  sensorsCharts: 'analytics-outline',
  outletsVoice: 'mic-outline',
  rules: 'construct-outline',
  notificationsEmergency: 'alert-circle-outline',
  support: 'chatbubbles-outline'
};

const UserGuideScreen = ({ navigation = {} }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sections = t('userGuide.sections', { returnObjects: true }) || {};

  const formattedDate = useMemo(() => {
    try {
      return new Date().toLocaleDateString();
    } catch {
      return '--/--/----';
    }
  }, []);

  const handleBack = () => {
    if (navigation.goBack) {
      navigation.goBack();
    }
  };

  const handleOpenSupport = () => {
    if (navigation.navigate) {
      navigation.navigate('SupportChat');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {t('userGuide.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{t('userGuide.title')}</Text>
          <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>
            {t('userGuide.updatedAt', { date: formattedDate })}
          </Text>
          <Text style={[styles.summaryBody, { color: colors.textSecondary }]}>{t('userGuide.intro')}</Text>
        </View>

        {sectionOrder.map((sectionKey) => {
          const section = sections[sectionKey];
          if (!section) return null;
          return (
            <View
              key={sectionKey}
              style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.sectionHeader}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '22' }]}>
                  <Ionicons
                    name={sectionIcons[sectionKey] || 'information-circle-outline'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              </View>
              {Array.isArray(section.items) &&
                section.items.map((item, index) => (
                  <View key={`${sectionKey}-${index}`} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>{item}</Text>
                  </View>
                ))}
            </View>
          );
        })}

        <View style={[styles.ctaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.ctaTitle, { color: colors.text }]}>{t('userGuide.ctaTitle')}</Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={handleOpenSupport}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubbles" size={18} color={colors.white} />
            <Text style={[styles.ctaButtonText, { color: colors.white }]}>{t('userGuide.ctaButton')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    gap: 16
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4
  },
  summaryMeta: {
    fontSize: 13,
    marginBottom: 12
  },
  summaryBody: {
    fontSize: 15,
    lineHeight: 22
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600'
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  ctaCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '600'
  }
});

export default UserGuideScreen;

