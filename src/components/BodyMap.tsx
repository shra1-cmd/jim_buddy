import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { colors } from '../theme';

// The library's own body art is dark; we restyle every muscle so unselected ones sit quietly in cream.
const ALL: Slug[] = [
  'abs', 'adductors', 'biceps', 'calves', 'chest', 'deltoids', 'forearm', 'gluteal', 'hamstring', 'lower-back',
  'neck', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back', 'hands', 'feet', 'knees',
  'ankles', 'head', 'hair',
];
const QUIET = '#E7DFD2';
const SKIN = '#D9CDBB';

/** levels: slug → 1 (secondary) or 2 (primary). */
export function BodyMap({
  levels,
  side,
  scale = 1,
  onPress,
}: {
  levels: Partial<Record<string, 1 | 2>>;
  side: 'front' | 'back';
  scale?: number;
  onPress?: (slug: string) => void;
}) {
  const data: ExtendedBodyPart[] = ALL.map((slug) => {
    const lvl = levels[slug];
    if (lvl === 2) return { slug, styles: { fill: colors.amber } };
    if (lvl === 1) return { slug, styles: { fill: colors.amberSoft } };
    const fill = ['hands', 'feet', 'knees', 'ankles', 'head', 'neck', 'hair'].includes(slug) ? SKIN : QUIET;
    return { slug, styles: { fill } };
  });
  return (
    <Body
      data={data}
      side={side}
      scale={scale}
      border={colors.steelLight}
      defaultFill={QUIET}
      onBodyPartPress={onPress ? (part) => part.slug && onPress(part.slug) : undefined}
    />
  );
}
