/**
 * App.tsx — Root navigator
 *
 * Phase 8.1.4: Wrapped in ErrorBoundary for uncaught JS error recovery.
 * Phase 8.1.5: Checks AsyncStorage on mount; starts at Onboarding if first launch.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import { ONBOARDING_KEY } from './screens/OnboardingScreen';

// Screens
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import SendMoneyScreen from './screens/SendMoneyScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';
import TransactionDetailScreen from './screens/TransactionDetailScreen';
import ReceiveMoneyScreen from './screens/ReceiveMoneyScreen';
import ScanQRScreen from './screens/ScanQRScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Home' | null>(null);

  // Phase 8.1.5 — determine first-launch route
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setInitialRoute(val === 'true' ? 'Home' : 'Onboarding');
    });
  }, []);

  // Splash while AsyncStorage loads (instant on device, <20ms)
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    // Phase 8.1.4 — Error Boundary wraps everything
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
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

          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
