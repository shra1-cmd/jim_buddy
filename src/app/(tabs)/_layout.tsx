import { Tabs } from 'expo-router/js-tabs';
import { HomeIcon, JournalIcon, ProfileIcon, TrainIcon } from '../../components/TabIcons';
import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="journal"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '800', fontSize: 22, color: colors.ink },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={String(color)} /> }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color }) => <JournalIcon color={String(color)} /> }} />
      <Tabs.Screen name="train" options={{ title: 'Train', tabBarIcon: ({ color }) => <TrainIcon color={String(color)} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <ProfileIcon color={String(color)} /> }} />
    </Tabs>
  );
}
