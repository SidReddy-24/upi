import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScamHeatMap'>;
};

const MAP_HEIGHT = 320;

const CITY_COORDS: Record<string, [number, number]> = {
  Mewat: [28.1000, 77.0000],
  Jamtara: [23.9628, 86.8025],
  Cyberabad: [17.3850, 78.4867],
  Noida: [28.5355, 77.3910],
  Bengaluru: [12.9716, 77.5946],
  Mumbai: [19.0760, 72.8777],
  Kolkata: [22.5726, 88.3639],
  Delhi: [28.6139, 77.2090],
};

export default function ScamHeatMapScreen({ navigation }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  useEffect(() => {
    fraudShieldApi.getScamHeatmap().then(res => {
      setData(res);
      setLoading(false);
      if (res?.hotspots?.length > 0) {
        setSelectedCity(res.hotspots[0].city);
      }
    }).catch((err) => {
      console.warn('[ScamHeatMapScreen] API call fallback:', err);
      const fallbackData = {
        total_active_hotspots: 4,
        national_fraud_wave_alert: true,
        hotspots: [
          { city: 'Jamtara', state: 'Jharkhand', risk_level: 'CRITICAL', active_cases: 342, top_scam_type: 'Fake KYC / Banking', fraud_trend_pct: 14.2 },
          { city: 'Mewat', state: 'Haryana', risk_level: 'HIGH', active_cases: 219, top_scam_type: 'Digital Arrest Scam', fraud_trend_pct: 8.5 },
          { city: 'Bengaluru', state: 'Karnataka', risk_level: 'MEDIUM', active_cases: 184, top_scam_type: 'Investment / Telegram', fraud_trend_pct: -3.1 },
          { city: 'Delhi', state: 'Delhi NCR', risk_level: 'HIGH', active_cases: 290, top_scam_type: 'Courier / Drugs Scam', fraud_trend_pct: 11.0 },
        ],
      };
      setData(fallbackData);
      setSelectedCity('Jamtara');
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      </SafeAreaView>
    );
  }

  const selectedHotspot = data.hotspots.find((h: any) => h.city === selectedCity) || data.hotspots[0];

  const generateLeafletHtml = () => {
    const hotspotsJson = JSON.stringify(
      data.hotspots.map((item: any) => ({
        ...item,
        coords: CITY_COORDS[item.city] || [20.5937, 78.9629],
      }))
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background: #0F172A; }
          #map { width: 100%; height: 100vh; background: #0F172A; }
          .leaflet-container { background: #0F172A !important; }
          .leaflet-popup-content-wrapper {
            background: #0F172A;
            color: #F8FAFC;
            border-radius: 12px;
            border: 1px solid #334155;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .leaflet-popup-tip { background: #0F172A; }
          .popup-title { font-weight: 800; font-size: 14px; margin-bottom: 4px; color: #F8FAFC; }
          .popup-desc { font-size: 11px; color: #94A3B8; margin-top: 2px; }
          .popup-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; color: #fff; margin-top: 4px; }
          .badge-crit { background: #EF4444; }
          .badge-high { background: #F59E0B; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { zoomControl: false }).setView([22.5937, 78.9629], 4.5);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          const hotspots = ${hotspotsJson};

          hotspots.forEach(item => {
            const isCrit = item.risk_level === 'CRITICAL';
            const color = isCrit ? '#EF4444' : '#F59E0B';
            const fillColor = isCrit ? '#EF4444' : '#F59E0B';

            L.circleMarker(item.coords, {
              radius: isCrit ? 22 : 16,
              color: color,
              fillColor: fillColor,
              fillOpacity: 0.2,
              weight: 1
            }).addTo(map);

            const marker = L.circleMarker(item.coords, {
              radius: isCrit ? 12 : 8,
              color: '#FFFFFF',
              fillColor: fillColor,
              fillOpacity: 0.85,
              weight: 2
            }).addTo(map);

            const popupContent = \`
              <div class="popup-title">\${item.city}, \${item.state}</div>
              <div class="popup-desc">Vector: \${item.top_scam_type}</div>
              <div class="popup-desc">Active Cases: \${item.active_cases}</div>
              <span class="popup-badge \${isCrit ? 'badge-crit' : 'badge-high'}">\${item.risk_level}</span>
            \`;

            marker.bindPopup(popupContent);

            marker.on('click', () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_CITY', city: item.city }));
            });
          });
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SELECT_CITY') {
        setSelectedCity(msg.city);
      }
    } catch (e) {
      console.warn('WebView message parse error:', e);
    }
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Scam Threat HeatMap</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent}>
        {data.national_fraud_wave_alert && (
          <View style={[DS.infoCard, { backgroundColor: C.redBg, marginBottom: S.md }]}>
            <AppIcon name="alert" size={18} color={C.red} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.red }}>ACTIVE FRAUD WAVE ALERT</Text>
              <Text style={{ fontSize: T.xs, color: C.red }}>Spike in Digital Arrest & Telegram job scams detected.</Text>
            </View>
          </View>
        )}

        {/* Leaflet OpenStreetMap View */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
            <AppIcon name="heatmap" size={18} color={C.textPrimary} />
            <Text style={DS.cardTitle}>Live OpenStreetMap Cyber Threat Grid</Text>
          </View>
          <View style={{ width: '100%', height: MAP_HEIGHT, borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: generateLeafletHtml() }}
              style={{ width: '100%', height: MAP_HEIGHT, backgroundColor: C.dark }}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        </View>

        {/* Selected Hotspot Card */}
        {selectedHotspot && (
          <View style={DS.card}>
            <Text style={DS.cardTitle}>🎯 Selected: {selectedHotspot.city}, {selectedHotspot.state}</Text>
            <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginTop: S.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={DS.label}>DOMINANT VECTOR</Text>
                <Text style={DS.cardTitle}>{selectedHotspot.top_scam_type}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={DS.label}>ACTIVE CASES</Text>
                <Text style={{ fontSize: T.md, fontWeight: T.extrabold, color: C.red }}>{selectedHotspot.active_cases}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Hotspot List */}
        <Text style={DS.sectionTitle}>🔥 All Hotspots ({data.total_active_hotspots})</Text>

        {data.hotspots.map((item: any) => (
          <TouchableOpacity
            key={item.city}
            style={[DS.rowCard, item.city === selectedCity && { borderColor: C.dark, borderWidth: 2 }]}
            onPress={() => setSelectedCity(item.city)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
                <Text style={DS.cardTitle}>{item.city}, {item.state}</Text>
                <View style={[DS.pillBadge, { backgroundColor: item.risk_level === 'CRITICAL' ? C.redBg : C.amberBg }]}>
                  <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: item.risk_level === 'CRITICAL' ? C.red : C.amber }}>
                    {item.risk_level}
                  </Text>
                </View>
              </View>
              <Text style={DS.cardSub}>Vector: {item.top_scam_type} • {item.active_cases} cases</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
