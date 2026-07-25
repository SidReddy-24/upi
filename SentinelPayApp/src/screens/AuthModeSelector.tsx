import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthModeSelector'>;

export default function AuthModeSelector({ navigation }: Props): React.JSX.Element {
  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView style={DS.screen} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={DS.authBrand}>
          <View style={DS.authBrandIcon}>
            <AppIcon name="shield" size={28} color="#FFFFFF" />
          </View>
          <Text style={DS.authBrandTitle}>SentinelPay AI</Text>
          <Text style={DS.authBrandSub}>CHOOSE AUTHENTICATION METHOD</Text>
        </View>

        {/* Authentication Options */}
        <View style={{ gap: S.md }}>
          {/* Phone OTP */}
          <TouchableOpacity
            style={DS.rowCard}
            onPress={() => navigation.navigate('PhoneAuth', { useMock: true })}
            activeOpacity={0.7}>
            <View style={[DS.iconMd, { backgroundColor: C.blueBg }]}>
              <AppIcon name="phone" size={22} color={C.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Phone + OTP</Text>
              <Text style={DS.cardSub}>One-time password via mobile SMS</Text>
              <View style={[DS.pillBadge, { backgroundColor: C.surfaceAlt, alignSelf: 'flex-start', marginTop: S.xs }]}>
                <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.textSecondary }}>MOCK MODE ACTIVE</Text>
              </View>
            </View>
            <AppIcon name="chevronRight" size={18} color={C.textTertiary} />
          </TouchableOpacity>

          {/* PIN + Biometric */}
          <TouchableOpacity
            style={DS.rowCard}
            onPress={() => navigation.navigate('PinSetup')}
            activeOpacity={0.7}>
            <View style={[DS.iconMd, { backgroundColor: C.greenBg }]}>
              <AppIcon name="lock" size={22} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>PIN + Biometrics</Text>
              <Text style={DS.cardSub}>Secure PIN with fingerprint/face ID</Text>
              <View style={[DS.pillBadge, { backgroundColor: C.greenBg, alignSelf: 'flex-start', marginTop: S.xs }]}>
                <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>RECOMMENDED</Text>
              </View>
            </View>
            <AppIcon name="chevronRight" size={18} color={C.textTertiary} />
          </TouchableOpacity>

          {/* Google Sign-In (Coming Soon) */}
          <TouchableOpacity
            style={[DS.rowCard, { opacity: 0.6 }]}
            disabled>
            <View style={[DS.iconMd, { backgroundColor: C.surfaceAlt }]}>
              <AppIcon name="profile" size={22} color={C.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[DS.cardTitle, { color: C.textTertiary }]}>Google Sign-In</Text>
              <Text style={DS.cardSub}>Sign in with Google account</Text>
              <View style={[DS.pillBadge, { backgroundColor: C.surfaceAlt, alignSelf: 'flex-start', marginTop: S.xs }]}>
                <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.textTertiary }}>COMING SOON</Text>
              </View>
            </View>
            <AppIcon name="chevronRight" size={18} color={C.border} />
          </TouchableOpacity>
        </View>

        {/* Existing Account */}
        <View style={styles.footer}>
          <Text style={{ fontSize: T.body, color: C.textSecondary }}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
            <Text style={DS.seeAll}>Sign in with Password →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: S.base,
    paddingBottom: S.xxl,
  },
  footer: {
    marginTop: S.xxl,
    alignItems: 'center',
    gap: S.xs,
  },
});
