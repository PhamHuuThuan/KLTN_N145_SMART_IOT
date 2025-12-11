import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import CONFIG from '../constants/config';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';

const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, updateProfile, logout, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  const handlePickAvatar = async () => {
    if (!isEditing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setFeedback({
        visible: true,
        type: 'error',
        message: t('profile.allowPhotoAccess')
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setFormData({ ...formData, avatar: uri });
    }
  };

  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  const isValidPhoneNumber = (phone) => {
    if (!phone || !phone.trim()) {
      return true; // Phone is optional
    }
    const trimmedPhone = phone.trim();
    // Phone regex: 
    // - Vietnamese format: 0xxxxxxxxx (10-11 digits, starting with 0)
    // - International format: +84xxxxxxxxx (starting with +84 and 9-10 digits after)
    const vietnamesePhoneRegex = /^0\d{9,10}$/; // 0 followed by 9-10 digits
    const internationalPhoneRegex = /^\+84\d{9,10}$/; // +84 followed by 9-10 digits
    
    return vietnamesePhoneRegex.test(trimmedPhone) || internationalPhoneRegex.test(trimmedPhone);
  };

  const handleSaveProfile = async () => {
    // Validation
    if (!formData.name.trim()) {
      setFeedback({ visible: true, type: 'error', message: t('profile.fullNameRequired') });
      return;
    }

    if (formData.phone && formData.phone.trim() && !isValidPhoneNumber(formData.phone)) {
      setFeedback({ visible: true, type: 'error', message: t('profile.invalidPhoneNumber') });
      return;
    }

    try {
      setShowLoader(true);
      const result = await updateProfile(
        formData.name,
        formData.phone,
        formData.avatar || null
      );
      
      if (result.success) {
        setFeedback({ visible: true, type: 'success', message: t('profile.profileUpdated') });
        const updatedUser = result.user || {};
        setFormData({
          name: updatedUser.name || formData.name,
          email: updatedUser.email || formData.email,
          phone: updatedUser.phone || updatedUser.phoneNumber || updatedUser?.profile?.phone || formData.phone,
          avatar: updatedUser.avatar || formData.avatar,
        });
        setIsEditing(false);
      } else {
        setFeedback({ visible: true, type: 'error', message: result.error || t('profile.profileUpdateError') });
      }
    } catch (error) {
      setFeedback({ visible: true, type: 'error', message: t('profile.profileUpdateError') });
    }
    finally {
      setShowLoader(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logoutConfirm'),
      t('profile.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.logout'), 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  const renderProfileInfo = () => (
    <View style={[styles.section, styles.card, { backgroundColor: colors.surface }]}> 
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.personalInfo')}</Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>{t('profile.fullName')}</Text>
        <View style={[styles.inputRow, !isEditing && styles.inputRowDisabled, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Ionicons name="person-outline" size={20} color={colors.gray} style={styles.inputIcon} />
          <TextInput
            style={[styles.inputInner, { color: colors.text }]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            editable={isEditing}
            placeholder={t('profile.enterFullName')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>{t('common.email')}</Text>
        <View style={[styles.inputRow, styles.inputRowDisabled, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}> 
          <Ionicons name="mail-outline" size={20} color={colors.gray} style={styles.inputIcon} />
          <TextInput
            style={[styles.inputInner, { color: colors.textSecondary }]}
            value={formData.email}
            editable={false}
            placeholder={t('profile.emailAddress')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>{t('profile.phoneNumber')}</Text>
        <View style={[styles.inputRow, !isEditing && styles.inputRowDisabled, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Ionicons name="call-outline" size={20} color={colors.gray} style={styles.inputIcon} />
          <TextInput
            style={[styles.inputInner, { color: colors.text }]}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            editable={isEditing}
            placeholder={t('profile.enterPhoneNumber')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.buttonRow}>
        {isEditing ? (
          <>
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: colors.success }]}
              onPress={handleSaveProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.ctaText}>{t('profile.saveChanges')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => {
                setIsEditing(false);
                setFormData({
                  name: user?.name || '',
                  email: user?.email || '',
                  phone: user?.phone || user?.phoneNumber || user?.profile?.phone || '',
                  avatar: user?.avatar || '',
                });
              }}
            >
              <Text style={[styles.ctaText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.ctaText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderAccountActions = () => (
    <View style={[styles.section, styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.account')}</Text>
      
      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: colors.danger }]}
        onPress={handleLogout}
      >
        <Text style={styles.ctaText}>{t('common.logout')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.headerProfileRow}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('profile.changeAvatar')}
            >
              {formData.avatar ? (
                <Image source={{ uri: formData.avatar }} style={styles.bigAvatarImage} />
              ) : (
                <View style={styles.bigAvatar}>
                  <Text style={styles.bigAvatarText}>
                    {formData.name ? formData.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {isEditing && (
              <TouchableOpacity
                style={[styles.cameraBadge, { backgroundColor: colors.primary }]}
                onPress={handlePickAvatar}
                accessibilityRole="button"
                accessibilityLabel={t('profile.selectAvatar')}
              >
                <Ionicons name="camera" size={16} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerUserInfo}>
            <Text style={styles.userName}>{formData.name || t('profile.user')}</Text>
            <Text style={styles.userEmail}>{formData.email}</Text>
            {isEditing && (
              <Text style={styles.editHint}>{t('profile.tapAvatarToChange')}</Text>
            )}
          </View>
        </View>
      </LinearGradient>
      
      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {renderProfileInfo()}
        {renderAccountActions()}
      </ScrollView>
      <OverlayLoader visible={showLoader} message={isEditing ? t('common.saving') : t('common.loading')} onCancel={() => setShowLoader(false)} />
      <ActionFeedback visible={feedback.visible} type={feedback.type} message={feedback.message} onHide={() => setFeedback({ ...feedback, visible: false })} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: CONFIG.COLORS.white,
    textAlign: 'left',
  },
  headerRight: {
    width: 40,
  },
  headerProfileRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  avatarWrapper: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)'
  },
  bigAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)'
  },
  bigAvatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: CONFIG.COLORS.white,
  },
  headerUserInfo: {
    flex: 0,
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: CONFIG.THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)'
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: CONFIG.COLORS.white,
    textAlign: 'center',
  },
  userEmail: {
    marginTop: 2,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  editHint: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)'
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 16,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
  },
  inputRowDisabled: {
  },
  inputIcon: {
    paddingLeft: 12,
    paddingRight: 6,
  },
  inputInner: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    backgroundColor: CONFIG.THEME.surface,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  ctaButton: {
    flex: 1,
    padding: 12,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  ctaText: {
    color: CONFIG.COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
