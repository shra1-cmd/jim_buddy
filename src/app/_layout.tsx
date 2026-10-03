import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { migrateDbIfNeeded } from '../db/migrate';
import { colors } from '../theme';

// Keep the system splash (the Two-plates mark) up until the database is migrated and seeded.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
