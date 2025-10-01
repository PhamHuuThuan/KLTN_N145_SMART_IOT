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
import OverlayLoader from './OverlayLoader';
import ActionFeedback from './ActionFeedback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
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
      setFeedback({ visible: true, type: 'error', message: 'Please enter outlet name' });
      return;
    }

    try {
      setShowLoader(true);
      await onUpdateOutlet(outlet.id, {
        name: outletName.trim(),
        type: outletGroup
      });
      setIsEditing(false);
      setFeedback({ visible: true, type: 'success', message: 'Outlet updated' });
    } catch (error) {
      setFeedback({ visible: true, type: 'error', message: error.message || 'Update failed' });
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
      setFeedback({ visible: true, type: 'error', message: 'Control function not available' });
      return;
    }
    
    if (!deviceId || !outlet?.id) {
      setFeedback({ visible: true, type: 'error', message: 'Device or outlet not found' });
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
      
      setFeedback({ visible: true, type: 'success', message: `Outlet ${action} command sent` });
      onClose();
    } else {
      log.error('toggle failed', outlet?.id, '->', action);
      setFeedback({ visible: true, type: 'error', message: 'Failed to send command' });
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
        <KeyboardAvoidingView style={styles.modalContent} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>Outlet Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={CONFIG.COLORS.gray} />
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
                <Text style={styles.outletId}>{outlet.id.toUpperCase()}</Text>
                <Text style={styles.outletName}>
                  {isEditing ? outletName : (outlet.name || `Outlet ${outlet.id}`)}
                </Text>
              </View>
            </View>

            <View style={styles.groupSection}>
              <Text style={styles.groupLabel}>Group:</Text>
              <View style={styles.groupBadge}>
                <Text style={[styles.groupText, { color: getGroupColor(outletGroup) }]}>
                  {isEditing ? outletGroup.toUpperCase() : (outlet.type || 'KITCHEN').toUpperCase()}
                </Text>
              </View>
            </View>

            {isEditing && (
              <View style={styles.editSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Outlet Name:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={outletName}
                    onChangeText={setOutletName}
                    placeholder="Enter outlet name"
                    maxLength={30}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Group:</Text>
                  <View style={styles.groupButtons}>
                    <TouchableOpacity
                      style={[
                        styles.groupButton,
                        outletGroup === 'kitchen' && styles.groupButtonActive
                      ]}
                      onPress={() => setOutletGroup('kitchen')}
                    >
                      <MaterialCommunityIcons 
                        name="stove" 
                        size={20} 
                        color={outletGroup === 'kitchen' ? CONFIG.COLORS.white : CONFIG.COLORS.warning} 
                      />
                      <Text style={[
                        styles.groupButtonText,
                        outletGroup === 'kitchen' && styles.groupButtonTextActive
                      ]}>
                        Kitchen
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.groupButton,
                        outletGroup === 'safety' && styles.groupButtonActive
                      ]}
                      onPress={() => setOutletGroup('safety')}
                    >
                      <MaterialCommunityIcons 
                        name="shield" 
                        size={20} 
                        color={outletGroup === 'safety' ? CONFIG.COLORS.white : CONFIG.COLORS.danger} 
                      />
                      <Text style={[
                        styles.groupButtonText,
                        outletGroup === 'safety' && styles.groupButtonTextActive
                      ]}>
                        Safety
                      </Text>
                    </TouchableOpacity>
                  </View>
          {/* Caution note to inform emergency behavior based on selected group */}
          <View
            style={[
              styles.cautionBox,
              outletGroup === 'kitchen' && { borderColor: CONFIG.COLORS.warning },
              outletGroup === 'safety' && { borderColor: CONFIG.COLORS.danger }
            ]}
          >
            <MaterialCommunityIcons
              name="alert-circle"
              size={18}
              color={outletGroup === 'safety' ? CONFIG.COLORS.danger : CONFIG.COLORS.warning}
            />
            <Text style={styles.cautionText}>
              {outletGroup === 'safety'
                ? 'Caution: In Emergency Mode, safety devices will automatically turn ON.'
                : 'Caution: In Emergency Mode, kitchen devices will automatically turn OFF.'}
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
                  style={[styles.actionButton, styles.editButton]}
                  onPress={handleEdit}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color={CONFIG.COLORS.white} />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    outletStatus ? styles.offButton : styles.onButton,
                    loading && styles.disabledButton
                  ]}
                  onPress={handleToggle}
                  disabled={loading}
                >
                  <MaterialCommunityIcons 
                    name={outletStatus ? 'power-off' : 'power'} 
                    size={22} 
                    color={CONFIG.COLORS.white} 
                  />
                  <Text style={styles.actionButtonText}>
                    {loading ? 'Processing...' : (outletStatus ? 'TURN OFF' : 'TURN ON')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancel}
                >
                  <MaterialCommunityIcons name="close" size={20} color={CONFIG.COLORS.white} />
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSave}
                >
                  <MaterialCommunityIcons name="content-save" size={20} color={CONFIG.COLORS.white} />
                  <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
      <OverlayLoader visible={showLoader} message={isEditing ? 'Saving...' : 'Sending command...'} onCancel={() => setShowLoader(false)} />
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
    backgroundColor: CONFIG.COLORS.white,
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
    color: CONFIG.COLORS.primary,
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
    color: CONFIG.COLORS.primary,
    marginBottom: 4,
  },
  outletName: {
    fontSize: 18,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
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
    color: CONFIG.COLORS.dark,
    marginRight: 10,
  },
  groupBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: CONFIG.COLORS.light,
  },
  groupText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  editSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: CONFIG.COLORS.light,
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
    backgroundColor: CONFIG.COLORS.light,
    borderLeftWidth: 3,
    borderColor: CONFIG.COLORS.warning,
    borderRadius: 6,
  },
  cautionText: {
    flex: 1,
    color: CONFIG.COLORS.dark,
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
    borderColor: '#E0E0E0',
    backgroundColor: CONFIG.COLORS.light,
  },
  groupButtonActive: {
    backgroundColor: CONFIG.COLORS.primary,
    borderColor: CONFIG.COLORS.primary,
  },
  groupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    color: CONFIG.COLORS.gray,
  },
  groupButtonTextActive: {
    color: CONFIG.COLORS.white,
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
    backgroundColor: CONFIG.COLORS.info,
  },
  onButton: {
    backgroundColor: CONFIG.COLORS.success,
  },
  offButton: {
    backgroundColor: CONFIG.COLORS.danger,
  },
  cancelButton: {
    backgroundColor: CONFIG.COLORS.gray,
  },
  saveButton: {
    backgroundColor: CONFIG.COLORS.primary,
  },
  actionButtonText: {
    color: CONFIG.COLORS.white,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default OutletDetail;
