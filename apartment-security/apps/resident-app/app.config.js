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
      '@react-native-google-signin/google-signin',
    ],
    extra: {
      // Override via API_URL env var — never hardcode an IP here for prod, but we'll use local IP for dev
      apiUrl: process.env.API_URL ?? 'http://192.168.1.9:5000/api/v1',
    },
  },
};
