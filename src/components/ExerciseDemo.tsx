import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, View } from 'react-native';
import { Text } from './AppText';
import { EXERCISE_MEDIA } from '../data/exerciseMedia';
import { colors, radius, type } from '../theme';

/**
 * Two-frame loop: start pose → end pose with an eased crossfade (0.5 s hold, 0.25 s ease each way),
 * the start pose ghosted at 30% under the end pose so the path of motion shows.
 * Reduce Motion shows both frames side by side instead.
 */
export function ExerciseDemo({ exerciseId, height = 220 }: { exerciseId: string; height?: number }) {
  const media = EXERCISE_MEDIA[exerciseId];
  const [t] = useState(() => new Animated.Value(0));
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);

  useEffect(() => {
    if (!media || reduce) return;
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(t, { toValue: 1, duration: 250, easing: ease, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(t, { toValue: 0, duration: 250, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [media, reduce, t]);

  if (!media) {
    return (
      <View style={{ height: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, borderRadius: radius.lg, marginBottom: 12, paddingHorizontal: 16 }}>
        <Text style={[type.small, { textAlign: 'center' }]}>No demo drawing for this one yet. A 3D loop is planned; use the cues below.</Text>
      </View>
    );
  }

  const [start, end] = media;
  if (reduce) {
    return (
      <View style={{ flexDirection: 'row', backgroundColor: colors.cream, borderRadius: radius.lg, marginBottom: 12, padding: 8 }}>
        <Image source={start} style={{ flex: 1, height: height / 1.6 }} resizeMode="contain" accessibilityLabel="Start position" />
        <Image source={end} style={{ flex: 1, height: height / 1.6 }} resizeMode="contain" accessibilityLabel="End position" />
      </View>
    );
  }

  const endOpacity = t;
  const startOpacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
  return (
    <View style={{ height, backgroundColor: colors.cream, borderRadius: radius.lg, marginBottom: 4, overflow: 'hidden' }} accessibilityLabel="Exercise demo, start and end position">
      <Animated.Image source={start} style={{ position: 'absolute', width: '100%', height: '100%', opacity: startOpacity }} resizeMode="contain" />
      <Animated.Image source={end} style={{ position: 'absolute', width: '100%', height: '100%', opacity: endOpacity }} resizeMode="contain" />
    </View>
  );
}

export function DemoCredit({ exerciseId }: { exerciseId: string }) {
  if (!EXERCISE_MEDIA[exerciseId]) return null;
  return <Text style={[type.small, { fontSize: 11, marginBottom: 12 }]}>Drawing: Everkinetic, CC BY-SA 4.0</Text>;
}
