import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Alert, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const colors = {
  primary: '#1e40af',
  primaryLight: '#eff6ff',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  success: '#22c55e',
};

type LoginScreenProps = {
  allowSignup?: boolean;
  appTitle?: string;
  onForgotPassword?: () => void;
};

export default function LoginScreen({ allowSignup = true, appTitle = "RESIDENT ACCESS", onForgotPassword }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { login, signup } = useAuth();

  const turn = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      turn.setValue(0);
      Animated.loop(
        Animated.timing(turn, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        })
      ).start();
    } else {
      turn.stopAnimation(() => turn.setValue(0));
    }
  }, [loading, turn]);

  const rattle = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const keyRotation = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '75deg'] });
  const keyShake = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });

  const validateForm = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    if (!password || password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      if (mode === 'login') {
        await login(trimmedEmail, password);
      } else {
        await signup(trimmedEmail, password);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (error as any)?.response?.data?.message ?? `Failed to ${mode}. Please check your credentials or server connection.`;
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Sign Up Failed', message);
      rattle();
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !email || !password || loading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={'dark-content'} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={80}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ rotate: loading ? keyRotation : keyShake }] },
            ]}
          >
            <Ionicons name="key-outline" size={30} color={colors.primary} />
          </Animated.View>
          <Text style={styles.eyebrow}>{appTitle}</Text>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome' : 'Join your community'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Sign in with your email and password to access\nyour account.'
              : 'Sign up with your email to get started.'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
              <TextInput
                style={styles.input}
                placeholderTextColor={colors.textMuted}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
              <TextInput
                style={styles.input}
                placeholderTextColor={colors.textMuted}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'login' && onForgotPassword && (
            <TouchableOpacity 
              style={styles.forgotPasswordContainer} 
              onPress={onForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          {allowSignup && (
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
              disabled={loading}
            >
              <Text style={styles.switchModeText}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.switchModeTextBold}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.primary,
    marginBottom: 10,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 30,
    fontWeight: Platform.OS === 'ios' ? '700' : 'normal',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
  },
  formGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#EBE3DB',
  },
  buttonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  switchModeButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchModeText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  switchModeTextBold: {
    color: colors.primary,
    fontWeight: '700',
  },
});
