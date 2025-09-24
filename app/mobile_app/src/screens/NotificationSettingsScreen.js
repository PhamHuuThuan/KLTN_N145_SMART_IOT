import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert, ScrollView, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';
import TimePicker from '../components/TimePicker';

const NotificationSettingsScreen = ({ navigation }) => {
  const { user, registerFCMToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const [prefs, setPrefs] = useState({
    email: { enabled: true, address: user?.email || '' },
    sms: { enabled: false, phoneNumber: user?.phone || '' },
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
    console.log('🔧 handleFCMToggle called with enabled:', enabled);
    console.log('🔧 Current prefs.fcm:', prefs.fcm);
    console.log('🔧 User ID:', user?.id);
    
    setPrefs({ ...prefs, fcm: { enabled } });
    
    // If enabling FCM, register the token
    if (enabled && user?.id) {
      try {
        console.log('🔄 Registering FCM token for user:', user.id);
        await registerFCMToken(user.id);
        console.log('✅ FCM token registered after enabling push notifications');
        
        // Don't call save() here because addFCMToken API already handles the token storage
        // and save() would overwrite the tokens array
        
        setFeedback({ visible: true, type: 'success', message: 'Push notifications enabled successfully!' });
      } catch (error) {
        console.error('❌ Failed to register FCM token:', error);
        console.error('❌ Error details:', error.response?.data);
        // Revert the toggle on error
        setPrefs({ ...prefs, fcm: { enabled: false } });
        // Show error feedback
        let errorMessage = 'Failed to register push token. Please try again.';
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        setFeedback({ visible: true, type: 'error', message: errorMessage });
      }
    } else {
      console.log('🔧 FCM toggle to disabled or no user ID, skipping token registration');
      // When disabling FCM, save preferences to update fcm.enabled = false
      if (user?.id) {
        console.log('🔄 Saving preferences to database...');
        await save();
      }
    }
  };

  const load = async () => {
    if (!user?.id) return;
    // setLoading(true);
    // setShowLoader(true);
    try {
      const res = await notificationService.getPreferences(user.id);
      if (res.success && res.data?.data) {
        setPrefs({
          email: {
            enabled: !!res.data.data.email?.enabled,
            address: res.data.data.email?.address || user?.email || ''
          },
          sms: {
            enabled: !!res.data.data.sms?.enabled,
            phoneNumber: res.data.data.sms?.phoneNumber || user?.phone || ''
          },
          fcm: { enabled: !!res.data.data.fcm?.enabled },
          inApp: { enabled: !!res.data.data.inApp?.enabled },
          quietHours: res.data.data.quietHours || {
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
      }
    } catch (e) {
      setFeedback({ visible: true, type: 'error', message: 'Failed to load preferences' });
    } finally {
      setLoading(false);
      setShowLoader(false);
    }
  };

  const validateForm = () => {
    if (prefs.email.enabled && !prefs.email.address) {
      setFeedback({ visible: true, type: 'error', message: 'Email address is required when email notifications are enabled' });
      return false;
    }
    if (prefs.sms.enabled && !prefs.sms.phoneNumber) {
      setFeedback({ visible: true, type: 'error', message: 'Phone number is required when SMS notifications are enabled' });
      return false;
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
          address: prefs.email.enabled ? (prefs.email.address || user?.email) : '' 
        },
        sms: { 
          enabled: prefs.sms.enabled, 
          phoneNumber: prefs.sms.enabled ? (prefs.sms.phoneNumber || user?.phone) : '' 
        },
        fcm: { enabled: prefs.fcm.enabled },
        inApp: { enabled: prefs.inApp.enabled },
        quietHours: prefs.quietHours
      };
      const res = await notificationService.updatePreferences(user.id, payload);
      if (res.success) {
        setFeedback({ visible: true, type: 'success', message: 'Notification preferences saved successfully!' });
      } else {
        setFeedback({ visible: true, type: 'error', message: res.message || 'Failed to save preferences' });
      }
    } catch (e) {
      console.error('Save preferences error:', e);
      let errorMessage = 'Failed to save preferences. Please try again.';
      
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
        console.log('Opening settings intent:', action, params);
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
      // Final fallback: open general settings
      try { await Linking.openSettings(); } catch {}
    }
  };

  useEffect(() => { 
    load(); 
  }, [user?.id]);

  // Update email and phone when user data changes
  useEffect(() => {
    if (user?.email || user?.phone) {
      setPrefs(prev => ({
        ...prev,
        email: { ...prev.email, address: prev.email.address || user?.email || '' },
        sms: { ...prev.sms, phoneNumber: prev.sms.phoneNumber || user?.phone || '' }
      }));
    }
  }, [user?.email, user?.phone]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <TouchableOpacity style={styles.saveIconButton} onPress={save} disabled={saving || loading}>
          <Ionicons name="save-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allow Permissions</Text>
          <Text style={styles.description}>
            Enable lock-screen display, pop-up/overlay and battery optimization exceptions
            so emergency alerts can always break through.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={openSystemPermissionScreens}>
            <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
            <Text style={styles.permissionButtonText}>Open System Notification Permissions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>In-App Notifications</Text>
              <Text style={styles.description}>Receive notifications within the app</Text>
            </View>
            <Switch value={true} onValueChange={() => {}} disabled />
          </View>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Push Notifications</Text>
              <Text style={styles.description}>Receive notifications even when app is closed</Text>
            </View>
            <Switch value={prefs.fcm.enabled} onValueChange={handleFCMToggle} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Notifications</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Email Alerts</Text>
              <Text style={styles.description}>Receive notifications via email</Text>
            </View>
            <Switch value={prefs.email.enabled} onValueChange={(v) => setPrefs({ ...prefs, email: { ...prefs.email, enabled: v } })} />
          </View>
          {prefs.email.enabled && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={[styles.input, !prefs.email.address && styles.inputError]}
                placeholder="Enter your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                value={prefs.email.address}
                onChangeText={(t) => setPrefs({ ...prefs, email: { ...prefs.email, address: t } })}
              />
              {!prefs.email.address && <Text style={styles.errorText}>Email address is required when email notifications are enabled</Text>}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS Notifications</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>SMS Alerts</Text>
              <Text style={styles.description}>Receive critical alerts via SMS</Text>
            </View>
            <Switch value={prefs.sms.enabled} onValueChange={(v) => setPrefs({ ...prefs, sms: { ...prefs.sms, enabled: v } })} />
          </View>
          {prefs.sms.enabled && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={[styles.input, !prefs.sms.phoneNumber && styles.inputError]}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                value={prefs.sms.phoneNumber}
                onChangeText={(t) => setPrefs({ ...prefs, sms: { ...prefs.sms, phoneNumber: t } })}
              />
              {!prefs.sms.phoneNumber && <Text style={styles.errorText}>Phone number is required when SMS notifications are enabled</Text>}
            </View>
          )}
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Enable Quiet Hours</Text>
              <Text style={styles.description}>Pause notifications during specified hours</Text>
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
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TimePicker
                    value={prefs.quietHours.startTime}
                    onTimeChange={(startTime) => setPrefs({
                      ...prefs,
                      quietHours: { ...prefs.quietHours, startTime }
                    })}
                    placeholder="Select start time"
                  />
                </View>
                <View style={styles.timeInputContainer}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TimePicker
                    value={prefs.quietHours.endTime}
                    onTimeChange={(endTime) => setPrefs({
                      ...prefs,
                      quietHours: { ...prefs.quietHours, endTime }
                    })}
                    placeholder="Select end time"
                  />
                </View>
              </View>
              <View style={styles.exceptionsContainer}>
                <Text style={styles.inputLabel}>Exceptions (always notify)</Text>
                {prefs.quietHours.exceptions.map((exception, index) => {
                  const exceptionLabels = {
                    urgent: 'Urgent',
                    security: 'Security',
                    system: 'System'
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
                          color="#007AFF" 
                          style={styles.exceptionIcon}
                        />
                        <Text style={styles.exceptionLabel}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              You'll receive notifications for device alerts, security events, system updates, and maintenance reminders based on your preferences above.
            </Text>
          </View>
        </View>

      </ScrollView>
      <OverlayLoader
        visible={showLoader}
        message={saving ? 'Saving...' : 'Loading...'}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA'
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E' },
  saveIconButton: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#007AFF', borderRadius: 18 },
  content: { flex: 1, paddingHorizontal: 16 },
  section: { backgroundColor: '#FFFFFF', padding: 16, marginTop: 12, borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  labelContainer: { flex: 1, marginRight: 16 },
  label: { fontSize: 16, fontWeight: '500', color: '#1C1C1E', marginBottom: 4 },
  description: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  inputContainer: { marginTop: 12 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#1C1C1E', marginBottom: 8 },
  input: { 
    borderWidth: 1, 
    borderColor: '#E5E5EA', 
    borderRadius: 8, 
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF'
  },
  inputError: {
    borderColor: '#FF3B30'
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF'
  },
  infoText: {
    fontSize: 14,
    color: '#1C1C1E',
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
    color: '#1C1C1E',
    fontWeight: '500'
  },
  permissionButton: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  }
});

export default NotificationSettingsScreen;


