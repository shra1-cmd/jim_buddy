import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { IntroReveal } from '../components/IntroReveal';
import { migrateDbIfNeeded } from '../db/migrate';
import { configureNotifications } from '../lib/restTimer';
import { colors } from '../theme';

// Keep the system splash (the Two-plates mark) up until the database is migrated and seeded.
SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  configureNotifications();
} catch {
  // notifications unsupported on this platform (web)
}

function HideSplashWhenReady() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.amber} />
        </View>
      }
    >
      <SQLiteProvider databaseName="jimbuddy.db" onInit={migrateDbIfNeeded} useSuspense>
        <HideSplashWhenReady />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: 'Your targets' }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal', title: 'Add food' }} />
          <Stack.Screen name="scan" options={{ presentation: 'modal', title: 'Scan meal' }} />
          <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', title: 'Add exercises' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
          <Stack.Screen name="plan/[id]" options={{ title: 'Edit plan' }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout', gestureEnabled: false }} />
          <Stack.Screen name="history" options={{ title: 'History' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
          <Stack.Screen name="photos" options={{ title: 'Progress photos' }} />
        </Stack>
        <IntroReveal />
      </SQLiteProvider>
    </Suspense>
  );
}
