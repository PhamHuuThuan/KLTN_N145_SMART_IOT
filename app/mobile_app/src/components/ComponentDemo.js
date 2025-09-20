import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import CategoryCard from './CategoryCard';
import TimePicker from './TimePicker';

const ComponentDemo = () => {
  const [time, setTime] = useState('14:30');
  
  const [categoryConfig, setCategoryConfig] = useState({
    enabled: true,
    methods: {
      inApp: true,
      email: true,
      sms: false,
      fcm: true
    }
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Component Demo</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category Card</Text>
        <CategoryCard
          category="sensor"
          config={categoryConfig}
          onUpdate={setCategoryConfig}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time Picker</Text>
        <View style={styles.timePickerContainer}>
          <Text style={styles.label}>Selected Time: {time}</Text>
          <TimePicker
            value={time}
            onTimeChange={setTime}
            placeholder="Select time"
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  timePickerContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  label: {
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 12,
  },
});

export default ComponentDemo;
