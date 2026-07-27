/**
 * App.tsx — Root navigator
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import PanicButton from './components/PanicButton';
import { ONBOARDING_KEY } from './screens/OnboardingScreen';
import { getUser, receivePayment } from './utils/walletDb';

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
import GuardianManagementScreen from './screens/GuardianManagementScreen';
import GuardianApprovalScreen from './screens/GuardianApprovalScreen';
import GuardianVerificationScreen from './screens/GuardianVerificationScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import AiRiskHistoryScreen from './screens/AiRiskHistoryScreen';
import DeviceTrustScreen from './screens/DeviceTrustScreen';
import AdminAnalyticsDashboardScreen from './screens/AdminAnalyticsDashboardScreen';
import { authService } from './services/authService';
import unifiedAuthService from './services/unifiedAuthService';
import { notificationService } from './services/notificationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

import HeadsUpNotificationBanner from './components/HeadsUpNotificationBanner';
import guardianService from './services/guardianService';

export default function App(): React.JSX.Element {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    notificationService.configure();
    notificationService.requestPermissions();
    guardianService.initialize();

    const unsubscribeWs = guardianService.subscribe((event: any) => {
      const type = event.type;
      const data = event.data || {};

      if (type === 'GUARDIAN_INVITATION') {
        notificationService.addNotification({
          title: '🛡️ New Guardian Request',
          body: `${data.ward_name || data.ward_phone || 'Someone'} wants to add you as their Guardian.`,
          type: 'GUARDIAN_INVITATION',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'GUARDIAN_INVITATION_APPROVED') {
        notificationService.addNotification({
          title: '✅ Guardian Accepted',
          body: `${data.guardian_name || 'Your Guardian'} accepted your request! Code: ${data.code || 'shown on screen'}`,
          type: 'GUARDIAN_APPROVED',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'GUARDIAN_INVITATION_REJECTED') {
        notificationService.addNotification({
          title: '🚫 Guardian Request Declined',
          body: `${data.guardian_name || 'Your Guardian'} declined your Guardian request.`,
          type: 'GUARDIAN_REJECTED',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'GUARDIAN_CODE_READY' || type === 'GUARDIAN_VERIFICATION_CODE') {
        notificationService.addNotification({
          title: '🔑 Verification Code Ready',
          body: `${data.inviter_name || 'Ward'} generated verification code: ${data.code || 'Open Guardian app'}`,
          type: 'GUARDIAN_CODE_READY',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'GUARDIAN_LINKED') {
        notificationService.addNotification({
          title: '🛡️ Guardian Protection Enabled',
          body: `Guardian relationship with ${data.ward_name || data.guardian_name || 'user'} is now active.`,
          type: 'GUARDIAN_LINKED',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'GUARDIAN_EXPIRED') {
        notificationService.addNotification({
          title: '⏰ Guardian Request Expired',
          body: 'The Guardian request has expired.',
          type: 'GUARDIAN_EXPIRED',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'GUARDIAN_CANCELLED') {
        notificationService.addNotification({
          title: '❌ Guardian Request Cancelled',
          body: 'This request has been cancelled by the Ward.',
          type: 'GUARDIAN_CANCELLED',
          relationship_id: data.relationship_id,
        });
      } else if (type === 'PAYMENT_RECEIVED') {
        const { amount, sender_vpa, sender_name, transaction_id, receiver_vpa } = data;
        const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
        
        getUser().then(user => {
          if (user && user.vpa === receiver_vpa) {
            const formattedAmount = parsedAmount.toLocaleString('en-IN');
            const senderLabel = sender_name || sender_vpa || 'Someone';
            const refId = transaction_id || `SP${Date.now()}`;

            receivePayment(sender_vpa || 'sender@sentinelpay', parsedAmount, refId);

            notificationService.addNotification({
              title: '💰 Payment Received!',
              body: `Received ₹${formattedAmount} from ${senderLabel} (${sender_vpa}). Ref: ${refId}`,
              type: 'PAYMENT_RECEIVED',
              transaction_id: refId,
            });
          }
        });
      } else if (type === 'PAYMENT_SENT') {
        const { amount, receiver_vpa, receiver_name, transaction_id, sender_vpa } = data;
        const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
        
        getUser().then(user => {
          if (user && user.vpa === sender_vpa) {
            const formattedAmount = parsedAmount.toLocaleString('en-IN');
            const receiverLabel = receiver_name || receiver_vpa || 'Someone';
            const refId = transaction_id || `SP${Date.now()}`;

            notificationService.addNotification({
              title: '💸 Payment Sent!',
              body: `Sent ₹${formattedAmount} to ${receiverLabel} (${receiver_vpa}). Ref: ${refId}`,
              type: 'PAYMENT_SENT',
              transaction_id: refId,
            });
          }
        });
      }
    });

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


      // Mandatory phone auth if not logged in
      setInitialRoute('PhoneAuth');
    };
    checkState();

    return () => {
      unsubscribeWs();
      guardianService.cleanup();
    };
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
        <HeadsUpNotificationBanner />
        <NavigationContainer>
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                animation: 'slide_from_right',
                animationDuration: 250,
                headerStyle: { backgroundColor: '#FAF7F0' },
                headerTintColor: '#1A1A2E',
                headerTitleStyle: { fontWeight: '800' },
                headerShadowVisible: false,
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
              <Stack.Screen
                name="GuardianManagement"
                component={GuardianManagementScreen}
                options={{ title: 'Manage Guardians' }}
              />
              <Stack.Screen
                name="GuardianApproval"
                component={GuardianApprovalScreen}
                options={{ title: 'Pending Approvals' }}
              />
              <Stack.Screen
                name="GuardianVerification"
                component={GuardianVerificationScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="AiRiskHistory"
                component={AiRiskHistoryScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="DeviceTrust"
                component={DeviceTrustScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="AdminAnalytics"
                component={AdminAnalyticsDashboardScreen}
                options={{ headerShown: false }}
              />

            </Stack.Navigator>
            <PanicButton />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
