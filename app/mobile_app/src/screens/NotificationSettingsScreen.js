import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';
import TimePicker from '../components/TimePicker';

const NotificationSettingsScreen = ({ navigation }) => {
  const { user } = useAuth();
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
        setFeedback({ visible: true, type: 'success', message: 'Notification preferences saved successfully' });
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
            <Switch value={prefs.fcm.enabled} onValueChange={(v) => setPrefs({ ...prefs, fcm: { enabled: v } })} />
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
        onHide={() => {
          setFeedback({ ...feedback, visible: false });
          if (!saving && feedback.type === 'success') {
            // Navigate back to notification list after successful save
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
  }
});

export default NotificationSettingsScreen;


