import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStyles } from '../styles';
import { useStyles } from '../../theme/useStyles';
import { useTheme } from '../../theme/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoginStackParamList } from '../LoginRoutes';
import api from '../../utils/api';

export default function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<LoginStackParamList>>();
  const { colors } = useTheme();
  const styles = useStyles(getStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isFormValid = name.length > 0 && email.length > 5 && password.length >= 6;

  const handleSignUp = async () => {
    if (!isFormValid) return;
    
    setIsLoading(true);
    try {
      const response = await api.post('/auth/email/signup', { name, email, password });
      if (response.data.status === 'success') {
        Alert.alert('Success', 'Please check your email for the verification code.');
        navigation.navigate('VerifyEmail', { email });
      } else {
        Alert.alert('Error', response.data.message || 'Sign up failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.contentContainer}>
        
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to join your community</Text>

        <Text style={styles.label}>FULL NAME</Text>
        <View style={styles.standardInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={styles.standardInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.standardInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter a strong password (min 6 chars)"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, (!isFormValid || isLoading) && styles.buttonDisabled]} 
          disabled={!isFormValid || isLoading}
          onPress={handleSignUp}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.buttonText, !isFormValid && styles.buttonTextDisabled]}>Sign Up</Text>
          )}
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
