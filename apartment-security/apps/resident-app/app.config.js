/**
 * app.config.js — Expo dynamic config.
 * Set API_URL in your .env file (or shell env) before running.
 * e.g.:  API_URL=http://192.168.1.9:3000/api/v1 npx expo start
 * Defaults to localhost for emulator/simulator dev.
 */
module.exports = {
  expo: {
    name: 'resident-app-temp',
    slug: 'resident-app-temp',
    newArchEnabled: false,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: 'com.anonymous.residentapptemp',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      '@react-native-community/datetimepicker',
      'expo-secure-store',
      'expo-audio',
      'expo-video',
      // Ensures Android permissions/manifest wiring for remote push and
      // background notification handling (visitor-approval ringing) are
      // properly configured — was relying on autolinking defaults before.
      [
        'expo-notifications',
        {
          sounds: ['./assets/visitor_ring.wav']
        }
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          // Matches the light theme's background (src/theme/colors.ts) —
          // userInterfaceStyle is fixed to 'light', so no dark variant needed.
          backgroundColor: '#FFFDF9',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "24c26ebe-dbf8-4b78-9dfa-57e1baca27d0"
      },
      // Override via API_URL env var — never hardcode an IP here.
      // Left undefined when unset so src/utils/api.ts can derive the right
      // host per-platform from the Metro debugger host (works for physical
      // devices and simulators, not just the Android emulator loopback).
      apiUrl: process.env.API_URL,
    },
  },
};
