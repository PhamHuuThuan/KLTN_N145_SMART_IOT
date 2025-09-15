import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';

const NotificationSettingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    email: { enabled: true, address: '' },
    sms: { enabled: false, phoneNumber: '' },
    fcm: { enabled: true },
    inApp: { enabled: true },
  });

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
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
      Alert.alert('Error', 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        email: { enabled: prefs.email.enabled, address: prefs.email.address },
        sms: { enabled: prefs.sms.enabled, phoneNumber: prefs.sms.phoneNumber },
        fcm: { enabled: prefs.fcm.enabled },
        inApp: { enabled: prefs.inApp.enabled },
      };
      const res = await notificationService.updatePreferences(user.id, payload);
      if (res.success) {
        Alert.alert('Saved', 'Notification preferences updated');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
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
        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving || loading}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>In-App</Text>
            <Switch value={prefs.inApp.enabled} onValueChange={(v) => setPrefs({ ...prefs, inApp: { enabled: v } })} />
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
  saveButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#007AFF', borderRadius: 16 },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
  content: { flex: 1 },
  section: { backgroundColor: '#FFFFFF', padding: 16, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 16, color: '#1C1C1E' },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12 }
});

export default NotificationSettingsScreen;


