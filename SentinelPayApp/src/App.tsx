/**
 * App.tsx — Root navigator
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import PanicButton from './components/PanicButton';
import { ONBOARDING_KEY } from './screens/OnboardingScreen';
import { getUser } from './utils/walletDb';



// Screens
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import SendMoneyScreen from './screens/SendMoneyScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';
import TransactionDetailScreen from './screens/TransactionDetailScreen';
import ReceiveMoneyScreen from './screens/ReceiveMoneyScreen';
import ScanQRScreen from './screens/ScanQRScreen';
import ReportScamScreen from './screens/ReportScamScreen';
import ScamPassportScreen from './screens/ScamPassportScreen';
import ScamAssistantScreen from './screens/ScamAssistantScreen';
import ScamHeatMapScreen from './screens/ScamHeatMapScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import SmsTrackerScreen from './screens/SmsTrackerScreen';
import SmsDetailScreen from './screens/SmsDetailScreen';
import AuthModeSelector from './screens/AuthModeSelector';
import PhoneAuthScreen from './screens/PhoneAuthScreen';
import PinSetupScreen from './screens/PinSetupScreen';
import PinLoginScreen from './screens/PinLoginScreen';
import BiometricSetupScreen from './screens/BiometricSetupScreen';
import { authService } from './services/authService';
import unifiedAuthService from './services/unifiedAuthService';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    const checkState = async () => {
      // Check if user has completed onboarding
      const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (onboarded !== 'true') {
        setInitialRoute('Onboarding');
        return;
      }

      // Check if user is authenticated with unified auth service and has valid profile
      const isAuth = await unifiedAuthService.isAuthenticated();
      const user = await getUser();
      if (isAuth && user) {
        setInitialRoute('Home');
        return;
      }


      // Check which auth mode was previously set
      const authMode = await unifiedAuthService.getAuthMode();
      if (authMode === 'pin_biometric') {
        // User has PIN set up, go to PIN login
        setInitialRoute('PinLogin');
      } else {
        // No auth mode set, show mode selector
        setInitialRoute('AuthModeSelector');
      }
    };
    checkState();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerStyle: { backgroundColor: '#6366f1' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
              }}>

              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'SentinelPay Wallet' }}
              />
              <Stack.Screen
                name="SendMoney"
                component={SendMoneyScreen}
                options={{ title: 'Send Money' }}
              />
              <Stack.Screen
                name="TransactionHistory"
                component={TransactionHistoryScreen}
                options={{ title: 'Transaction History' }}
              />
              <Stack.Screen
                name="TransactionDetail"
                component={TransactionDetailScreen}
                options={{ title: 'Transaction Detail' }}
              />
              <Stack.Screen
                name="ReceiveMoney"
                component={ReceiveMoneyScreen}
                options={{ title: 'Receive Money' }}
              />
              <Stack.Screen
                name="ScanQR"
                component={ScanQRScreen}
                options={{ title: 'Scan QR', headerShown: false }}
              />
              <Stack.Screen
                name="ReportScam"
                component={ReportScamScreen}
                options={{ title: 'Report Fraud / Scam' }}
              />
              <Stack.Screen
                name="ScamPassport"
                component={ScamPassportScreen}
                options={{ title: 'Entity Scam Passport' }}
              />
              <Stack.Screen
                name="ScamAssistant"
                component={ScamAssistantScreen}
                options={{ title: 'AI Scam Assistant' }}
              />
              <Stack.Screen
                name="ScamHeatMap"
                component={ScamHeatMapScreen}
                options={{ title: 'Scam Threat Heatmap' }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'User Profile & Security' }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings & Preferences' }}
              />
              <Stack.Screen
                name="SmsTracker"
                component={SmsTrackerScreen}
                options={{ title: 'SMS Fraud Tracker' }}
              />
              <Stack.Screen
                name="SmsDetail"
                component={SmsDetailScreen}
                options={{ title: 'SMS Details' }}
              />
              <Stack.Screen
                name="AuthModeSelector"
                component={AuthModeSelector}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="PhoneAuth"
                component={PhoneAuthScreen}
                options={{ title: 'Phone Authentication' }}
              />
              <Stack.Screen
                name="PinSetup"
                component={PinSetupScreen}
                options={{ title: 'Setup PIN' }}
              />
              <Stack.Screen
                name="PinLogin"
                component={PinLoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="BiometricSetup"
                component={BiometricSetupScreen}
                options={{ title: 'Enable Biometric' }}
              />

            </Stack.Navigator>
            <PanicButton />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
