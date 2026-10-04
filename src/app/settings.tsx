import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Text } from '../components/AppText';
import { Button, Card, Chip, IconBadge, SectionLabel } from '../components/ui';
import { getProfile, setEatBack } from '../db/queries';
import { getSetting, setSetting } from '../db/settings';
import { exportBackup, pickAndRestore } from '../lib/backup';
import { space, tiles, type } from '../theme';

export default function Settings() {
  const db = useSQLiteContext();
  const [eatBack, setEb] = useState(50);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLastBackup(await getSetting(db, 'last_backup_at'));
      setEb((await getProfile(db))?.eatBackPct ?? 50);
    })();
  }, [db]);

  const backup = async () => {
    try {
      await exportBackup(db);
      const at = new Date().toISOString();
      await setSetting(db, 'last_backup_at', at);
      setLastBackup(at);
    } catch (e) {
      Alert.alert('Backup failed', String((e as Error).message ?? e));
    }
  };

  const restore = () =>
    Alert.alert('Restore a backup?', 'This replaces everything on this phone with the backup file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose file',
        style: 'destructive',
        onPress: async () => {
          try {
            const n = await pickAndRestore(db);
            if (n != null) Alert.alert('Restored', `${n} records restored.`, [{ text: 'OK', onPress: () => router.replace('/home') }]);
          } catch (e) {
            Alert.alert('Restore failed', String((e as Error).message ?? e));
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'Settings' }} />

      <Card style={{ backgroundColor: tiles.green.bg, flexDirection: 'row', alignItems: 'center' }}>
        <IconBadge name="check" color={tiles.green.badge} />
        <Text style={[type.small, { flex: 1, marginLeft: space.md, color: '#2D5E4C' }]}>
          Everything (profile, food, workouts, steps, menu, photos) lives only in this phone’s database. No account, no cloud.
          Meal scans go through your own ChatGPT app.
        </Text>
      </Card>

      <SectionLabel>Add back exercise calories</SectionLabel>
      <View style={{ flexDirection: 'row', marginBottom: space.xs }}>
        {[0, 50, 100].map((v) => (
          <Chip key={v} label={`${v}%`} selected={eatBack === v} onPress={async () => { setEb(v); await setEatBack(db, v); }} />
        ))}
      </View>
      <Text style={[type.small, { marginBottom: space.lg }]}>Burn estimates run high, so 50% is the safe default.</Text>

      <SectionLabel>Targets</SectionLabel>
      <Button title="Recalculate targets" variant="ghost" onPress={() => router.push('/onboarding')} style={{ marginBottom: space.lg }} />

      <SectionLabel>Backup</SectionLabel>
      <Card>
        <Text style={[type.small, { marginBottom: space.md }]}>
          {lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. ` : 'No backup yet. '}
          Export weekly to Files or Drive. Photos are not inside the file.
        </Text>
        <Button title="Export backup" onPress={backup} style={{ marginBottom: space.sm }} />
        <Button title="Restore from file" variant="ghost" onPress={restore} />
      </Card>

      <SectionLabel>Credits</SectionLabel>
      <Text style={type.small}>
        Food data: Indian Nutrient Databank (INDB), CC BY, built on ICMR-NIN food composition tables. Basic foods use typical values.
        {'\n'}Exercise drawings: adapted from Everkinetic, CC BY-SA 4.0.
        {'\n'}Body map: react-native-body-highlighter (MIT). Font: Nunito (OFL).
      </Text>
    </ScrollView>
  );
}
