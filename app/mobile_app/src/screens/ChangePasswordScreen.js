import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CONFIG from '../constants/config';
import { useAuth } from '../contexts/AuthContext';
import ActionFeedback from '../components/ActionFeedback';

const ChangePasswordScreen = ({ navigation }) => {
  const { changePassword, isLoading } = useAuth();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  const onSubmit = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      setFeedback({ visible: true, type: 'error', message: 'New passwords do not match' });
      return;
    }
    if (passwords.newPassword.length < 6) {
      setFeedback({ visible: true, type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }
    const result = await changePassword(passwords.currentPassword, passwords.newPassword);
    if (result.success) {
      setFeedback({ visible: true, type: 'success', message: 'Password changed successfully!' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    } else {
      setFeedback({ visible: true, type: 'error', message: result.error || 'Failed to change password' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.COLORS.primary} />
      <LinearGradient
        colors={[CONFIG.COLORS.primary, CONFIG.COLORS.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={CONFIG.COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={[styles.card, styles.section]}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <Text style={styles.label}>Current Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={passwords.currentPassword}
            onChangeText={(t) => setPasswords({ ...passwords, currentPassword: t })}
            placeholder="Enter current password"
            secureTextEntry={!showCurrent}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrent(!showCurrent)}>
            <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={CONFIG.COLORS.gray} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={passwords.newPassword}
            onChangeText={(t) => setPasswords({ ...passwords, newPassword: t })}
            placeholder="Enter new password"
            secureTextEntry={!showNew}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew(!showNew)}>
            <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={CONFIG.COLORS.gray} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={passwords.confirmPassword}
            onChangeText={(t) => setPasswords({ ...passwords, confirmPassword: t })}
            placeholder="Confirm new password"
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm(!showConfirm)}>
            <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={CONFIG.COLORS.gray} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onSubmit}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Change Password</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: CONFIG.COLORS.light 
  },
  header: { 
    paddingTop: 40, 
    paddingHorizontal: 16, 
    paddingBottom: 16 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  backButton: { 
    padding: 8 
  },
  headerTitle: { 
    color: CONFIG.COLORS.white, 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  section: { 
    padding: CONFIG.DIMENSIONS.cardPadding, 
    borderRadius: CONFIG.DIMENSIONS.borderRadius, 
    margin: 16 
  },
  card: {
    backgroundColor: CONFIG.COLORS.white,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    elevation: 4,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: CONFIG.COLORS.dark, 
    marginBottom: 12 
  },
  label: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: CONFIG.COLORS.dark, 
    marginBottom: 6, 
    marginTop: 8 
  },
  passwordRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: CONFIG.COLORS.border, 
    borderRadius: CONFIG.DIMENSIONS.borderRadius, 
    backgroundColor: CONFIG.COLORS.white 
  },
  passwordInput: { 
    flex: 1, 
    padding: 12, 
    fontSize: 16 
  },
  eyeButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 10 
  },
  button: { 
    marginTop: 16, 
    padding: 12, 
    borderRadius: CONFIG.DIMENSIONS.borderRadius, 
    alignItems: 'center' 
  },
  primaryButton: { 
    backgroundColor: CONFIG.COLORS.primary 
  },
  buttonText: { 
    color: CONFIG.COLORS.white, 
    fontSize: 16, 
    fontWeight: '600' 
  },
});

export default ChangePasswordScreen;
