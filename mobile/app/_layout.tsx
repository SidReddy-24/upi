import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bg.surface },
          headerTintColor: Colors.text.primary,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 17,
            color: Colors.text.primary,
          },
          contentStyle: { backgroundColor: Colors.bg.app },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="investigation/[id]"
          options={{
            title: "Investigation",
            presentation: "modal",
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.app },
});
