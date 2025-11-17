import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false // ← OCULTA HEADER EN TODAS LAS PANTALLAS
        }}
      >
        {/* No necesitas cambiar cada Stack.Screen individual */}
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}