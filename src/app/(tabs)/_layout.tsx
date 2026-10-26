import { Tabs } from 'expo-router/js-tabs';
import { ClayTabBar } from '../../components/ClayTabBar';
import { colors, fonts } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <ClayTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg, height: 104 },
        headerTitleStyle: { fontFamily: fonts.black, fontSize: 30, color: colors.ink },
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="train" options={{ title: 'Train' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
