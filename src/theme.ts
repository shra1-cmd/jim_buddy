// "Pastel clay" theme, sampled from the reference dashboard: warm cream surfaces, soft raised cards,
// coral primary, sage/teal secondary, butter and dusty-blue accents, rounded Nunito type.
export const colors = {
  // surfaces
  bg: '#FCEBD9', // page
  bgDeep: '#FFDEC7', // outer / pressed
  card: '#FFF4E8', // raised card
  cardHi: '#FFFAF4', // inputs, inner wells
  cream: '#FDE7D3',
  line: '#F0DCC8',

  // text
  ink: '#3F2F27', // dark cocoa
  inkSoft: '#6B574B',
  muted: '#9A8576',

  // brand
  coral: '#F47C5F', // primary action
  coralDeep: '#E0624A',
  coralSoft: '#FDD3C2',
  peach: '#FFB58F',
  sage: '#D5E6C9', // tile green
  sageDeep: '#5FAE93', // badge / secondary action
  teal: '#4E9C84',
  tealDeep: '#2F7A63', // icons, links
  mint: '#C3DCCD', // tab bar
  butter: '#FCE3B4', // tile yellow
  gold: '#F8BE55', // badge yellow
  sky: '#D8E2EA', // tile blue
  skyDeep: '#86A9C9', // badge blue
  pink: '#EDADC2',
  lilac: '#E4D3EE',

  // kept names used across the app (now mapped onto the pastel palette)
  steel: '#2F7A63', // links / secondary emphasis → deep teal
  steelLight: '#A9CBBE',
  amber: '#F47C5F', // highlight → coral
  amberSoft: '#FDD3C2',
  roast: '#D9643F',
  danger: '#D64545',
  good: '#3E9A57',
};

/** Macro colours, validated as a categorical set (coral / amber / blue) on the card surface. */
export const macro = { protein: '#E4604A', carbs: '#E0A12B', fat: '#4F86C6' };

/** Fixed day colours for the weekly bars (Mon → Sun), as in the reference. Never cycled. */
export const dayColors = ['#FFAB87', '#FFBC54', '#A9C59C', '#FF7B5E', '#91B3C4', '#7BBFAF', '#EDADC2'];

/** Pastel tiles: background + badge colour. */
export const tiles = {
  green: { bg: '#D9E8CC', badge: '#5FAE93' },
  coral: { bg: '#FDD0BE', badge: '#F47C5F' },
  yellow: { bg: '#FCE5B8', badge: '#F4B740' },
  blue: { bg: '#D8E2EA', badge: '#86A9C9' },
  pink: { bg: '#F7D6DE', badge: '#E58FA9' },
  lilac: { bg: '#E6DAF0', badge: '#A98CC8' },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 10, md: 16, lg: 24, xl: 28, pill: 999 };

/** Soft "clay" depth: a warm drop shadow plus a light top rim and a faint bottom shade. */
export const clay = {
  card: '0px 8px 18px rgba(205, 140, 98, 0.16), inset 0px 2px 1px rgba(255, 255, 255, 0.9), inset 0px -2px 3px rgba(205, 140, 98, 0.08)',
  tile: '0px 8px 16px rgba(190, 130, 95, 0.16), inset 0px 2px 1px rgba(255, 255, 255, 0.7), inset 0px -3px 4px rgba(120, 80, 50, 0.07)',
  button: '0px 6px 12px rgba(224, 98, 74, 0.32), inset 0px 2px 1px rgba(255, 255, 255, 0.35), inset 0px -3px 2px rgba(140, 45, 25, 0.16)',
  buttonTeal: '0px 6px 12px rgba(47, 122, 99, 0.28), inset 0px 2px 1px rgba(255, 255, 255, 0.35), inset 0px -3px 2px rgba(20, 70, 55, 0.16)',
  soft: '0px 4px 10px rgba(205, 140, 98, 0.18), inset 0px 2px 1px rgba(255, 255, 255, 0.9)',
  badge: '0px 4px 8px rgba(90, 60, 40, 0.14), inset 0px 2px 1px rgba(255, 255, 255, 0.45), inset 0px -3px 2px rgba(0, 0, 0, 0.10)',
  well: 'inset 0px 2px 4px rgba(190, 130, 90, 0.12)',
  tabBar: '0px -2px 18px rgba(120, 150, 130, 0.22), inset 0px 2px 1px rgba(255, 255, 255, 0.55)',
};

export const type = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, letterSpacing: 0.2 },
};

/** Nunito families by weight (loaded in the root layout). */
export const fonts = {
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};
