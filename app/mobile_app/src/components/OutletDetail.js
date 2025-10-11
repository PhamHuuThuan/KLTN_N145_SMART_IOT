import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useTranslation } from 'react-i18next';
import OverlayLoader from './OverlayLoader';
import ActionFeedback from './ActionFeedback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import { createLogger } from '../utils/logger';

const log = createLogger('OutletDetail');

const OutletDetail = ({ 
  outlet, 
  deviceId, 
  isVisible, 
  onClose, 
  onUpdateOutlet,
  onControlOutlet,
  loading,
  deviceData,
  onRefreshDeviceData
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [outletName, setOutletName] = useState(outlet?.name || '');
  const [outletGroup, setOutletGroup] = useState(outlet?.type || 'kitchen');
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  
  // Get real-time outlet status
  const getOutletStatus = (outletId) => {
    // First try to get from latestTelemetry.o (real-time data)
    if (deviceData?.latestTelemetry?.o && deviceData.latestTelemetry.o[outletId] !== undefined) {
      return deviceData.latestTelemetry.o[outletId];
    }
    
    // Fallback to outlet.status
    return outlet?.status ?? false;
  };
  
  const outletStatus = getOutletStatus(outlet?.id);

  // Force re-render when deviceData changes
  useEffect(() => {
    log.debug('deviceData updated', outlet?.id);
  }, [deviceData?.latestTelemetry?.o]);

  const handleEdit = () => {
    setIsEditing(true);
    setOutletName(outlet.name || '');
    setOutletGroup(outlet.type || 'kitchen');
  };

  const handleSave = async () => {
    if (!outletName.trim()) {
      setFeedback({ visible: true, type: 'error', message: t('devices.outletNameRequired') });
      return;
    }

    try {
      setShowLoader(true);
      await onUpdateOutlet(outlet.id, {
        name: outletName.trim(),
        type: outletGroup
      });
      setIsEditing(false);
      setFeedback({ visible: true, type: 'success', message: t('devices.outletUpdated') });
    } catch (error) {
      setFeedback({ visible: true, type: 'error', message: error.message || t('devices.updateFailed') });
    } finally {
      setShowLoader(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setOutletName(outlet.name || '');
    setOutletGroup(outlet.type || 'kitchen');
  };

  const handleToggle = async () => {
    const action = outletStatus ? 'off' : 'on';
    log.debug('toggle', outlet?.id, '->', action);
    
    if (!onControlOutlet) {
      console.error(`❌ onControlOutlet function not provided`);
      setFeedback({ visible: true, type: 'error', message: t('devices.controlFunctionNotAvailable') });
      return;
    }
    
    if (!deviceId || !outlet?.id) {
      setFeedback({ visible: true, type: 'error', message: t('devices.deviceOrOutletNotFound') });
      return;
    }
    setShowLoader(true);
    const success = await onControlOutlet(action, deviceId, outlet.id);
    setShowLoader(false);
    log.debug('toggle result', success);
    
    if (success) {
      log.info('toggle success', outlet?.id, '->', action);
      
      // Refresh device data after successful toggle
      if (onRefreshDeviceData) {
        setTimeout(() => {
          onRefreshDeviceData();
        }, 300);
      }
      
      setFeedback({ visible: true, type: 'success', message: t('devices.outletCommandSent', { action }) });
      onClose();
    } else {
      log.error('toggle failed', outlet?.id, '->', action);
      setFeedback({ visible: true, type: 'error', message: t('devices.commandFailed') });
    }
  };

  const getGroupIcon = (group) => {
    switch (group) {
      case 'kitchen':
        return 'stove';
      case 'safety':
        return 'shield';
      default:
        return 'power';
    }
  };

  const getGroupColor = (group) => {
    switch (group) {
      case 'kitchen':
        return CONFIG.COLORS.warning;
      case 'safety':
        return CONFIG.COLORS.danger;
      default:
        return CONFIG.COLORS.gray;
    }
  };

  if (!isVisible || !outlet) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView style={[styles.modalContent, { backgroundColor: colors.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>{t('devices.outletDetails')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.outletInfo} keyboardShouldPersistTaps="handled">
            <View style={styles.outletHeader}>
              <MaterialCommunityIcons 
                name={getGroupIcon(outletGroup)} 
                size={32} 
                color={getGroupColor(outletGroup)} 
              />
              <View style={styles.outletTitle}>
                <Text style={[styles.outletId, { color: colors.primary }]}>{outlet.id.toUpperCase()}</Text>
                <Text style={[styles.outletName, { color: colors.text }]}>
                  {isEditing ? outletName : (outlet.name || t('devices.outlet', { id: outlet.id }))}
                </Text>
              </View>
            </View>

            <View style={styles.groupSection}>
              <Text style={[styles.groupLabel, { color: colors.text }]}>{t('devices.group')}:</Text>
              <View style={[styles.groupBadge, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.groupText, { color: getGroupColor(outletGroup) }]}>
                  {isEditing ? outletGroup.toUpperCase() : (outlet.type || 'KITCHEN').toUpperCase()}
                </Text>
              </View>
            </View>

            {isEditing && (
              <View style={[styles.editSection, { borderTopColor: colors.border }]}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('devices.outletName')}:</Text>
                  <TextInput
                    style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                    value={outletName}
                    onChangeText={setOutletName}
                    placeholder={t('devices.enterOutletName')}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={30}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('devices.group')}:</Text>
                  <View style={styles.groupButtons}>
                    <TouchableOpacity
                      style={[
                        styles.groupButton,
                        { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                        outletGroup === 'kitchen' && [styles.groupButtonActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
                      ]}
                      onPress={() => setOutletGroup('kitchen')}
                    >
                      <MaterialCommunityIcons 
                        name="stove" 
                        size={20} 
                        color={outletGroup === 'kitchen' ? colors.white : CONFIG.COLORS.warning} 
                      />
                      <Text style={[
                        styles.groupButtonText,
                        { color: colors.textSecondary },
                        outletGroup === 'kitchen' && [styles.groupButtonTextActive, { color: colors.white }]
                      ]}>
                        {t('devices.kitchen')}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.groupButton,
                        { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                        outletGroup === 'safety' && [styles.groupButtonActive, { backgroundColor: colors.primary, borderColor: colors.primary }]
                      ]}
                      onPress={() => setOutletGroup('safety')}
                    >
                      <MaterialCommunityIcons 
                        name="shield" 
                        size={20} 
                        color={outletGroup === 'safety' ? colors.white : CONFIG.COLORS.danger} 
                      />
                      <Text style={[
                        styles.groupButtonText,
                        { color: colors.textSecondary },
                        outletGroup === 'safety' && [styles.groupButtonTextActive, { color: colors.white }]
                      ]}>
                        {t('devices.safety')}
                      </Text>
                    </TouchableOpacity>
                  </View>
          {/* Caution note to inform emergency behavior based on selected group */}
          <View
            style={[
              styles.cautionBox,
              { backgroundColor: colors.backgroundSecondary },
              outletGroup === 'kitchen' && { borderColor: CONFIG.COLORS.warning },
              outletGroup === 'safety' && { borderColor: CONFIG.COLORS.danger }
            ]}
          >
            <MaterialCommunityIcons
              name="alert-circle"
              size={18}
              color={outletGroup === 'safety' ? CONFIG.COLORS.danger : CONFIG.COLORS.warning}
            />
            <Text style={[styles.cautionText, { color: colors.text }]}>
              {outletGroup === 'safety'
                ? t('devices.safetyEmergencyCaution')
                : t('devices.kitchenEmergencyCaution')}
            </Text>
          </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            {!isEditing ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton, { backgroundColor: CONFIG.COLORS.info }]}
                  onPress={handleEdit}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={colors.white} />
                  <Text style={[styles.actionButtonText, { color: colors.white }]}>{t('common.edit')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    outletStatus ? [styles.offButton, { backgroundColor: CONFIG.COLORS.danger }] : [styles.onButton, { backgroundColor: CONFIG.COLORS.success }],
                    loading && styles.disabledButton
                  ]}
                  onPress={handleToggle}
                  disabled={loading}
                >
                  <MaterialCommunityIcons 
                    name={outletStatus ? 'power-off' : 'power'} 
                    size={22} 
                    color={colors.white} 
                  />
                  <Text style={[styles.actionButtonText, { color: colors.white }]}>
                    {loading ? t('common.processing') : (outletStatus ? t('devices.turnOff') : t('devices.turnOn'))}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton, { backgroundColor: colors.gray }]}
                  onPress={handleCancel}
                >
                  <MaterialCommunityIcons name="close" size={20} color={colors.white} />
                  <Text style={[styles.actionButtonText, { color: colors.white }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                >
                  <MaterialCommunityIcons name="content-save" size={20} color={colors.white} />
                  <Text style={[styles.actionButtonText, { color: colors.white }]}>{t('common.save')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
      <OverlayLoader visible={showLoader} message={isEditing ? t('common.saving') : t('devices.sendingCommand')} onCancel={() => setShowLoader(false)} />
      <ActionFeedback visible={feedback.visible} type={feedback.type} message={feedback.message} onHide={() => setFeedback({ ...feedback, visible: false })} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  outletInfo: {
    marginBottom: 20,
  },
  outletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  outletTitle: {
    marginLeft: 12,
  },
  outletId: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  outletName: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    marginRight: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: CONFIG.COLORS.white,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  groupSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  groupLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  groupBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  groupText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  editSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  groupButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cautionBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderColor: CONFIG.COLORS.warning,
    borderRadius: 6,
  },
  cautionText: {
    flex: 1,
    fontSize: 12,
  },
  groupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  groupButtonActive: {
    // backgroundColor and borderColor handled by theme
  },
  groupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  groupButtonTextActive: {
    // color handled by theme
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  editButton: {
    // backgroundColor handled by theme
  },
  onButton: {
    // backgroundColor handled by theme
  },
  offButton: {
    // backgroundColor handled by theme
  },
  cancelButton: {
    // backgroundColor handled by theme
  },
  saveButton: {
    // backgroundColor handled by theme
  },
  actionButtonText: {
    fontWeight: 'bold',
    marginLeft: 6,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default OutletDetail;
