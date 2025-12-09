import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Alert, ActivityIndicator, FlatList, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CONFIG from '../constants/config';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import OverlayLoader from './OverlayLoader';
import ActionFeedback from './ActionFeedback';
import QRScannerModal from './QRScannerModal';
import rulesService from '../services/rulesService';
import { getRuleTemplates } from '../constants/ruleTemplates';

const DeviceSelector = ({
  devices,
  selectedDevice,
  onSelectDevice,
  onPressDetails,
  onDeviceAdded,
  onDeviceRemoved,
  hasMore,
  loadingMore,
  onLoadMore,
  showAddButton = true,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [processingScan, setProcessingScan] = useState(false);
  const { user } = useAuth();

  const normalizedDevices = Array.isArray(devices)
    ? devices.map((device) => (typeof device === 'string' ? { deviceId: device } : device))
    : [];

  const selectedDeviceData = normalizedDevices.find((device) => device.deviceId === selectedDevice) || null;
  const canAddDevice = showAddButton !== false;

  const extractDeviceIdFromPayload = (payload) => {
    if (!payload) return null;
    const trimmed = String(payload).trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.deviceId) return String(parsed.deviceId);
      if (parsed?.id) return String(parsed.id);
      if (parsed?.device?.id) return String(parsed.device.id);
    } catch (error) {
      // Not JSON
    }

    if (typeof URL !== 'undefined') {
      try {
        const possibleUrl = new URL(trimmed);
        const params = possibleUrl.searchParams;
        const fromQuery =
          params.get('deviceId') ||
          params.get('device_id') ||
          params.get('id');
        if (fromQuery) return String(fromQuery);
      } catch (error) {
        // Not URL
      }
    }

    if (/^[A-Za-z0-9\-_]+$/i.test(trimmed)) {
      return trimmed;
    }

    return null;
  };

  const handleQrScanResult = async (rawValue) => {
    if (!rawValue) return;
    setProcessingScan(true);
    try {
      const deviceId = extractDeviceIdFromPayload(rawValue);
      if (!deviceId) {
        throw new Error(t('devices.invalidQrCode', 'Invalid QR code'));
      }

      setNewDeviceId(deviceId);
      if (!newDeviceName) {
        setNewDeviceName(deviceId);
      }

      setFeedback({
        visible: true,
        type: 'success',
        message: t('devices.qrScanSuccess', {
          deviceId,
          defaultValue: 'Device selected via QR',
        }),
      });
      setShowQRScanner(false);
    } catch (error) {
      setFeedback({
        visible: true,
        type: 'error',
        message: error?.message || t('devices.qrScanFailed', 'Failed to process QR code'),
      });
    } finally {
      setProcessingScan(false);
    }
  };

  const StatusBadge = ({ status, lastSeenAt }) => {
    const isOnline = (status || '').toLowerCase() === 'online';
    const baseColor = isOnline ? colors.success : colors.danger;
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      let animation;
      if (isOnline) {
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
        animation.start();
      } else {
        pulseAnim.stopAnimation(() => {
          pulseAnim.setValue(0);
        });
      }

      return () => {
        animation?.stop();
      };
    }, [isOnline, pulseAnim]);

    const animatedDotStyle = isOnline
      ? {
          opacity: pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
          }),
          transform: [
            {
              scale: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1.1],
              }),
            },
          ],
        }
      : null;

    return (
      <View style={[
        styles.statusBadge,
        { backgroundColor: `${baseColor}22` }
      ]}>
        <Animated.View style={[
          styles.statusDot,
          { backgroundColor: baseColor },
          animatedDotStyle
        ]} />
      </View>
    );
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="devices" size={20} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('devices.connectedDevices')}</Text>
      </View>
      {normalizedDevices.length > 0 ? (
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.selectBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.gray} />
            <Text style={[styles.selectText, { color: colors.text }]} numberOfLines={1}>
              {selectedDeviceData?.name || selectedDeviceData?.deviceId || t('devices.selectDevice')}
            </Text>
            {selectedDeviceData?.deviceId && (
              <StatusBadge
                status={selectedDeviceData?.status}
                lastSeenAt={selectedDeviceData?.lastSeenAt || selectedDeviceData?.lastUpdate}
              />
            )}
          </TouchableOpacity>

          {canAddDevice && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
              <Text style={[styles.addText, { color: colors.white }]}>{t('common.add')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="devices" size={48} color={colors.gray} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>{t('devices.noDevicesConnected')}</Text>
          <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
            {t('devices.addFirstDevice')}
          </Text>
          {canAddDevice && (
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.white} />
              <Text style={[styles.emptyStateButtonText, { color: colors.white }]}>{t('devices.addDevice')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={showPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.primary }]}>{t('devices.selectDevice')}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={normalizedDevices}
              keyExtractor={(item) => item.deviceId}
              renderItem={({ item }) => {
                const deviceId = item.deviceId;
                const isSelected = selectedDevice === deviceId;
                return (
                <View style={styles.deviceItemContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      isSelected && [styles.modalItemActive, { backgroundColor: colors.backgroundSecondary }]
                    ]}
                    onPress={() => {
                      setShowPicker(false);
                      onSelectDevice && onSelectDevice(deviceId);
                    }}
                  >
                    <View style={styles.deviceLabel}>
                      <Text style={[
                        styles.modalItemText,
                        { color: colors.text },
                        isSelected && styles.modalItemTextActive
                      ]}>
                        {item.name || deviceId}
                      </Text>
                      {item.name && (
                        <Text style={[styles.modalItemSubText, { color: colors.textSecondary }]}>
                          {deviceId}
                        </Text>
                      )}
                    </View>
                    <StatusBadge
                      status={item.status}
                      lastSeenAt={item.lastSeenAt}
                    />
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: colors.backgroundSecondary }]}
                      activeOpacity={0.7}
                      onPress={() => {
                      Alert.alert(
                        t('devices.removeDevice'),
                        t('devices.removeDeviceConfirm', { deviceId }),
                        [
                          {
                            text: t('common.cancel'),
                            style: 'cancel'
                          },
                          {
                            text: t('devices.remove'),
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                setShowLoader(true);
                                const result = await apiService.removeDeviceOwnership(deviceId);
                                
                                if (result.success) {
                                  setFeedback({
                                    visible: true,
                                    type: 'success',
                                    message: t('devices.deviceRemoved')
                                  });
                                  setShowPicker(false);
                                  
                                  if (onDeviceRemoved) {
                                    const remainingDevices = normalizedDevices.filter(d => d.deviceId !== deviceId);
                                    const newSelectedDevice = remainingDevices.length > 0 ? remainingDevices[0].deviceId : null;
                                    await onDeviceRemoved(deviceId, newSelectedDevice);
                                  }
                                } else {
                                  setFeedback({
                                    visible: true,
                                    type: 'error',
                                    message: result.message || t('devices.deviceRemovedError')
                                  });
                                }
                              } catch (error) {
                                setFeedback({
                                  visible: true,
                                  type: 'error',
                                    message: error.message || t('devices.deviceRemovedError')
                                });
                              } finally {
                                setShowLoader(false);
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
              }}
              onEndReached={() => {
                if (hasMore && !loadingMore && onLoadMore) {
                  onLoadMore();
                }
              }}
              onEndReachedThreshold={0.1}
              ListFooterComponent={() => {
                if (loadingMore) {
                  return (
                    <View style={styles.loadMoreContainer}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={[styles.loadMoreText, { color: colors.textSecondary }]}>
                        {t('common.loadingMore')}
                      </Text>
                    </View>
                  );
                }
                return null;
              }}
              style={{ maxHeight: 260 }}
            />
          </View>
        </View>
      </Modal>

      {/* Add device modal */}
      {canAddDevice && (
        <Modal
          visible={showAddModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.primary }]}>{t('devices.addDevice')}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={colors.gray} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('devices.deviceId')}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.flexInput,
                      { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.text },
                    ]}
                    placeholder={t('devices.deviceIdPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={newDeviceId}
                    onChangeText={setNewDeviceId}
                    maxLength={50}
                  />
                  <TouchableOpacity
                    style={[
                      styles.iconButton,
                      { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                    ]}
                    onPress={() => setShowQRScanner(true)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                  {t('devices.scanQrHint', 'Scan device QR to select or pair quickly')}
                </Text>
                
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('devices.deviceName')}</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                  placeholder={t('devices.deviceNamePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={newDeviceName}
                  onChangeText={setNewDeviceName}
                  maxLength={50}
                />
                <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                  {t('devices.deviceNameHint')}
                </Text>
                <TouchableOpacity
                  style={[styles.addConfirmButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]}
                  onPress={async () => {
                    if (!newDeviceId?.trim()) {
                      Alert.alert(t('common.error'), t('devices.deviceIdRequired'));
                      return;
                    }
                    
                    if (newDeviceId.trim().length < 3) {
                      Alert.alert(t('common.error'), t('devices.deviceIdTooShort'));
                      return;
                    }
                    
                    if (!user?.id) {
                      Alert.alert(t('auth.authenticationRequired'), t('devices.loginRequired'));
                      return;
                    }
                    
                    try {
                      setSubmitting(true);
                      setShowLoader(true);
                      
                      const payload = {
                        deviceId: newDeviceId.trim(),
                        ownerId: user.id,
                        name: (newDeviceName || newDeviceId).trim()
                      };
                      
                      const resp = await apiService.post('/api/devices', payload);
                      
                      if (resp?.data?.success) {
                        // Tự động tạo các quy tắc khẩn cấp từ templates
                        try {
                          const language = i18n.language || 'vi';
                          let templates = {};
                          let urgentTemplates = [];
                          
                          // Ưu tiên lấy templates từ API admin
                          try {
                            const apiResponse = await rulesService.getTemplates(language);
                            if (apiResponse?.data && typeof apiResponse.data === 'object') {
                              templates = apiResponse.data;
                              console.log('Loaded templates from API:', Object.keys(templates).length);
                            }
                          } catch (apiError) {
                            console.warn('Failed to load templates from API, using local templates:', apiError);
                          }
                          
                          // Nếu không có templates từ API, dùng templates local
                          if (Object.keys(templates).length === 0) {
                            templates = getRuleTemplates(language);
                            console.log('Using local templates:', Object.keys(templates).length);
                          }
                          
                          // Lọc các templates có priority urgent
                          urgentTemplates = Object.values(templates).filter(
                            (template) => template && template.priority === 'urgent'
                          );
                          
                          if (urgentTemplates.length > 0) {
                            const createPromises = urgentTemplates.map((template) =>
                              rulesService.createRuleFromTemplate(
                                template,
                                payload.deviceId,
                                { ownerId: user.id }
                              ).catch((err) => {
                                console.warn('Failed to create urgent rule:', template.name, err);
                                return null;
                              })
                            );
                            
                            await Promise.allSettled(createPromises);
                            console.log(`Created ${urgentTemplates.length} urgent rules for device ${payload.deviceId}`);
                          }
                        } catch (ruleError) {
                          // Không làm gián đoạn quá trình thêm device nếu tạo rule thất bại
                          console.warn('Error creating urgent rules:', ruleError);
                        }
                        
                        setFeedback({ 
                          visible: true, 
                          type: 'success', 
                          message: t('devices.deviceAdded') 
                        });
                        setShowAddModal(false);
                        setNewDeviceId('');
                        setNewDeviceName('');
                        onSelectDevice && onSelectDevice(payload.deviceId);
                        onDeviceAdded && onDeviceAdded(resp.data.data);
                      } else {
                        setFeedback({ 
                          visible: true, 
                          type: 'error', 
                          message: resp?.data?.message || t('devices.deviceAddError') 
                        });
                      }
                    } catch (e) {
                      let errorMessage = t('devices.deviceAddError');
                      
                      if (e.response?.status === 400) {
                        errorMessage = t('devices.deviceIdInvalid');
                      } else if (e.response?.status === 401) {
                        errorMessage = t('auth.authenticationFailed');
                      } else if (e.response?.status === 500) {
                        errorMessage = t('errors.serverError');
                      }
                      
                      setFeedback({ 
                        visible: true, 
                        type: 'error', 
                        message: errorMessage 
                      });
                    } finally {
                      setSubmitting(false);
                      setShowLoader(false);
                    }
                  }}
                  disabled={submitting}
                  activeOpacity={0.9}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="content-save" size={18} color={colors.white} />
                      <Text style={[styles.addConfirmText, { color: colors.white }]}>{t('devices.addDevice')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Global overlays */}
      <OverlayLoader
        visible={showLoader}
        message={t('devices.addingDevice')}
        onCancel={() => {
          setShowLoader(false);
          setSubmitting(false);
        }}
      />
      <ActionFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onHide={() => setFeedback({ ...feedback, visible: false })}
      />
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => {
          if (!processingScan) setShowQRScanner(false);
        }}
        onScan={handleQrScanResult}
        isProcessing={processingScan}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addText: {
    fontWeight: '700',
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  modalContent: {
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  flexInput: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addConfirmButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addConfirmText: {
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    flex: 1,
  },
  deviceLabel: {
    flex: 1,
    marginRight: 10,
  },
  modalItemActive: {
    // backgroundColor handled by theme
  },
  modalItemText: {
    fontSize: 14,
    flex: 1,
  },
  modalItemTextActive: {
    fontWeight: '700',
  },
  modalItemSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  deviceItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  removeButton: {
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CONFIG.THEME.danger + '30', // 30% opacity
    shadowColor: CONFIG.THEME.danger,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    marginLeft: 8,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
  },
});

export default DeviceSelector;
