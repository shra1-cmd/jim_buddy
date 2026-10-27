import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from './AppText';
import { Glyph } from './Glyphs';
import { Mascot } from './Illustrations';
import { Button, styles as ui } from './ui';
import { daysUsed, markFeedbackSent } from '../db/feedback';
import { todayKey } from '../lib/dates';
import { RATINGS, feedbackMessage, type Rating } from '../lib/feedback';
import { clay, colors, radius, space, type } from '../theme';

/**
 * "How's JimBuddy so far?" One tap on a verdict, an optional note, then the phone's share sheet
 * (WhatsApp, email…) carries "Hi Shravan, I'm <name>…" to Shravan. There's no server, so nothing leaves otherwise.
 */
export function FeedbackSheet({ visible, name, onClose }: { visible: boolean; name: string; onClose: (sent: boolean) => void }) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState<Rating | null>(null);
  const [note, setNote] = useState('');
  const [thanked, setThanked] = useState(false);

  const close = (sent: boolean) => {
    onClose(sent);
    setRating(null);
    setNote('');
    setThanked(false);
  };

  const send = async () => {
    if (!rating) return;
    const message = feedbackMessage({ name, rating, note, daysUsed: await daysUsed(db, todayKey()), version: Constants.expoConfig?.version });
    const res = await Share.share({ message }).catch(() => null);
    if (res?.action !== Share.sharedAction) return; // dismissed: keep the sheet open
    await markFeedbackSent(db, rating);
    setThanked(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => close(thanked)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable onPress={() => close(thanked)} accessibilityLabel="Close" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(63, 47, 39, 0.35)' }} />
        <View style={{ maxHeight: '92%', backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, boxShadow: clay.card, paddingBottom: insets.bottom }}>
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          </View>

          {thanked ? (
            <View style={{ alignItems: 'center', padding: space.xl }}>
              <Mascot size={120} id="thanks" />
              <Text style={[type.h2, { fontSize: 22, marginTop: space.md, textAlign: 'center' }]}>Thank you{name ? `, ${name}` : ''}! 💛</Text>
              <Text style={[type.small, { marginTop: space.xs, textAlign: 'center', fontSize: 14 }]}>Your words help shape what JimBuddy becomes next.</Text>
              <Button title="Close" onPress={() => close(true)} style={{ alignSelf: 'stretch', marginTop: space.xl }} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.md }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FDE2D2', alignItems: 'center', justifyContent: 'center', boxShadow: clay.soft, overflow: 'hidden', borderWidth: 3, borderColor: colors.cardHi }}>
                  <Mascot face size={50} id="fbface" />
                </View>
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={{ fontSize: 20, fontWeight: '800' }}>How’s JimBuddy so far?</Text>
                  <Text style={type.small}>Shravan reads every message.</Text>
                </View>
              </View>

              {RATINGS.map((r) => {
                const on = rating === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setRating(r.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.sm, borderRadius: radius.md,
                      backgroundColor: on ? colors.cardHi : colors.card, borderWidth: 2, borderColor: on ? colors.coral : 'transparent',
                      boxShadow: clay.soft, transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
                    <Text style={{ flex: 1, marginLeft: space.md, fontSize: 16, fontWeight: '700' }}>{r.label}</Text>
                    {on && (
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }}>
                        <Glyph name="check" size={14} />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>ANYTHING ELSE? (OPTIONAL)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What should I add, fix or remove?"
                multiline
                maxLength={1000}
                textAlignVertical="top"
                style={[ui.input, { height: 96, paddingTop: space.md }]}
              />
              <Text style={[type.small, { marginTop: space.sm }]}>
                Starts with “{name.trim() ? `Hi Shravan, I’m ${name.trim()}` : 'Hi Shravan'} 👋”. You pick the app (WhatsApp, email…) to send it.
              </Text>

              <Button title="Send feedback" disabled={!rating} onPress={send} style={{ marginTop: space.lg }} />
              <Button title="Maybe later" variant="ghost" onPress={() => close(false)} style={{ marginTop: space.sm }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
