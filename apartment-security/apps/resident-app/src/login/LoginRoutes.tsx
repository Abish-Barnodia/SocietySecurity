import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import CreateProfileScreen from './screens/CreateProfileScreen';

export type LoginStackParamList = {
  Login: undefined;
  SignUp: undefined;
  VerifyEmail: { email: string };
  CreateProfile: undefined;
};

const Stack = createNativeStackNavigator<LoginStackParamList>();

export default function LoginRoutes() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
    </Stack.Navigator>
  );
}
