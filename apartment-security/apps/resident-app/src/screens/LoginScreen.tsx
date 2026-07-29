import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

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
    } catch (error: any) {
      const message = error.response?.data?.message ?? `Failed to ${mode}. Please check your credentials or server connection.`;
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Sign Up Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !email || !password || loading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>🏠</Text>
          </View>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Sign in with your email and password to access\nyour account.'
              : 'Sign up with your email to get started as a resident.'}
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
                placeholder="resident@example.com"
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
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

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
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    marginBottom: 24,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
