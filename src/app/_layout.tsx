import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { IntroReveal } from '../components/IntroReveal';
import { migrateDbIfNeeded } from '../db/migrate';
import { configureNotifications } from '../lib/restTimer';
import { colors, fonts } from '../theme';

// Keep the system splash up until fonts are loaded and the database is migrated and seeded.
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
  const [fontsLoaded, fontError] = useFonts({ Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  if (!fontsLoaded && !fontError) return null;

  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
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
            headerTitleStyle: { fontFamily: fonts.black, fontSize: 19, color: colors.ink },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: 'Your targets' }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal', title: 'Add food' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan meal' }} />
          <Stack.Screen name="menu" options={{ title: 'Weekly menu' }} />
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
