import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import ThemedAlertModal from '../../components/ThemedAlertModal';
import { validatePassword } from '../../utils/passwordValidation';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'code' | 'password' | 'confirm' | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; onDismiss?: () => void } | null>(null);

  const pwCheck = validatePassword(password);

  const handleRequestOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setAlertInfo({ title: 'Invalid Email', message: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: trimmedEmail });

      setStep('reset');
      setAlertInfo({ title: 'Code Sent', message: response.data?.message || 'Check your email for the reset code.' });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to request password reset. Please try again.';
      setAlertInfo({ title: 'Error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (code.length !== 6) {
      setAlertInfo({ title: 'Invalid Code', message: 'Please enter the 6-digit reset code.' });
      return;
    }
    if (!pwCheck.isValid) {
      setAlertInfo({ title: 'Standard Password Required', message: pwCheck.errorMessage || 'Password must meet all complexity requirements.' });
      return;
    }
    if (password !== confirmPassword) {
      setAlertInfo({ title: 'Password Mismatch', message: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code, password });

      setAlertInfo({
        title: 'Success',
        message: 'Your password has been successfully reset. You can now login.',
        onDismiss: () => navigation.navigate('Login'),
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reset password. Please check your code and try again.';
      setAlertInfo({ title: 'Error', message });
    } finally {
      setLoading(false);
    }
  };

  const isResetDisabled = loading || (step === 'email' && !email.trim()) || (step === 'reset' && (!code || !password || !confirmPassword || !pwCheck.isValid || password !== confirmPassword));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={30} color="#00A67C" />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {step === 'email' 
                ? 'Enter your registered email address to receive your 6-digit verification code.'
                : 'Enter the 6-digit code sent to your email and choose a strong new password.'}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {step === 'email' ? (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
                  <Ionicons name="mail-outline" size={20} color={focusedField === 'email' ? '#00A67C' : colors.textMuted} style={styles.inputIcon} />
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
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>6-Digit Verification Code</Text>
                  <View style={[styles.inputWrapper, focusedField === 'code' && styles.inputWrapperFocused]}>
                    <Ionicons name="key-outline" size={20} color={focusedField === 'code' ? '#00A67C' : colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { letterSpacing: 4, fontWeight: '700' }]}
                      placeholderTextColor={colors.textMuted}
                      placeholder="123456"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={setCode}
                      onFocus={() => setFocusedField('code')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={focusedField === 'password' ? '#00A67C' : colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholderTextColor={colors.textMuted}
                      placeholder="Min 8 chars with uppercase, number & symbol"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Real-time Password Standards Checklist */}
                  {password.length > 0 && (
                    <View style={styles.requirementsBox}>
                      <Text style={styles.reqTitle}>Password requirements:</Text>
                      <View style={styles.reqRow}>
                        <Ionicons name={pwCheck.hasMinLength ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwCheck.hasMinLength ? "#10B981" : colors.textMuted} />
                        <Text style={[styles.reqText, pwCheck.hasMinLength && styles.reqTextActive]}>At least 8 characters</Text>
                      </View>
                      <View style={styles.reqRow}>
                        <Ionicons name={pwCheck.hasUpper ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwCheck.hasUpper ? "#10B981" : colors.textMuted} />
                        <Text style={[styles.reqText, pwCheck.hasUpper && styles.reqTextActive]}>1 uppercase letter (A-Z)</Text>
                      </View>
                      <View style={styles.reqRow}>
                        <Ionicons name={pwCheck.hasNumber ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwCheck.hasNumber ? "#10B981" : colors.textMuted} />
                        <Text style={[styles.reqText, pwCheck.hasNumber && styles.reqTextActive]}>1 number (0-9)</Text>
                      </View>
                      <View style={styles.reqRow}>
                        <Ionicons name={pwCheck.hasSpecial ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwCheck.hasSpecial ? "#10B981" : colors.textMuted} />
                        <Text style={[styles.reqText, pwCheck.hasSpecial && styles.reqTextActive]}>1 special character (!@#$%^&*)</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={[styles.inputWrapper, focusedField === 'confirm' && styles.inputWrapperFocused]}>
                    <Ionicons name="lock-closed-outline" size={20} color={focusedField === 'confirm' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholderTextColor={colors.textMuted}
                      placeholder="Repeat your new password"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <Text style={styles.errorHint}>Passwords do not match</Text>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                isResetDisabled && styles.buttonDisabled
              ]}
              onPress={step === 'email' ? handleRequestOtp : handleResetPassword}
              disabled={isResetDisabled}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>
                  {step === 'email' ? 'Send Reset Code' : 'Reset Password'}
                </Text>
              )}
            </TouchableOpacity>

            {step === 'reset' && (
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleRequestOtp}
                disabled={loading}
              >
                <Text style={styles.resendText}>
                  Didn't receive a code? <Text style={styles.resendTextBold}>Resend Code</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ThemedAlertModal
        visible={!!alertInfo}
        title={alertInfo?.title ?? ''}
        message={alertInfo?.message ?? ''}
        onClose={() => {
          const onDismiss = alertInfo?.onDismiss;
          setAlertInfo(null);
          onDismiss?.();
        }}
      />
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(0, 166, 124, 0.15)' : '#ecfdf5',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(0, 166, 124, 0.3)' : '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  formContainer: {
    width: '100%',
  },
  formGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: '#00A67C',
    backgroundColor: colors.card,
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  eyeBtn: {
    padding: 6,
  },
  requirementsBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  reqTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reqText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  reqTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  errorHint: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#00A67C',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#00A67C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.35 : 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: isDark ? '#334155' : '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resendTextBold: {
    color: '#00A67C',
    fontWeight: '700',
  },
});
