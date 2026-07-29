import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStyles } from '../styles';
import { useStyles } from '../../theme/useStyles';
import { useTheme } from '../../theme/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoginStackParamList } from '../LoginRoutes';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

type VerifyEmailRouteProp = RouteProp<LoginStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<LoginStackParamList>>();
  const route = useRoute<VerifyEmailRouteProp>();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(getStyles);
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isCodeValid = code.length === 6;

  const handleVerify = async () => {
    if (!isCodeValid) return;
    
    setIsLoading(true);
    try {
      const response = await api.post('/auth/email/verify', { email, code });
      if (response.data.status === 'success') {
        await login(response.data.data.accessToken, response.data.data.refreshToken);
      } else {
        Alert.alert('Error', response.data.message || 'Verification failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
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
        
        <View style={styles.iconWrapper}>
          <Ionicons name="mail-outline" size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>

        <View style={styles.otpContainer}>
          <TextInput
            style={[styles.otpInput, code.length > 0 && styles.otpInputActive]}
            placeholder="000000"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            editable={!isLoading}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, (!isCodeValid || isLoading) && styles.buttonDisabled]} 
          disabled={!isCodeValid || isLoading}
          onPress={handleVerify}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.buttonText, !isCodeValid && styles.buttonTextDisabled]}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
