import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStyles } from '../styles';
import { useStyles } from '../../theme/useStyles';
import { useTheme } from '../../theme/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoginStackParamList } from '../LoginRoutes';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Constants from 'expo-constants';


export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<LoginStackParamList>>();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(getStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);



  const isFormValid = email.length > 5 && password.length >= 1;

  const handleEmailLogin = async () => {
    if (!isFormValid) return;
    
    setIsLoading(true);
    try {
      const response = await api.post('/auth/email/login', { email, password });
      if (response.data.status === 'success') {
        await login(response.data.data.accessToken, response.data.data.refreshToken);
      } else {
        Alert.alert('Error', response.data.message || 'Login failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.contentContainer}>
        
        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to manage your community access</Text>

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
            placeholder="Enter your password"
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
          onPress={handleEmailLogin}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.buttonText, !isFormValid && styles.buttonTextDisabled]}>Sign In</Text>
          )}
        </TouchableOpacity>



        <View style={styles.bottomTextContainer}>
          <Text style={styles.bottomText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
            <Text style={styles.linkText}>Sign Up</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
