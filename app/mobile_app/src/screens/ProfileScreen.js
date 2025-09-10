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
import { useAuth } from '../contexts/AuthContext';
import CONFIG from '../constants/config';

const ProfileScreen = ({ navigation }) => {
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
      Alert.alert('Permission required', 'Please allow photo access to select an avatar.');
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

  const handleSaveProfile = async () => {
    try {
      const result = await updateProfile(
        formData.name,
        formData.phone,
        formData.avatar || null
      );
      
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully');
        const updatedUser = result.user || {};
        setFormData({
          name: updatedUser.name || formData.name,
          email: updatedUser.email || formData.email,
          phone: updatedUser.phone || updatedUser.phoneNumber || updatedUser?.profile?.phone || formData.phone,
          avatar: updatedUser.avatar || formData.avatar,
        });
        setIsEditing(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  const renderProfileInfo = () => (
    <View style={[styles.section, styles.card]}> 
      <Text style={styles.sectionTitle}>Profile Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name</Text>
        <View style={[styles.inputRow, !isEditing && styles.inputRowDisabled]}> 
          <Ionicons name="person-outline" size={20} color={CONFIG.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.inputInner}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            editable={isEditing}
            placeholder="Enter your full name"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <View style={[styles.inputRow, styles.inputRowDisabled]}> 
          <Ionicons name="mail-outline" size={20} color={CONFIG.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.inputInner}
            value={formData.email}
            editable={false}
            placeholder="Email address"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={[styles.inputRow, !isEditing && styles.inputRowDisabled]}> 
          <Ionicons name="call-outline" size={20} color={CONFIG.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.inputInner}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            editable={isEditing}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.buttonRow}>
        {isEditing ? (
          <>
            <TouchableOpacity
              style={[styles.ctaButton, styles.saveButton]}
              onPress={handleSaveProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={CONFIG.COLORS.white} />
              ) : (
                <Text style={styles.ctaText}>Save Changes</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaButton, styles.cancelButton]}
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
              <Text style={[styles.ctaText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, styles.editButton]}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.ctaText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderAccountActions = () => (
    <View style={[styles.section, styles.card]}>
      <Text style={styles.sectionTitle}>Account</Text>
      
      <TouchableOpacity
        style={[styles.ctaButton, styles.logoutButton]}
        onPress={handleLogout}
      >
        <Text style={styles.ctaText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.THEME.primary} />
      
      <LinearGradient
        colors={[CONFIG.THEME.primary, CONFIG.THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={CONFIG.COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.headerProfileRow}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change avatar"
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
                style={styles.cameraBadge}
                onPress={handlePickAvatar}
                accessibilityRole="button"
                accessibilityLabel="Pick avatar"
              >
                <Ionicons name="camera" size={16} color={CONFIG.COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerUserInfo}>
            <Text style={styles.userName}>{formData.name || 'User'}</Text>
            <Text style={styles.userEmail}>{formData.email}</Text>
            {isEditing && (
              <Text style={styles.editHint}>Tap avatar to change</Text>
            )}
          </View>
        </View>
      </LinearGradient>
      
      <ScrollView style={styles.content}>
        {renderProfileInfo()}
        {renderAccountActions()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
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
    backgroundColor: CONFIG.THEME.surface,
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
    color: CONFIG.COLORS.dark,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    backgroundColor: CONFIG.THEME.surface,
  },
  inputRowDisabled: {
    backgroundColor: CONFIG.THEME.background,
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
  editButton: {
    backgroundColor: CONFIG.THEME.primary,
  },
  saveButton: {
    backgroundColor: CONFIG.THEME.success,
  },
  cancelButton: {
    backgroundColor: CONFIG.THEME.background,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
  },
  logoutButton: {
    backgroundColor: CONFIG.THEME.danger,
  },
  ctaText: {
    color: CONFIG.COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: CONFIG.COLORS.dark,
  },
});

export default ProfileScreen;
