import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const CustomizeModal = ({ 
  visible, 
  onClose, 
  customizeTemplate, 
  customFields, 
  setCustomFields, 
  onCreate 
}) => {
  if (!customizeTemplate) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Customize Rule</Text>
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
          value={customFields.name}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, name: t }))}
          placeholder="Rule name"
        />
        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={customFields.description}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, description: t }))}
          placeholder="Description"
          multiline
        />
        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Priority (1-10)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(customFields.priority)}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, priority: Number(t || 0) }))}
          placeholder="5"
        />
        {customizeTemplate?.conditions?.[0]?.type === 'sensor' && (
          <>
            <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>
              Sensor threshold ({customizeTemplate.conditions[0].sensor} {customizeTemplate.conditions[0].operator})
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={customFields.sensorValue}
              onChangeText={(t) => setCustomFields(prev => ({ ...prev, sensorValue: t }))}
              placeholder="Threshold value"
            />
          </>
        )}
        {customizeTemplate?.conditions?.[0]?.type === 'time' && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Hour</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={customFields.timeHour}
                onChangeText={(t) => setCustomFields(prev => ({ ...prev, timeHour: t }))}
                placeholder="0-23"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Minute</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={customFields.timeMinute}
                onChangeText={(t) => setCustomFields(prev => ({ ...prev, timeMinute: t }))}
                placeholder="0-59"
              />
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[styles.createButton, { marginTop: 16 }]}
          onPress={onCreate}
        >
          <MaterialIcons name="check" size={20} color={CONFIG.COLORS.white} />
          <Text style={styles.createButtonText}>Create with customization</Text>
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

export default CustomizeModal;
