import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const colors = {
  bg: '#0B0E11',
  surface: '#14181D',
  border: '#262E37',
  amber: '#F2A900',
  amberDim: '#6B5416',
  text: '#E8EAED',
  textMuted: '#7C858E',
  danger: '#E5484D',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const { t } = useLanguage();

  // Signature element: a status LED echoing the app's own clearance
  // indicator (green/red = access granted/denied) — here repurposed for
  // authentication itself. Breathes amber at rest, speeds up while
  // checking credentials, flashes red on denial.
  const ledOpacity = useRef(new Animated.Value(1)).current;
  const ledColor = useRef(new Animated.Value(0)).current; // 0 = amber, 1 = danger

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ledOpacity, {
          toValue: 0.25,
          duration: loading ? 350 : 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ledOpacity, {
          toValue: 1,
          duration: loading ? 350 : 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading]);

  const flashDenied = () => {
    Animated.sequence([
      Animated.timing(ledColor, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.delay(900),
      Animated.timing(ledColor, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();
  };

  const ledBackgroundColor = ledColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.amber, colors.danger],
  });

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(t('login_missingCreds'));
      flashDenied();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(trimmedEmail, password);
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? t('login_signinFailed'));
      flashDenied();
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !email || !password || loading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.eyebrowRow}>
              <Animated.View style={{ opacity: ledOpacity, marginRight: 8 }}>
                <Animated.View
                  style={[
                    styles.led,
                    { backgroundColor: ledBackgroundColor, marginRight: 0 },
                  ]}
                />
              </Animated.View>
              <Text style={styles.eyebrow}>{t('login_eyebrow')}</Text>
            </View>
            <Text style={styles.title}>{t('login_title')}</Text>
            <Text style={styles.subtitle}>{t('login_subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t('login_badgeEmail')}</Text>
            <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
              <TextInput
                style={[styles.input, styles.mono]}
                placeholder="guard@demo.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>{t('login_password')}</Text>
            <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
              <TextInput
                style={[styles.input, styles.mono]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleSubmit}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{loading ? t('login_verifying') : t('login_signIn')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>{t('login_footer')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  led: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.amber,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  inputWrapperFocused: {
    borderColor: colors.amber,
  },
  input: {
    fontSize: 15,
    color: colors.text,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  error: {
    marginTop: 16,
    fontSize: 13,
    color: colors.danger,
  },
  button: {
    backgroundColor: colors.amber,
    borderRadius: 4,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  buttonDisabled: {
    backgroundColor: colors.amberDim,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#0B0E11',
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
