/**
 * Design tokens for PerpTerminal (trading UI Figma).
 *
 * Plain CommonJS so both `tailwind.config.js` (Node, at build time) and
 * `theme.ts` (the app, for styles computed at runtime) read the same values.
 * Colours stay as hex — with an alpha byte where the design is translucent —
 * so runtime call sites can still append an alpha suffix, e.g. `${up}1F`.
 */
const colors = {
  bg: '#07080A',
  surface: '#111316',
  surfaceRaised: '#161A1F',
  /** Hairline borders: white at 4–8% over the dark ground. */
  border: '#FFFFFF12',
  borderStrong: '#FFFFFF14',
  borderSubtle: '#FFFFFF0A',
  /** Selected list row wash. */
  rowSelected: '#FFFFFF08',
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textFaint: '#52525B',
  placeholder: '#9CA3AF',
  up: '#34D399',
  down: '#FB7185',
  /** Primary neutral accent — the design is monochrome apart from up/down. */
  accent: '#F4F4F5',
  accentMuted: '#161A1F',
  warn: '#FBBF24',
  /** Text on a filled up/down button. */
  onTint: '#07080A',
};

const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

/** Inter, loaded in the root layout. Custom fonts select weight by family, not fontWeight. */
const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'Menlo',
};

module.exports = { colors, radius, fonts };
