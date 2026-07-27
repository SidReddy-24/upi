/**
 * MoreScreen — Secondary navigation hub for the ☰ More bottom tab.
 * Contains Guardian & Safety, Profile, Security, Settings, Insights, Community, Help.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletUser } from '../types';
import { getUser } from '../utils/walletDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'More'> };

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  label: string;
  sub: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
}

export default function MoreScreen({ navigation }: Props) {
  const [user, setUser] = useState<WalletUser | null>(null);

  useFocusEffect(useCallback(() => {
    getUser().then(u => setUser(u));
  }, []));

  const sections: MenuSection[] = [
    {
      title: 'Guardian & Safety',
      items: [
        {
          label: 'Guardian Management',
          sub: 'Manage trusted contacts & approval rules',
          icon: 'guardian',
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          badge: 'SECURITY',
          badgeColor: '#2563EB',
          badgeBg: '#EFF6FF',
          onPress: () => navigation.navigate('GuardianManagement'),
        },
        {
          label: 'Pending Approvals',
          sub: 'Review Guardian approval requests',
          icon: 'bell',
          iconColor: '#D97706',
          iconBg: '#FFFBEB',
          onPress: () => navigation.navigate('GuardianApproval'),
        },
        {
          label: 'Guardian Verification',
          sub: 'Complete pending verification flows',
          icon: 'shieldCheck',
          iconColor: '#10B981',
          iconBg: '#ECFDF5',
          onPress: () => navigation.navigate('GuardianVerification', undefined),
        },
      ],
    },
    {
      title: 'Analytics & Insights',
      items: [
        {
          label: 'Ops Analytics Dashboard',
          sub: 'System throughput & fraud scoring metrics',
          icon: 'barChart2',
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          onPress: () => navigation.navigate('AdminAnalytics'),
        },
        {
          label: 'AI Risk History',
          sub: 'Past ML decisions & explanations',
          icon: 'cpu',
          iconColor: '#10B981',
          iconBg: '#ECFDF5',
          onPress: () => navigation.navigate('AiRiskHistory'),
        },
      ],
    },
    {
      title: 'Community',
      items: [
        {
          label: 'Report Fraud / Scam',
          sub: 'File complaint & protect the community',
          icon: 'report',
          iconColor: '#EF4444',
          iconBg: '#FEF2F2',
          onPress: () => navigation.navigate('ReportScam', undefined),
        },
        {
          label: 'Threat HeatMap',
          sub: 'Geographic fraud radar across India',
          icon: 'heatmap',
          iconColor: '#EF4444',
          iconBg: '#FEF2F2',
          onPress: () => navigation.navigate('ScamHeatMap'),
        },
        {
          label: 'Scam Passport Lookup',
          sub: 'Verify reputation of VPAs & numbers',
          icon: 'search',
          iconColor: '#D97706',
          iconBg: '#FFFBEB',
          onPress: () => navigation.navigate('ScamPassport', {}),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Profile',
          sub: 'Personal information & linked accounts',
          icon: 'profile',
          iconColor: '#0F172A',
          iconBg: '#F1F5F9',
          onPress: () => navigation.navigate('Profile'),
        },
        {
          label: 'Security',
          sub: 'Biometrics, PIN, device trust & sessions',
          icon: 'lock',
          iconColor: '#7C3AED',
          iconBg: '#F5F3FF',
          onPress: () => navigation.navigate('BiometricSetup'),
        },
        {
          label: 'Device Trust',
          sub: 'Hardware integrity & attestation',
          icon: 'shieldCheck',
          iconColor: '#059669',
          iconBg: '#ECFDF5',
          onPress: () => navigation.navigate('DeviceTrust'),
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          label: 'Settings',
          sub: 'Preferences, notifications & reset options',
          icon: 'settings',
          iconColor: '#64748B',
          iconBg: '#F1F5F9',
          onPress: () => navigation.navigate('Settings'),
        },
        {
          label: 'Help & Support',
          sub: 'FAQ, contact support & feedback',
          icon: 'info',
          iconColor: '#0EA5E9',
          iconBg: '#F0F9FF',
          onPress: () => Alert.alert('Help & Support', 'Contact us at support@sentinelpay.in\n\nFAQ and documentation coming soon.'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={DS.headerBar}>
        <View>
          <Text style={[DS.label, { color: C.green }]}>SENTINELPAY</Text>
          <Text style={DS.pageTitle}>More</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[DS.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Identity Card */}
        {user && (
          <TouchableOpacity style={DS.cardLg} onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <View style={[DS.iconLg, { backgroundColor: C.dark }]}>
                <Text style={{ fontSize: T.xl, fontWeight: T.black, color: '#FFFFFF' }}>
                  {(user.name || 'S')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: T.lg, fontWeight: T.bold, color: C.textPrimary }}>{user.name || 'Sentinel User'}</Text>
                <Text style={{ fontSize: T.sm, color: C.textSecondary, marginTop: 2 }}>{user.vpa || ''}</Text>
                {user.phone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <AppIcon name="phone" size={12} color={C.textTertiary} />
                    <Text style={{ fontSize: T.xs, color: C.textTertiary }}>{user.phone}</Text>
                  </View>
                )}
              </View>
              <AppIcon name="chevronRight" size={16} color={C.textTertiary} />
            </View>
            <View style={[DS.pillBadge, { backgroundColor: C.greenBg, marginTop: S.sm, alignSelf: 'flex-start' }]}>
              <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>✓ VERIFIED SENTINEL ACCOUNT</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Menu Sections */}
        {sections.map(section => (
          <View key={section.title}>
            <Text style={[DS.sectionTitle, { marginTop: S.sm }]}>{section.title}</Text>
            <View style={DS.card}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    DS.infoCard,
                    {
                      backgroundColor: 'transparent',
                      borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: C.border,
                      borderRadius: 0,
                      paddingHorizontal: 0,
                      marginHorizontal: 0,
                    },
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[DS.iconMd, { backgroundColor: item.iconBg }]}>
                    <AppIcon name={item.icon} size={18} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                      <Text style={DS.cardTitle}>{item.label}</Text>
                      {item.badge && (
                        <View style={[DS.pillBadge, { backgroundColor: item.badgeBg || C.greenBg, paddingHorizontal: 5, paddingVertical: 1 }]}>
                          <Text style={{ fontSize: 8, fontWeight: T.extrabold, color: item.badgeColor || C.green }}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[DS.cardSub, { marginTop: 1 }]}>{item.sub}</Text>
                  </View>
                  <AppIcon name="chevronRight" size={16} color={C.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* App Version */}
        <Text style={{ textAlign: 'center', fontSize: T.xs, color: C.textTertiary, marginTop: S.lg, marginBottom: S.sm }}>
          SentinelPay v2.0 · AI Cybersecurity Wallet
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
