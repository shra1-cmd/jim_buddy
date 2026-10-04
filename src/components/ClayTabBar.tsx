import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { clay, colors, radius } from '../theme';
import { Text } from './AppText';
import { Glyph, type GlyphName } from './Glyphs';

const ICONS: Record<string, GlyphName> = { home: 'home', journal: 'book', train: 'dumbbell', profile: 'person' };

/** Mint "sidebar" from the reference, laid out as a floating bottom bar. The active tab sits on a raised cream pill. */
export function ClayTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
      <View style={{ flexDirection: 'row', backgroundColor: colors.mint, borderRadius: radius.xl, padding: 6, boxShadow: clay.tabBar }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 7,
                borderRadius: radius.lg,
                backgroundColor: focused ? colors.card : 'transparent',
                boxShadow: focused ? clay.soft : undefined,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Glyph name={ICONS[route.name] ?? 'home'} size={24} color={focused ? colors.tealDeep : '#5E8F7C'} accent={focused ? colors.card : colors.mint} />
              <Text style={{ fontSize: 12, fontWeight: focused ? '700' : '600', color: focused ? colors.tealDeep : '#4F7A69', marginTop: 2 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
