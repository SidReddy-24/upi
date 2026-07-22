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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Home' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setInitialRoute(val === 'true' ? 'Home' : 'Onboarding');
    });
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

            </Stack.Navigator>
            <PanicButton />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
