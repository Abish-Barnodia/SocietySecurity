import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Modal, ActivityIndicator, Animated, Easing, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import api from './api';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const colors = {
  primary: '#0f172a',
  primaryLight: '#f1f5f9',
  background: '#f5f3ef',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  borderFocus: '#0f172a',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  success: '#10b981',
  successLight: '#dcfce7',
};

export type Society = {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  address?: string;
};

type LoginScreenProps = {
  allowSignup?: boolean;
  appTitle?: string;
  onForgotPassword?: () => void;
  onGoToRegister?: () => void;
  onBack?: () => void;
};

// ponytail: unified LoginScreen with society chooser, resident-app theme, colors & modern UI card components
export default function LoginScreen({
  allowSignup = true,
  appTitle = 'RESIDENT ACCESS',
  onForgotPassword,
  onGoToRegister,
  onBack,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string } | null>(null);

  // Society selector states
  const [societies, setSocieties] = useState<Society[]>([]);
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [societyModalOpen, setSocietyModalOpen] = useState(false);
  const [societySearch, setSocietySearch] = useState('');
  const [loadingSocieties, setLoadingSocieties] = useState(false);

  const { login, signup } = useAuth();

  const turn = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const fetchSocieties = React.useCallback(() => {
    setLoadingSocieties(true);
    api.get('/auth/societies')
      .then((res) => {
        setSocieties(res.data?.data ?? []);
      })
      .catch((err) => {
        console.warn('Failed to load societies list:', err);
      })
      .finally(() => {
        setLoadingSocieties(false);
      });
  }, []);

  useEffect(() => {
    fetchSocieties();
  }, [fetchSocieties]);

  // When user opens the society modal, always fetch latest societies to pick up newly approved ones instantly
  useEffect(() => {
    if (societyModalOpen) {
      fetchSocieties();
    }
  }, [societyModalOpen, fetchSocieties]);

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
      setAlertInfo({ title: 'Invalid Email', message: 'Please enter a valid email address.' });
      return false;
    }
    if (!password || password.length < 6) {
      setAlertInfo({ title: 'Invalid Password', message: 'Password must be at least 6 characters.' });
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
        await login(trimmedEmail, password, selectedSociety?.id);
      } else {
        await signup(trimmedEmail, password);
      }
    } catch (error: unknown) {
      const message = (error as any)?.response?.data?.message
        ?? (error instanceof Error ? error.message : undefined)
        ?? `Failed to ${mode}. Please check your credentials or server connection.`;
      setAlertInfo({ title: mode === 'login' ? 'Login Failed' : 'Sign Up Failed', message });
      rattle();
    } finally {
      setLoading(false);
    }
  };

  const filteredSocieties = societies.filter((s) => {
    if (!societySearch.trim()) return true;
    const q = societySearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  const isSubmitDisabled = !email || !password || loading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={80}
      >
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}

        {/* Top Branding & Icon */}
        <View style={styles.headerContainer}>
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ rotate: loading ? keyRotation : keyShake }] },
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.text} />
          </Animated.View>
          <View style={styles.eyebrowBadge}>
            <Text style={styles.eyebrow}>{appTitle}</Text>
          </View>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome Back' : 'Join Community'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Sign in to access your apartment gate & community dashboard'
              : 'Sign up with your credentials to get started'}
          </Text>
        </View>

        {/* Input Card Container */}
        <View style={styles.card}>
          {/* SOCIETY PICKER */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>CHOOSE SOCIETY</Text>
              <Text style={styles.optionalBadge}>Optional</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.inputWrapper,
                styles.pickerWrapper,
                !!selectedSociety && styles.inputWrapperFocused,
              ]}
              onPress={() => setSocietyModalOpen(true)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="business-outline"
                size={18}
                color={selectedSociety ? colors.primary : colors.textMuted}
                style={styles.fieldIcon}
              />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                {selectedSociety ? (
                  <View>
                    <Text style={styles.selectedSocietyText} numberOfLines={1}>
                      {selectedSociety.name}
                    </Text>
                    {!!selectedSociety.city && (
                      <Text style={styles.selectedSocietySub} numberOfLines={1}>
                        {selectedSociety.city}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.placeholderText} numberOfLines={1}>
                    {loadingSocieties ? 'Loading societies…' : 'Choose society (Auto-detect if empty)'}
                  </Text>
                )}
              </View>
              {selectedSociety ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedSociety(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* EMAIL ADDRESS */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
              <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? colors.primary : colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor={colors.textMuted}
                placeholder="name@example.com"
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

          {/* PASSWORD */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? colors.primary : colors.textMuted} style={styles.fieldIcon} />
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
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'login' && onForgotPassword && (
            <TouchableOpacity 
              style={styles.forgotPasswordContainer} 
              onPress={onForgotPassword}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Navigation */}
        {allowSignup && (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchModeTextBold}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        )}

        {onGoToRegister && (
          <TouchableOpacity
            style={styles.registerLinkButton}
            onPress={onGoToRegister}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.switchModeText}>
              New resident?{' '}
              <Text style={[styles.switchModeTextBold, { color: colors.primary }]}>
                Register Home / Flat →
              </Text>
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAwareScrollView>

      {/* SOCIETY SELECTION MODAL */}
      <Modal visible={societyModalOpen} transparent animationType="slide" onRequestClose={() => setSocietyModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.societyModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Choose Society</Text>
                <Text style={styles.modalSubtitle}>Select your residential society or apartment complex</Text>
              </View>
              <TouchableOpacity
                onPress={fetchSocieties}
                style={[styles.closeModalBtn, { marginRight: 8 }]}
                disabled={loadingSocieties}
                activeOpacity={0.7}
              >
                {loadingSocieties ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color={colors.text} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSocietyModalOpen(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by society name or city…"
                placeholderTextColor={colors.textMuted}
                value={societySearch}
                onChangeText={setSocietySearch}
                autoCorrect={false}
              />
              {!!societySearch && (
                <TouchableOpacity onPress={() => setSocietySearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Auto-detect / Any Society Option */}
            <TouchableOpacity
              style={[styles.societyItem, !selectedSociety && styles.societyItemSelected]}
              onPress={() => {
                setSelectedSociety(null);
                setSocietyModalOpen(false);
              }}
            >
              <View style={[styles.societyIconBox, !selectedSociety && styles.societyIconBoxActive]}>
                <Ionicons name="sparkles-outline" size={20} color={!selectedSociety ? colors.primary : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.societyItemName, !selectedSociety && styles.societyItemNameActive]}>
                  Auto-detect Society
                </Text>
                <Text style={styles.societyItemSub}>Detects society automatically from your email account</Text>
              </View>
              {!selectedSociety && (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Societies List */}
            {loadingSocieties ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading societies…</Text>
              </View>
            ) : filteredSocieties.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="business-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyText}>No matching societies found</Text>
                <TouchableOpacity
                  style={[styles.outlineBtn, { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 }]}
                  onPress={fetchSocieties}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.outlineBtnText, { fontSize: 13 }]}>Refresh Societies</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredSocieties}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const isSelected = selectedSociety?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.societyItem, isSelected && styles.societyItemSelected]}
                      onPress={() => {
                        setSelectedSociety(item);
                        setSocietyModalOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.societyIconBox, isSelected && styles.societyIconBoxActive]}>
                        <Ionicons name="business" size={20} color={isSelected ? colors.primary : colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.societyItemName, isSelected && styles.societyItemNameActive]}>
                          {item.name}
                        </Text>
                        <Text style={styles.societyItemSub}>
                          {[item.city, item.address].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Themed Alert Modal */}
      <Modal visible={!!alertInfo} transparent animationType="fade" onRequestClose={() => setAlertInfo(null)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertIconCircle}>
              <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
            </View>
            <Text style={styles.alertTitle}>{alertInfo?.title}</Text>
            <Text style={styles.alertMessage}>{alertInfo?.message}</Text>
            <TouchableOpacity style={styles.alertButton} onPress={() => setAlertInfo(null)} activeOpacity={0.8}>
              <Text style={styles.alertButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eyebrowBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  optionalBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
  },
  pickerWrapper: {
    paddingVertical: 4,
  },
  inputWrapperFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.card,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  selectedSocietyText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  selectedSocietySub: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  eyeBtn: {
    padding: 6,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  switchModeButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  registerLinkButton: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  switchModeTextBold: {
    color: colors.text,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  societyModalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  societyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
  },
  societyItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  societyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  societyIconBoxActive: {
    backgroundColor: '#e2e8f0',
  },
  societyItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  societyItemNameActive: {
    color: colors.primary,
  },
  societyItemSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },

  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 18,
    textAlign: 'center',
  },
  alertButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  alertButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
