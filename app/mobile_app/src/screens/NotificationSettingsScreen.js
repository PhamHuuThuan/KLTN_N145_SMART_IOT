import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';

const NotificationSettingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const [prefs, setPrefs] = useState({
    email: { enabled: true, address: '' },
    sms: { enabled: false, phoneNumber: '' },
    fcm: { enabled: true },
    inApp: { enabled: true },
  });

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setShowLoader(true);
    try {
      const res = await notificationService.getPreferences(user.id);
      if (res.success && res.data?.data) {
        setPrefs({
          email: {
            enabled: !!res.data.data.email?.enabled,
            address: res.data.data.email?.address || ''
          },
          sms: {
            enabled: !!res.data.data.sms?.enabled,
            phoneNumber: res.data.data.sms?.phoneNumber || ''
          },
          fcm: { enabled: !!res.data.data.fcm?.enabled },
          inApp: { enabled: !!res.data.data.inApp?.enabled },
        });
      }
    } catch (e) {
      setFeedback({ visible: true, type: 'error', message: 'Failed to load preferences' });
    } finally {
      setLoading(false);
      setShowLoader(false);
    }
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    setShowLoader(true);
    try {
      const payload = {
        email: { enabled: prefs.email.enabled, address: prefs.email.address },
        sms: { enabled: prefs.sms.enabled, phoneNumber: prefs.sms.phoneNumber },
        fcm: { enabled: prefs.fcm.enabled },
        inApp: { enabled: prefs.inApp.enabled },
      };
      const res = await notificationService.updatePreferences(user.id, payload);
      if (res.success) {
        setFeedback({ visible: true, type: 'success', message: 'Preferences saved' });
      }
    } catch (e) {
      setFeedback({ visible: true, type: 'error', message: 'Failed to save preferences' });
    } finally {
      setSaving(false);
      setShowLoader(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

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
          <View style={styles.row}>
            <Text style={styles.label}>In-App</Text>
            <Switch value={true} onValueChange={() => {}} disabled />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>FCM Push</Text>
            <Switch value={prefs.fcm.enabled} onValueChange={(v) => setPrefs({ ...prefs, fcm: { enabled: v } })} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Switch value={prefs.email.enabled} onValueChange={(v) => setPrefs({ ...prefs, email: { ...prefs.email, enabled: v } })} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            keyboardType="email-address"
            value={prefs.email.address}
            onChangeText={(t) => setPrefs({ ...prefs, email: { ...prefs.email, address: t } })}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>SMS</Text>
            <Switch value={prefs.sms.enabled} onValueChange={(v) => setPrefs({ ...prefs, sms: { ...prefs.sms, enabled: v } })} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={prefs.sms.phoneNumber}
            onChangeText={(t) => setPrefs({ ...prefs, sms: { ...prefs.sms, phoneNumber: t } })}
          />
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
  content: { flex: 1 },
  section: { backgroundColor: '#FFFFFF', padding: 16, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 16, color: '#1C1C1E' },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12 }
});

export default NotificationSettingsScreen;


