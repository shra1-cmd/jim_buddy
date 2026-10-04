import { forwardRef } from 'react';
import {
  Platform, StyleSheet, Text as RNText, TextInput as RNTextInput,
  type TextInputProps, type TextProps, type TextStyle,
} from 'react-native';
import { colors, fonts } from '../theme';

// Nunito everywhere. Custom fonts don't synthesise weights on Android, so each fontWeight maps to its own
// family and the weight itself is reset. Body copy sits one step heavier than "regular" for the soft look.
function family(weight: TextStyle['fontWeight']): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 800) return fonts.black;
  if (w >= 700) return fonts.extrabold;
  if (w >= 600) return fonts.bold;
  if (w >= 500) return fonts.bold;
  return fonts.semibold;
}

function withFont(style: TextProps['style']) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return style;
  return [{ color: colors.ink }, style, { fontFamily: family(flat.fontWeight), fontWeight: Platform.OS === 'web' ? undefined : ('normal' as const) }];
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={withFont(style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} placeholderTextColor={colors.muted} {...rest} style={withFont(style)} />;
});
