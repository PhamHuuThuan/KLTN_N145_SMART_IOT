import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const RuleDetailModal = ({ 
  visible, 
  onClose, 
  selectedRule, 
  editFields, 
  setEditFields, 
  onSave 
}) => {
  if (!selectedRule) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Rule Details</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color={CONFIG.COLORS.gray} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>Rule name</Text>
        <TextInput
          style={styles.input}
          value={editFields.name}
          onChangeText={(t) => setEditFields(prev => ({ ...prev, name: t }))}
          placeholder="Rule name"
        />
        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={editFields.description}
          onChangeText={(t) => setEditFields(prev => ({ ...prev, description: t }))}
          placeholder="Description"
          multiline
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>Priority (1-10)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(editFields.priority)}
              onChangeText={(t) => setEditFields(prev => ({ ...prev, priority: Number(t || 0) }))}
              placeholder="5"
            />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>Active</Text>
            <Switch
              value={editFields.isActive}
              onValueChange={(val) => setEditFields(prev => ({ ...prev, isActive: val }))}
              trackColor={{ false: CONFIG.COLORS.gray, true: CONFIG.COLORS.success }}
              thumbColor={CONFIG.COLORS.white}
            />
          </View>
        </View>
        {selectedRule?.conditions?.[0]?.type === 'sensor' && (
          <>
            <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>
              Sensor threshold ({selectedRule.conditions[0].sensor} {selectedRule.conditions[0].operator})
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editFields.sensorValue}
              onChangeText={(t) => setEditFields(prev => ({ ...prev, sensorValue: t }))}
              placeholder="Threshold value"
            />
          </>
        )}
        {selectedRule?.conditions?.[0]?.type === 'time' && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Hour</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editFields.timeHour}
                onChangeText={(t) => setEditFields(prev => ({ ...prev, timeHour: t }))}
                placeholder="0-23"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Minute</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editFields.timeMinute}
                onChangeText={(t) => setEditFields(prev => ({ ...prev, timeMinute: t }))}
                placeholder="0-59"
              />
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[styles.createButton, { marginTop: 16 }]}
          onPress={onSave}
        >
          <MaterialIcons name="save" size={20} color={CONFIG.COLORS.white} />
          <Text style={styles.createButtonText}>Save changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.light,
  },
  input: {
    backgroundColor: CONFIG.COLORS.white,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: CONFIG.COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.COLORS.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
  },
  closeButton: {
    padding: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONFIG.COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default RuleDetailModal;
