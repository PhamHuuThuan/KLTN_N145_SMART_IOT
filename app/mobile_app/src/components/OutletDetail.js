import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  TextInput, 
  Alert 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const OutletDetail = ({ 
  outlet, 
  deviceId, 
  isVisible, 
  onClose, 
  onUpdateOutlet,
  onControlOutlet,
  loading 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [outletName, setOutletName] = useState(outlet?.name || '');
  const [outletGroup, setOutletGroup] = useState(outlet?.type || 'kitchen');

  const handleEdit = () => {
    setIsEditing(true);
    setOutletName(outlet.name || '');
    setOutletGroup(outlet.type || 'kitchen');
  };

  const handleSave = async () => {
    if (!outletName.trim()) {
      Alert.alert('Error', 'Please enter outlet name');
      return;
    }

    try {
      await onUpdateOutlet(outlet.id, {
        name: outletName.trim(),
        type: outletGroup
      });
      setIsEditing(false);
      Alert.alert('Success', 'Outlet settings updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setOutletName(outlet.name || '');
    setOutletGroup(outlet.type || 'kitchen');
  };

  const handleToggle = async () => {
    const action = outlet.status ? 'off' : 'on';
    const success = await onControlOutlet(action, deviceId, outlet.id);
    if (success) {
      Alert.alert('Success', `Outlet ${action} command sent`);
    } else {
      Alert.alert('Error', 'Failed to send command');
    }
  };

  const getGroupIcon = (group) => {
    switch (group) {
      case 'kitchen':
        return 'kitchen';
      case 'safety':
        return 'security';
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
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Outlet Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={CONFIG.COLORS.gray} />
            </TouchableOpacity>
          </View>

          <View style={styles.outletInfo}>
            <View style={styles.outletHeader}>
              <MaterialIcons 
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

            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Status:</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: outlet.status ? CONFIG.COLORS.success : CONFIG.COLORS.gray }
              ]}>
                <MaterialIcons 
                  name={outlet.status ? 'power' : 'power-off'} 
                  size={16} 
                  color={CONFIG.COLORS.white} 
                />
                <Text style={styles.statusText}>
                  {outlet.status ? 'ON' : 'OFF'}
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
                      <MaterialIcons 
                        name="kitchen" 
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
                      <MaterialIcons 
                        name="security" 
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
                </View>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {!isEditing ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={handleEdit}
                >
                  <MaterialIcons name="edit" size={20} color={CONFIG.COLORS.white} />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    outlet.status ? styles.offButton : styles.onButton
                  ]}
                  onPress={handleToggle}
                  disabled={loading}
                >
                  <MaterialIcons 
                    name={outlet.status ? 'power-off' : 'power'} 
                    size={20} 
                    color={CONFIG.COLORS.white} 
                  />
                  <Text style={styles.actionButtonText}>
                    {loading ? 'Processing...' : (outlet.status ? 'Turn OFF' : 'Turn ON')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancel}
                >
                  <MaterialIcons name="close" size={20} color={CONFIG.COLORS.white} />
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSave}
                >
                  <MaterialIcons name="save" size={20} color={CONFIG.COLORS.white} />
                  <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
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
});

export default OutletDetail;
