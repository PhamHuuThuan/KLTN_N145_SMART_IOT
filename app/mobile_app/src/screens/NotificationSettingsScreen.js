import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert, ScrollView, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { createLogger } from '../utils/logger';

const log = createLogger('NotifSettings');
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';
import TimePicker from '../components/TimePicker';

const NotificationSettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, registerFCMToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState('email');
  const [newContact, setNewContact] = useState({ name: '', address: '', phoneNumber: '' });
  const [prefs, setPrefs] = useState({
    email: { 
      enabled: true, 
      addresses: user?.email ? [{ name: 'Tôi', address: user.email, isDefault: true }] : []
    },
    sms: { 
      enabled: false, 
      phoneNumbers: user?.phone ? [{ name: 'Tôi', phoneNumber: user.phone, isDefault: true }] : []
    },
    fcm: { enabled: true },
    inApp: { enabled: true },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'Asia/Ho_Chi_Minh',
      exceptions: [
        { type: 'urgent', enabled: true },
        { type: 'security', enabled: true },
        { type: 'system', enabled: true }
      ]
    }
  });

  const handleFCMToggle = async (enabled) => {
    
    setPrefs({ ...prefs, fcm: { enabled } });
    
  };

  const load = async () => {
    if (!user?.id) return;
    try {
      const res = await notificationService.getPreferences(user.userId);
      if (res.success && res.data?.data) {
        const data = res.data.data;
        const emailAddresses = data.email?.addresses || [];
        const smsNumbers = data.sms?.phoneNumbers || [];
        
        const newPrefs = {
          email: {
            enabled: !!data.email?.enabled,
            addresses: emailAddresses
          },
          sms: {
            enabled: !!data.sms?.enabled,
            phoneNumbers: smsNumbers
          },
          fcm: { enabled: !!data.fcm?.enabled },
          inApp: { enabled: !!data.inApp?.enabled },
          quietHours: data.quietHours || {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'Asia/Ho_Chi_Minh',
            exceptions: [
              { type: 'urgent', enabled: true },
              { type: 'security', enabled: true },
              { type: 'system', enabled: true }
            ]
          }
        };
        
        setPrefs(newPrefs);
      }
    } catch (e) {
      setFeedback({ visible: true, type: 'error', message: t('settings.loadPreferencesError') });
    } finally {
      setLoading(false);
      setShowLoader(false);
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneRegex = /^(\+?[1-9]\d{1,14}|0\d{9,10})$/;

  const emailExists = (email) => prefs.email.addresses.some(e => e.address.trim().toLowerCase() === email.trim().toLowerCase());
  const phoneExists = (phone) => prefs.sms.phoneNumbers.some(p => p.phoneNumber.trim() === phone.trim());

  const validateForm = () => {
    if (prefs.email.enabled) {
      if (prefs.email.addresses.length === 0) {
        setFeedback({ visible: true, type: 'error', message: t('settings.emailRequired') });
        return false;
      }
      const seenEmails = new Set();
      for (const addr of prefs.email.addresses) {
        if (!addr?.address || !emailRegex.test(addr.address)) {
          setFeedback({ visible: true, type: 'error', message: t('settings.invalidEmail') });
          return false;
        }
        const key = addr.address.trim().toLowerCase();
        if (seenEmails.has(key)) {
          setFeedback({ visible: true, type: 'error', message: t('settings.duplicateEmail') });
          return false;
        }
        seenEmails.add(key);
      }
    }
    if (prefs.sms.enabled) {
      if (prefs.sms.phoneNumbers.length === 0) {
        setFeedback({ visible: true, type: 'error', message: t('settings.phoneRequired') });
        return false;
      }
      const seenPhones = new Set();
      for (const pn of prefs.sms.phoneNumbers) {
        if (!pn?.phoneNumber || !phoneRegex.test(pn.phoneNumber)) {
          setFeedback({ visible: true, type: 'error', message: t('settings.invalidPhone') });
          return false;
        }
        const key = pn.phoneNumber.trim();
        if (seenPhones.has(key)) {
          setFeedback({ visible: true, type: 'error', message: t('settings.duplicatePhone') });
          return false;
        }
        seenPhones.add(key);
      }
    }
    return true;
  };

  const save = async () => {
    if (!user?.id) return;
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    setShowLoader(true);
    try {
      const payload = {
        email: { 
          enabled: prefs.email.enabled, 
          addresses: prefs.email.addresses
        },
        sms: { 
          enabled: prefs.sms.enabled, 
          phoneNumbers: prefs.sms.phoneNumbers
        },
        fcm: { enabled: prefs.fcm.enabled },
        inApp: { enabled: prefs.inApp.enabled },
        quietHours: prefs.quietHours
      };
      
      const res = await notificationService.updatePreferences(user.userId, payload);
      if (res.success) {
        setFeedback({ visible: true, type: 'success', message: t('settings.preferencesSaved') });
      } else {
        setFeedback({ visible: true, type: 'error', message: res.message || t('settings.savePreferencesError') });
      }
    } catch (e) {
      let errorMessage = t('settings.savePreferencesError');
      
      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.response?.data?.errors) {
        const firstError = e.response.data.errors[0];
        errorMessage = `${firstError.field}: ${firstError.message}`;
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      setFeedback({ visible: true, type: 'error', message: errorMessage });
    } finally {
      setSaving(false);
      setShowLoader(false);
    }
  };

  // ---- Permissions launcher (OEM/Android settings) ----
  const openSystemPermissionScreens = async () => {
    const appId = Application.applicationId || 'com.technooo.smartkitchen';

    const safeStart = async (action, params) => {
      try {
        await IntentLauncher.startActivityAsync(action, params);
        return true;
      } catch {
        return false;
      }
    };

    if (Platform.OS !== 'android') {
      try { await Linking.openSettings(); } catch {}
      return;
    }

    // 1) App notification settings (lock screen / heads-up)
    const openedNotif =
      await safeStart(IntentLauncher.ACTION_APP_NOTIFICATION_SETTINGS, {
        extra: { 'android.provider.extra.APP_PACKAGE': appId, app_package: appId },
      }) ||
      await safeStart('android.settings.APP_NOTIFICATION_SETTINGS', {
        extra: { 'android.provider.extra.APP_PACKAGE': appId, app_package: appId },
      }) ||
      await safeStart(IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS, {
        data: `package:${appId}`,
      });

    // 2) Overlay / pop-up permission
    await safeStart(IntentLauncher.ACTION_MANAGE_OVERLAY_PERMISSION, { data: `package:${appId}` });

    // 3) Ignore battery optimizations
    await safeStart('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', { data: `package:${appId}` }) ||
    await safeStart(IntentLauncher.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);

    // 4) App details as fallback
    await safeStart(IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS, { data: `package:${appId}` });

    if (!openedNotif) {
      try { await Linking.openSettings(); } catch {}
    }
  };

  // Add email address
  const addEmailAddress = () => {
    if (prefs.email.addresses.length >= 3) {
      setFeedback({ visible: true, type: 'error', message: 'Tối đa 3 email (bao gồm email mặc định)' });
      return;
    }
    
    setAddModalType('email');
    setNewContact({ name: '', address: '', phoneNumber: '' });
    setShowAddModal(true);
  };

  // Add SMS number
  const addSMSNumber = () => {
    if (prefs.sms.phoneNumbers.length >= 3) {
      setFeedback({ visible: true, type: 'error', message: 'Tối đa 3 số điện thoại (bao gồm số mặc định)' });
      return;
    }
    
    setAddModalType('sms');
    setNewContact({ name: '', address: '', phoneNumber: '' });
    setShowAddModal(true);
  };

  // Save new contact from modal
  const saveNewContact = () => {
    if (!newContact.name.trim() || (!newContact.address.trim() && !newContact.phoneNumber.trim())) {
      setFeedback({ visible: true, type: 'error', message: t('common.error') });
      return;
    }

    if (addModalType === 'email') {
      if (!newContact.address.trim() || !emailRegex.test(newContact.address.trim())) {
        setFeedback({ visible: true, type: 'error', message: t('settings.invalidEmail') });
        return;
      }
      if (emailExists(newContact.address)) {
        setFeedback({ visible: true, type: 'error', message: t('settings.duplicateEmail') });
        return;
      }
      
      const newEmail = { 
        name: newContact.name.trim(), 
        address: newContact.address.trim(), 
        isDefault: false 
      };
      
      setPrefs({
        ...prefs,
        email: {
          ...prefs.email,
          addresses: [...prefs.email.addresses, newEmail]
        }
      });
    } else {
      if (!newContact.phoneNumber.trim() || !phoneRegex.test(newContact.phoneNumber.trim())) {
        setFeedback({ visible: true, type: 'error', message: t('settings.invalidPhone') });
        return;
      }
      if (phoneExists(newContact.phoneNumber)) {
        setFeedback({ visible: true, type: 'error', message: t('settings.duplicatePhone') });
        return;
      }
      
      const newSMS = { 
        name: newContact.name.trim(), 
        phoneNumber: newContact.phoneNumber.trim(), 
        isDefault: false 
      };
      
      setPrefs({
        ...prefs,
        sms: {
          ...prefs.sms,
          phoneNumbers: [...prefs.sms.phoneNumbers, newSMS]
        }
      });
    }

    setShowAddModal(false);
    setNewContact({ name: '', address: '', phoneNumber: '' });
  };

  // Remove email address
  const removeEmailAddress = (index) => {
    const email = prefs.email.addresses[index];
    if (email.isDefault) return;
    
    setPrefs({
      ...prefs,
      email: {
        ...prefs.email,
        addresses: prefs.email.addresses.filter((_, i) => i !== index)
      }
    });
  };

  // Update email address
  const updateEmailAddress = (index, field, value) => {
    const newAddresses = [...prefs.email.addresses];
    newAddresses[index] = { ...newAddresses[index], [field]: value };
    setPrefs({
      ...prefs,
      email: { ...prefs.email, addresses: newAddresses }
    });
  };

  // Remove SMS number
  const removeSMSNumber = (index) => {
    const sms = prefs.sms.phoneNumbers[index];
    if (sms.isDefault) return;
    
    setPrefs({
      ...prefs,
      sms: {
        ...prefs.sms,
        phoneNumbers: prefs.sms.phoneNumbers.filter((_, i) => i !== index)
      }
    });
  };

  // Update SMS number
  const updateSMSNumber = (index, field, value) => {
    const newNumbers = [...prefs.sms.phoneNumbers];
    newNumbers[index] = { ...newNumbers[index], [field]: value };
    setPrefs({
      ...prefs,
      sms: { ...prefs.sms, phoneNumbers: newNumbers }
    });
  };

  // Load preferences when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      load();
    }
  }, [user?.id]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.notificationSettings')}</Text>
        <TouchableOpacity style={[styles.saveIconButton, { backgroundColor: colors.primary }]} onPress={save} disabled={saving || loading}>
          <Ionicons name="save-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.allowPermissions')}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('settings.permissionsDescription')}
          </Text>
          <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={openSystemPermissionScreens}>
            <Ionicons name="shield-checkmark" size={18} color={colors.white} />
            <Text style={[styles.permissionButtonText, { color: colors.white }]}>{t('settings.openSystemPermissions')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.pushNotifications')}</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.inAppNotifications')}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{t('settings.inAppDescription')}</Text>
            </View>
            <Switch value={true} onValueChange={() => {}} disabled />
          </View>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.pushNotifications')}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{t('settings.pushDescription')}</Text>
            </View>
            <Switch value={prefs.fcm.enabled} onValueChange={handleFCMToggle} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.emailNotifications')}</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.emailAlerts')}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{t('settings.emailDescription')}</Text>
            </View>
            <Switch value={prefs.email.enabled} onValueChange={(v) => setPrefs({ ...prefs, email: { ...prefs.email, enabled: v } })} />
          </View>
          {prefs.email.enabled && (
            <View style={styles.addressesContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.recipientsEmailLabel')}</Text>
              
              {prefs.email.addresses.filter(email => email.isDefault).map((email, index) => (
                <View key={`default-${index}`} style={styles.defaultSection}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.defaultLabel')}</Text>
                  <View style={styles.emailItem}>
                    <View style={styles.emailInputContainer}>
                      <TextInput
                        style={[
                          styles.input, 
                          styles.emailInput, 
                          { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.textSecondary }
                        ]}
                        value={`${email.name} (${email.address})`}
                        editable={false}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {prefs.email.addresses.filter(email => !email.isDefault).length > 0 && (
                <View style={styles.additionalSection}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.familyMembersLabel')}</Text>
                  {prefs.email.addresses.filter(email => !email.isDefault).map((email, index) => {
                    const realIndex = prefs.email.addresses.findIndex(e => e === email);
                    return (
                      <View key={`additional-${index}`} style={styles.emailItem}>
                        <View style={styles.emailInputContainer}>
                          <TextInput
                            style={[
                              styles.input, 
                              styles.emailInput, 
                              { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }
                            ]}
                            placeholder={t('settings.enterName')}
                            placeholderTextColor={colors.textSecondary}
                            value={email.name}
                            onChangeText={(text) => updateEmailAddress(realIndex, 'name', text)}
                          />
                          <TextInput
                            style={[
                              styles.input, 
                              styles.emailInput, 
                              { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }
                            ]}
                            placeholder={t('settings.enterEmail')}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email.address}
                            onChangeText={(text) => updateEmailAddress(realIndex, 'address', text)}
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.removeButton, { backgroundColor: colors.danger }]}
                          onPress={() => removeEmailAddress(realIndex)}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {prefs.email.addresses.length < 3 && (
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.primary }]}
                  onPress={addEmailAddress}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={[styles.addButtonText, { color: colors.white }]}>{t('settings.addEmail')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.smsNotifications')}</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.smsAlerts')}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{t('settings.smsDescription')}</Text>
            </View>
            <Switch value={prefs.sms.enabled} onValueChange={(v) => setPrefs({ ...prefs, sms: { ...prefs.sms, enabled: v } })} />
          </View>
          {prefs.sms.enabled && (
            <View style={styles.addressesContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.recipientsSMSLabel')}</Text>
              
              {prefs.sms.phoneNumbers.filter(sms => sms.isDefault).map((sms, index) => (
                <View key={`default-${index}`} style={styles.defaultSection}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.defaultLabel')}</Text>
                  <View style={styles.emailItem}>
                    <View style={styles.emailInputContainer}>
                      <TextInput
                        style={[
                          styles.input, 
                          styles.emailInput, 
                          { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.textSecondary }
                        ]}
                        value={`${sms.name} (${sms.phoneNumber})`}
                        editable={false}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {prefs.sms.phoneNumbers.filter(sms => !sms.isDefault).length > 0 && (
                <View style={styles.additionalSection}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.familyMembersLabel')}</Text>
                  {prefs.sms.phoneNumbers.filter(sms => !sms.isDefault).map((sms, index) => {
                    const realIndex = prefs.sms.phoneNumbers.findIndex(s => s === sms);
                    return (
                      <View key={`additional-${index}`} style={styles.emailItem}>
                        <View style={styles.emailInputContainer}>
                          <TextInput
                            style={[
                              styles.input, 
                              styles.emailInput, 
                              { borderColor: colors.border, backgroundColor: colors.background, color: colors.text}
                            ]}
                            placeholder={t('settings.enterName')}
                            placeholderTextColor={colors.textSecondary}
                            value={sms.name}
                            onChangeText={(text) => updateSMSNumber(realIndex, 'name', text)}
                          />
                          <TextInput
                            style={[
                              styles.input, 
                              styles.emailInput, 
                              { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }
                            ]}
                            placeholder={t('settings.enterPhone')}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                            value={sms.phoneNumber}
                            onChangeText={(text) => updateSMSNumber(realIndex, 'phoneNumber', text)}
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.removeButton, { backgroundColor: colors.danger }]}
                          onPress={() => removeSMSNumber(realIndex)}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {prefs.sms.phoneNumbers.length < 3 && (
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.primary }]}
                  onPress={addSMSNumber}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={[styles.addButtonText, { color: colors.white }]}>{t('settings.addPhone')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>


        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.quietHours')}</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.enableQuietHours')}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{t('settings.quietHoursDescription')}</Text>
            </View>
            <Switch 
              value={prefs.quietHours.enabled} 
              onValueChange={(enabled) => setPrefs({
                ...prefs,
                quietHours: { ...prefs.quietHours, enabled }
              })} 
            />
          </View>
          {prefs.quietHours.enabled && (
            <View style={styles.quietHoursContainer}>
              <View style={styles.timeRow}>
                <View style={styles.timeInputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.startTime')}</Text>
                  <TimePicker
                    value={prefs.quietHours.startTime}
                    onTimeChange={(startTime) => setPrefs({
                      ...prefs,
                      quietHours: { ...prefs.quietHours, startTime }
                    })}
                    placeholder={t('settings.selectStartTime')}
                  />
                </View>
                <View style={styles.timeInputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.endTime')}</Text>
                  <TimePicker
                    value={prefs.quietHours.endTime}
                    onTimeChange={(endTime) => setPrefs({
                      ...prefs,
                      quietHours: { ...prefs.quietHours, endTime }
                    })}
                    placeholder={t('settings.selectEndTime')}
                  />
                </View>
              </View>
              <View style={styles.exceptionsContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.exceptions')}</Text>
                {prefs.quietHours.exceptions.map((exception, index) => {
                  const exceptionLabels = {
                    urgent: t('notifications.priorities.urgent'),
                    security: t('settings.security'),
                    system: t('settings.system')
                  };
                  
                  return (
                    <View key={exception.type} style={styles.exceptionRow}>
                      <View style={styles.exceptionLabelContainer}>
                        <Ionicons 
                          name={
                            exception.type === 'urgent' ? 'warning' : 
                            exception.type === 'security' ? 'shield-checkmark' : 'settings'
                          } 
                          size={16} 
                          color={colors.primary} 
                          style={styles.exceptionIcon}
                        />
                        <Text style={[styles.exceptionLabel, { color: colors.text }]}>
                          {exceptionLabels[exception.type] || exception.type}
                        </Text>
                      </View>
                      <Switch 
                        value={exception.enabled} 
                        onValueChange={(enabled) => {
                          const newExceptions = [...prefs.quietHours.exceptions];
                          newExceptions[index] = { ...exception, enabled };
                          setPrefs({
                            ...prefs,
                            quietHours: { ...prefs.quietHours, exceptions: newExceptions }
                          });
                        }}
                        trackColor={{ false: "#E5E5EA", true: "#007AFF" }}
                        thumbColor={exception.enabled ? "#FFFFFF" : "#FFFFFF"}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.notificationTypes')}</Text>
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('settings.notificationTypesDescription')}
            </Text>
          </View>
        </View>

      </ScrollView>
      <OverlayLoader
        visible={showLoader}
        message={saving ? t('settings.saving') : t('common.loading')}
        onCancel={() => setShowLoader(false)}
      />
      <ActionFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        duration={feedback.type === 'success' ? 2000 : 4000}
        onHide={() => {
          setFeedback({ ...feedback, visible: false });
          // Navigate back to notification list after successful save
          if (feedback.type === 'success') {
            navigation.navigate('Notifications');
          }
        }}
      />

      {/* Add Contact Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {addModalType === 'email' ? t('settings.addEmailTitle') : t('settings.addPhoneTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowAddModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalInputLabel, { color: colors.text }]}>{t('settings.nameLabel')}</Text>
                <TextInput
                  style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                  placeholder={t('settings.enterName')}
                  placeholderTextColor={colors.textSecondary}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                />
              </View>
              
              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalInputLabel, { color: colors.text }]}>
                  {addModalType === 'email' ? t('settings.emailLabel') : t('settings.phoneLabel')}
                </Text>
                <TextInput
                  style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                  placeholder={addModalType === 'email' ? t('settings.enterEmail') : t('settings.enterPhone')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={addModalType === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                  value={addModalType === 'email' ? newContact.address : newContact.phoneNumber}
                  onChangeText={(text) => setNewContact({ 
                    ...newContact, 
                    [addModalType === 'email' ? 'address' : 'phoneNumber']: text 
                  })}
                />
              </View>
            </View>
            
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton, { backgroundColor: colors.primary }]}
                onPress={saveNewContact}
              >
                <Text style={[styles.modalSaveText, { color: colors.white }]}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  saveIconButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18 },
  content: { flex: 1, paddingHorizontal: 16 },
  section: { padding: 16, marginTop: 12, borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  labelContainer: { flex: 1, marginRight: 16 },
  label: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  description: { fontSize: 14, lineHeight: 20 },
  inputContainer: { marginTop: 12 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { 
    borderWidth: 1, 
    borderRadius: 10, 
    padding: 14,
    fontSize: 16,
    minHeight: 48
  },
  inputError: {
    borderColor: '#FF3B30'
  },
  errorText: {
    fontSize: 12,
    // color handled by theme
    marginTop: 4
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1
  },
  quietHoursContainer: {
    marginTop: 12
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  timeInputContainer: {
    flex: 1,
    marginHorizontal: 4
  },
  exceptionsContainer: {
    marginTop: 12
  },
  exceptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4
  },
  exceptionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  exceptionIcon: {
    marginRight: 8
  },
  exceptionLabel: {
    fontSize: 14,
    fontWeight: '500'
  },
  permissionButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  addressesContainer: {
    marginTop: 16
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  defaultSection: {
    marginBottom: 8
  },
  additionalSection: {
    marginBottom: 8
  },
  emailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12
  },
  emailInputContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8
  },
  emailInput: {
    flex: 1
  },
  removeButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    marginTop: 16
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  modalCloseButton: {
    padding: 4
  },
  modalBody: {
    padding: 20
  },
  modalInputContainer: {
    marginBottom: 16
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelButton: {
    borderWidth: 1
  },
  modalSaveButton: {
    // backgroundColor handled by theme
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500'
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600'
  }
});

export default NotificationSettingsScreen;


