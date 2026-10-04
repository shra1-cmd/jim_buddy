import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { colors } from '../theme';

// Cold-start wordmark reveal: the system splash shows only the mark; here it slides left while "JimBuddy"
// fades in beside it, then the overlay fades away. ~750 ms total, skipped when Reduce Motion is on.
let shownThisLaunch = false;

export function IntroReveal() {
  const [visible, setVisible] = useState(!shownThisLaunch);
  const [slide] = useState(() => new Animated.Value(0));
  const [word] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (shownThisLaunch) return;
    shownThisLaunch = true;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) return setVisible(false);
        const ease = Easing.out(Easing.cubic);
        Animated.sequence([
          Animated.parallel([
            Animated.timing(slide, { toValue: 1, duration: 300, easing: ease, useNativeDriver: true }),
            Animated.timing(word, { toValue: 1, duration: 300, delay: 80, easing: ease, useNativeDriver: true }),
          ]),
          Animated.delay(200),
          Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      });
    return () => {
      cancelled = true;
    };
  }, [slide, word, fade]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: fade }]}>
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={{ width: 120, height: 120, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) }] }}
      />
      <Animated.View style={{ position: 'absolute', left: '50%', marginLeft: -10, opacity: word, transform: [{ translateX: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Text style={{ color: colors.ink, fontSize: 32, fontWeight: '800' }}>JimBuddy</Text>
      </Animated.View>
    </Animated.View>
  );
}
