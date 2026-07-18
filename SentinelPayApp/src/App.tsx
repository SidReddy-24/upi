import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// Screens
import HomeScreen from './screens/HomeScreen';
import SendMoneyScreen from './screens/SendMoneyScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';

export type RootStackParamList = {
  Home: undefined;
  SendMoney: undefined;
  TransactionHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#6366f1',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{title: 'SentinelPay Wallet'}}
          />
          <Stack.Screen
            name="SendMoney"
            component={SendMoneyScreen}
            options={{title: 'Send Money'}}
          />
          <Stack.Screen
            name="TransactionHistory"
            component={TransactionHistoryScreen}
            options={{title: 'Transaction History'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
