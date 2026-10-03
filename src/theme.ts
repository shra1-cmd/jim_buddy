// Brand tokens from the plan's Brand section.
export const colors = {
  ink: '#131B2E',
  inkSoft: '#3A4459',
  steel: '#4E5D78',
  steelLight: '#8DA2C0',
  cream: '#F3EBDD',
  bg: '#F7F4EE',
  card: '#FFFFFF',
  amber: '#FFB020',
  amberSoft: '#FFE7B3',
  roast: '#C9702E',
  line: '#E6E1D8',
  muted: '#7A8294',
  danger: '#C2410C',
  good: '#2F855A',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

export const type = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, letterSpacing: 0.3 },
};
