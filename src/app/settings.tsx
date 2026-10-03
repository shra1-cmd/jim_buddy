import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, SectionLabel, styles as ui } from '../components/ui';
import { getProfile, setEatBack } from '../db/queries';
import { getSetting, setSetting } from '../db/settings';
import { testProxy } from '../lib/ai';
import { exportBackup, pickAndRestore } from '../lib/backup';
import { colors, space, type } from '../theme';

export default function Settings() {
  const db = useSQLiteContext();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [eatBack, setEb] = useState(50);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setUrl((await getSetting(db, 'proxy_url')) ?? '');
      setToken((await getSetting(db, 'invite_token')) ?? '');
      setLastBackup(await getSetting(db, 'last_backup_at'));
      setEb((await getProfile(db))?.eatBackPct ?? 50);
    })();
  }, [db]);

  const saveAi = async () => {
    await setSetting(db, 'proxy_url', url.trim());
    await setSetting(db, 'invite_token', token.trim());
    const ok = url.trim() ? await testProxy(url.trim()) : false;
    Alert.alert(ok ? 'Connected' : 'Saved, but not reachable', ok ? 'Meal scans will use this service.' : 'Check the URL, or try again when online.');
  };

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
            if (n != null) Alert.alert('Restored', `${n} records restored.`, [{ text: 'OK', onPress: () => router.replace('/journal') }]);
          } catch (e) {
            Alert.alert('Restore failed', String((e as Error).message ?? e));
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Settings' }} />

      <SectionLabel>Meal scan service</SectionLabel>
      <Card>
        <Text style={[type.small, { marginBottom: space.sm }]}>
          Paste the proxy URL and your invite token from whoever runs the JimBuddy proxy (see proxy/README.md).
        </Text>
        <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://jimbuddy-proxy.you.workers.dev" placeholderTextColor={colors.muted} style={[ui.input, { marginBottom: space.sm }]} />
        <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Invite token" placeholderTextColor={colors.muted} style={[ui.input, { marginBottom: space.md }]} />
        <Button title="Save and test" onPress={saveAi} />
      </Card>

      <SectionLabel>Add back exercise calories</SectionLabel>
      <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
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
          Everything lives on this phone; export weekly to Files or Drive. Progress photos are not inside the file.
        </Text>
        <Button title="Export backup" onPress={backup} style={{ marginBottom: space.sm }} />
        <Button title="Restore from file" variant="ghost" onPress={restore} />
      </Card>

      <SectionLabel>Credits</SectionLabel>
      <Text style={type.small}>
        Food data: Indian Nutrient Databank (INDB), CC BY, built on ICMR-NIN food composition tables. Basic foods use typical values.
        {'\n'}Exercise drawings: adapted from Everkinetic, CC BY-SA 4.0.
        {'\n'}Body map: react-native-body-highlighter (MIT).
      </Text>
    </ScrollView>
  );
}
