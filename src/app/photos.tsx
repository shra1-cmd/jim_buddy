import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, SectionLabel } from '../components/ui';
import { ANGLES, addPhoto, deletePhoto, listPhotos, type Angle, type Photo } from '../db/body';
import { fromKey, todayKey } from '../lib/dates';
import { keepImage, pickPhoto } from '../lib/images';
import { colors, radius, space, type } from '../theme';

const short = (k: string) => fromKey(k).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

export default function Photos() {
  const db = useSQLiteContext();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [angle, setAngle] = useState<Angle>('front');
  const [compare, setCompare] = useState<number[]>([]); // up to 2 photo ids

  const load = useCallback(async () => setPhotos(await listPhotos(db)), [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const ofAngle = useMemo(() => photos.filter((p) => p.angle === angle), [photos, angle]);
  // Default compare: oldest vs newest of this angle.
  const pair = useMemo(() => {
    const chosen = compare.map((id) => ofAngle.find((p) => p.id === id)).filter(Boolean) as Photo[];
    if (chosen.length === 2) return chosen.sort((a, b) => a.local_date.localeCompare(b.local_date));
    return ofAngle.length >= 2 ? [ofAngle[ofAngle.length - 1], ofAngle[0]] : null;
  }, [compare, ofAngle]);

  const add = async (source: 'camera' | 'library') => {
    const picked = await pickPhoto(source);
    if (!picked) return;
    const uri = await keepImage(picked.uri, 'progress');
    await addPhoto(db, todayKey(), angle, uri);
    load();
  };

  const toggle = (p: Photo) => setCompare((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c.slice(-1), p.id]));

  const remove = (p: Photo) =>
    Alert.alert('Delete this photo?', 'It is removed from the phone too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePhoto(db, p); setCompare((c) => c.filter((x) => x !== p.id)); load(); } },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ANGLES.map((a) => <Chip key={a} label={a[0].toUpperCase() + a.slice(1)} selected={angle === a} onPress={() => { setAngle(a); setCompare([]); }} />)}
      </View>

      {pair && (
        <>
          <SectionLabel>Compare</SectionLabel>
          <Card style={{ flexDirection: 'row', gap: space.sm }}>
            {pair.map((p) => (
              <View key={p.id} style={{ flex: 1 }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.cream }} resizeMode="cover" />
                <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>{short(p.local_date)}</Text>
              </View>
            ))}
          </Card>
          <Text style={[type.small, { marginTop: -space.sm, marginBottom: space.md }]}>Tap two photos below to compare them. Long-press to delete.</Text>
        </>
      )}

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Button title="Take photo" onPress={() => add('camera')} style={{ flex: 1 }} />
        <Button title="From gallery" variant="ghost" onPress={() => add('library')} style={{ flex: 1 }} />
      </View>
      <Text style={[type.small, { marginBottom: space.md }]}>
        Same spot, same light, same time of day, every 2–4 weeks. Photos stay on this phone and are not in backups.
      </Text>

      <SectionLabel>{`${angle.toUpperCase()} · ${ofAngle.length}`}</SectionLabel>
      {ofAngle.length === 0 && <Text style={type.small}>No {angle} photos yet.</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {ofAngle.map((p) => {
          const on = compare.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => toggle(p)} onLongPress={() => remove(p)} style={{ width: '31%' }} accessibilityLabel={`Photo from ${short(p.local_date)}`}>
              <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.sm, borderWidth: on ? 3 : 0, borderColor: colors.amber, backgroundColor: colors.cream }} />
              <Text style={[type.small, { textAlign: 'center' }]}>{short(p.local_date)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
