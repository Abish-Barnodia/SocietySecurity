import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStyles } from '../styles';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';

export default function CreateProfileScreen() {
  const { login } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  
  const isValid = name.trim().length > 0 && flat.trim().length > 0;

  const handleContinue = () => {
    if (!isValid) return;
    // TODO: Create resident profile in database and transition out of Auth flow
    login('', '');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.contentContainer}>
        
        <View style={styles.iconWrapper}>
          <Ionicons name="person-add-outline" size={32} color="#b45309" />
        </View>

        <Text style={styles.title}>Create Profile</Text>
        <Text style={styles.subtitle}>Set up your resident profile to get started</Text>

        <Text style={styles.label}>FULL NAME</Text>
        <View style={styles.standardInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
          />
        </View>

        <Text style={styles.label}>TOWER</Text>
        <TouchableOpacity style={styles.dropdownContainer}>
          <Text style={styles.input}>Tower A</Text>
          <Ionicons name="chevron-down" size={20} color="#6b7280" />
        </TouchableOpacity>

        <Text style={styles.label}>FLAT NUMBER</Text>
        <View style={styles.standardInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 402"
            placeholderTextColor="#9ca3af"
            value={flat}
            onChangeText={setFlat}
            keyboardType="number-pad"
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, !isValid && styles.buttonDisabled]} 
          disabled={!isValid}
          onPress={handleContinue}
        >
          <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>Continue to App</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
