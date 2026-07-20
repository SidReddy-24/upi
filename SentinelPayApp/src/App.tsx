import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './types';

// Screens
import HomeScreen from './screens/HomeScreen';
import SendMoneyScreen from './screens/SendMoneyScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';
import TransactionDetailScreen from './screens/TransactionDetailScreen';
import ReceiveMoneyScreen from './screens/ReceiveMoneyScreen';
import ScanQRScreen from './screens/ScanQRScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#6366f1' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}>

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
  );
}
