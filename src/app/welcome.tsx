import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/AppText';
import { Mascot, Plant } from '../components/Illustrations';
import { Button, IconBadge } from '../components/ui';
import { ensureFirstOpen } from '../db/feedback';
import { getProfile } from '../db/queries';
import { setSetting } from '../db/settings';
import { todayKey } from '../lib/dates';
import { clay, colors, radius, space, tiles, type } from '../theme';

const HIGHLIGHTS = [
  { icon: 'fork', tint: tiles.green, text: 'Log Indian meals in seconds' },
  { icon: 'dumbbell', tint: tiles.coral, text: 'Track every set and the muscles you work' },
  { icon: 'check', tint: tiles.blue, text: 'Everything stays on this phone. No account.' },
] as const;

// A note from the maker, shown once on first launch (and again from Settings with ?again=1).
export default function Welcome() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { again } = useLocalSearchParams<{ again?: string }>();

  const begin = async () => {
    if (again) return router.back();
    await ensureFirstOpen(db, todayKey());
    await setSetting(db, 'welcome_seen_at', new Date().toISOString());
    router.replace((await getProfile(db)) ? '/home' : '/onboarding');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl }}
    >
      <View style={{ alignItems: 'center', marginBottom: space.md }}>
        <View style={{ width: 168, height: 168, borderRadius: 84, backgroundColor: '#FDCBB5', alignItems: 'center', justifyContent: 'flex-end', boxShadow: clay.tile, overflow: 'hidden' }}>
          <Mascot size={150} id="welcome" />
        </View>
        <Text style={[type.h1, { marginTop: space.lg, textAlign: 'center' }]}>Welcome to JimBuddy</Text>
        <Text style={[type.small, { marginTop: 4, textAlign: 'center' }]}>Your food × strength diary</Text>
      </View>

      {/* the letter */}
      <View style={{ backgroundColor: colors.cardHi, borderRadius: radius.lg, padding: space.xl, boxShadow: clay.card, marginBottom: space.lg }}>
        <View style={{ position: 'absolute', right: 10, top: 6 }}>
          <Plant size={34} id="welcomeplant" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: space.md }}>Hi, I’m Shravan 👋</Text>
        <Text style={[type.body, { lineHeight: 23, color: colors.inkSoft }]}>
          JimBuddy is here to help you understand yourself better — from what you eat and how you train to how your body grows and changes over time.
        </Text>
        <Text style={[type.body, { lineHeight: 23, color: colors.inkSoft, marginTop: space.md }]}>
          Every meal, every workout, every small habit tells a story. Stay consistent, track your progress, and discover what truly works for your body — one day at a time.
        </Text>
        <Text style={{ marginTop: space.lg, fontSize: 16, fontWeight: '800', color: colors.coralDeep, textAlign: 'right' }}>— Shravan</Text>
      </View>

      {HIGHLIGHTS.map((h) => (
        <View key={h.icon} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <IconBadge name={h.icon} color={h.tint.badge} size={36} />
          <Text style={{ flex: 1, marginLeft: space.md, fontWeight: '700' }}>{h.text}</Text>
        </View>
      ))}

      <Button title={again ? 'Close' : 'Let’s begin'} onPress={begin} style={{ marginTop: space.md }} />
    </ScrollView>
  );
}
