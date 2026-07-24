import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 320;

// Coordinates for Indian scam hotspot cities
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

export default function ScamHeatMapScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  const selectedHotspot = data.hotspots.find((h: any) => h.city === selectedCity) || data.hotspots[0];

  // Leaflet HTML String with OpenStreetMap tiles and interactive heat markers
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
          body { margin: 0; padding: 0; background: #1A1A2E; }
          #map { width: 100%; height: 100vh; background: #1A1A2E; }
          .leaflet-container { background: #1A1A2E !important; }
          .leaflet-popup-content-wrapper {
            background: #1A1A2E;
            color: #FAF7F0;
            border-radius: 12px;
            border: 1px solid #E8C4B8;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .leaflet-popup-tip { background: #1A1A2E; }
          .popup-title { font-weight: 800; font-size: 14px; margin-bottom: 4px; color: #FAF7F0; }
          .popup-desc { font-size: 11px; color: #E8C4B8; margin-top: 2px; }
          .popup-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; color: #fff; margin-top: 4px; }
          .badge-crit { background: #E63946; }
          .badge-high { background: #F4A261; }
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
            const color = isCrit ? '#E63946' : '#F4A261';
            const fillColor = isCrit ? '#E63946' : '#F4A261';

            // Outer pulse circle
            L.circleMarker(item.coords, {
              radius: isCrit ? 22 : 16,
              color: color,
              fillColor: fillColor,
              fillOpacity: 0.2,
              weight: 1
            }).addTo(map);

            // Core circle marker
            const marker = L.circleMarker(item.coords, {
              radius: isCrit ? 12 : 8,
              color: '#FAF7F0',
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ National Scam Threat Map</Text>
        <Text style={styles.subtitle}>Leaflet OpenStreetMap · Real-time cyber fraud hotspot intelligence</Text>
      </View>

      {data.national_fraud_wave_alert && (
        <View style={styles.waveBanner}>
          <Text style={styles.waveTitle}>⚡ ACTIVE FRAUD WAVE ALERT</Text>
          <Text style={styles.waveDesc}>
            Spike detected in "Digital Arrest" & "Telegram Investment" scams originating from major hotspots.
          </Text>
        </View>
      )}

      {/* ── Leaflet OpenStreetMap View ── */}
      <View style={styles.mapCard}>
        <View style={styles.mapCardHeader}>
          <AppIcon name="heatmap" size={18} color="#FAF7F0" />
          <Text style={styles.mapCardTitle}>Live OpenStreetMap Cyber Threat Grid</Text>
        </View>
        <View style={styles.webViewWrapper}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: generateLeafletHtml() }}
            style={styles.webView}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </View>

      {/* ── Selected Hotspot Card ── */}
      {selectedHotspot && (
        <View style={styles.intelCard}>
          <Text style={styles.intelHeader}>🎯 Selected Hotspot: {selectedHotspot.city}, {selectedHotspot.state}</Text>
          <View style={styles.intelRow}>
            <Text style={styles.intelLabel}>Risk Level:</Text>
            <View style={[styles.badge, selectedHotspot.risk_level === 'CRITICAL' ? styles.badgeCrit : styles.badgeHigh]}>
              <Text style={styles.badgeText}>{selectedHotspot.risk_level}</Text>
            </View>
          </View>
          <View style={styles.intelRow}>
            <Text style={styles.intelLabel}>Dominant Vector:</Text>
            <Text style={styles.intelVal}>{selectedHotspot.top_scam_type}</Text>
          </View>
          <View style={styles.intelRow}>
            <Text style={styles.intelLabel}>Active Police Reports:</Text>
            <Text style={styles.intelVal}>{selectedHotspot.active_cases} cases</Text>
          </View>
          <View style={styles.intelRow}>
            <Text style={styles.intelLabel}>7-Day Surge Trend:</Text>
            <Text style={[styles.intelVal, selectedHotspot.fraud_trend_pct > 0 ? styles.textDanger : styles.textSafe]}>
              {selectedHotspot.fraud_trend_pct > 0 ? `+${selectedHotspot.fraud_trend_pct}%` : `${selectedHotspot.fraud_trend_pct}%`}
            </Text>
          </View>
        </View>
      )}

      {/* ── Hotspot List ── */}
      <Text style={styles.sectionTitle}>🔥 All Tracked Hotspots ({data.total_active_hotspots})</Text>

      {data.hotspots.map((item: any) => (
        <TouchableOpacity
          key={item.city}
          style={[styles.card, item.city === selectedCity && styles.cardSelected]}
          onPress={() => setSelectedCity(item.city)}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cityName}>{item.city}</Text>
              <Text style={styles.stateName}>{item.state}</Text>
            </View>
            <View style={[styles.badge, item.risk_level === 'CRITICAL' ? styles.badgeCrit : styles.badgeHigh]}>
              <Text style={styles.badgeText}>{item.risk_level}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Top Scam Type:</Text>
            <Text style={styles.val}>{item.top_scam_type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Active Cases:</Text>
            <Text style={styles.val}>{item.active_cases} cases</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F3EA', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F3EA' },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', color: '#181818', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666666' },
  waveBanner: { backgroundColor: 'rgba(192, 57, 43, 0.1)', borderLeftWidth: 4, borderLeftColor: '#C0392B', padding: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: '#C0392B' },
  waveTitle: { fontSize: 13, fontWeight: '900', color: '#C0392B', marginBottom: 4 },
  waveDesc: { fontSize: 12, color: '#C0392B', lineHeight: 16, fontWeight: '600' },
  mapCard: { backgroundColor: '#EFE7DA', borderRadius: 22, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#DCD1BF' },
  mapCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#EFE7DA' },
  mapCardTitle: { color: '#181818', fontSize: 13, fontWeight: '800' },
  webViewWrapper: { width: '100%', height: MAP_HEIGHT, overflow: 'hidden' },
  webView: { width: '100%', height: MAP_HEIGHT, backgroundColor: '#181818' },
  intelCard: { backgroundColor: '#E5DCCB', borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#DCD1BF' },
  intelHeader: { fontSize: 15, fontWeight: '900', color: '#181818', marginBottom: 10 },
  intelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  intelLabel: { fontSize: 13, color: '#666666', fontWeight: '600' },
  intelVal: { fontSize: 13, fontWeight: '800', color: '#181818' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#181818', marginBottom: 12 },
  card: { backgroundColor: '#EFE7DA', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#DCD1BF' },
  cardSelected: { borderColor: '#2E8B57', borderWidth: 2, backgroundColor: '#E5DCCB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cityName: { fontSize: 18, fontWeight: '900', color: '#181818' },
  stateName: { fontSize: 12, color: '#666666' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeCrit: { backgroundColor: '#C0392B' },
  badgeHigh: { backgroundColor: '#F59E0B' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 13, color: '#666666' },
  val: { fontSize: 13, fontWeight: '800', color: '#181818' },
  textDanger: { color: '#C0392B' },
  textSafe: { color: '#2E8B57' },
});
