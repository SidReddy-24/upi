import { Tabs } from "expo-router";
import { Colors } from "../../constants/Colors";

// ── Simple icon text labels (no external icon deps needed for web) ──
const icons: Record<string, string> = {
  index:        "⬡",
  transactions: "⚡",
  "fraud-feed": "🚨",
  graph:        "◎",
  models:       "◈",
  health:       "♥",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor:   Colors.accent.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: Colors.bg.surface,
          borderTopColor:  Colors.bg.border,
          borderTopWidth:  1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        headerStyle:      { backgroundColor: Colors.bg.surface },
        headerTintColor:  Colors.text.primary,
        headerTitleStyle: { fontWeight: "800", fontSize: 17, color: Colors.text.primary },
        tabBarIcon: ({ focused }) => {
          const icon = icons[route.name] ?? "•";
          return (
            <></>  // Text icons only via label for simplicity
          );
        },
      })}
    >
      <Tabs.Screen name="index"        options={{ title: "Dashboard",     tabBarLabel: "⬡ Dashboard" }} />
      <Tabs.Screen name="transactions" options={{ title: "Live Feed",      tabBarLabel: "⚡ Live Feed" }} />
      <Tabs.Screen name="fraud-feed"   options={{ title: "Fraud Alerts",   tabBarLabel: "🚨 Alerts" }} />
      <Tabs.Screen name="graph"        options={{ title: "Graph Explorer", tabBarLabel: "◎ Graph" }} />
      <Tabs.Screen name="models"       options={{ title: "Model Metrics",  tabBarLabel: "◈ Models" }} />
      <Tabs.Screen name="health"       options={{ title: "System Health",  tabBarLabel: "♥ Health" }} />
    </Tabs>
  );
}
