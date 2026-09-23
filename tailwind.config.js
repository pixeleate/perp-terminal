const { colors, radius, fonts } = require('./src/lib/tokens');

const px = (value) => `${value}px`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Inter ships one file per weight, so weight is chosen by family. Dropping
    // the fontWeight scale means `font-medium` etc. below only set the family,
    // instead of also setting a fontWeight iOS would try to synthesise.
    fontWeight: {},
    extend: {
      colors: {
        bg: colors.bg,
        surface: colors.surface,
        raised: colors.surfaceRaised,
        line: {
          DEFAULT: colors.border,
          strong: colors.borderStrong,
          subtle: colors.borderSubtle,
        },
        selected: colors.rowSelected,
        fg: {
          DEFAULT: colors.text,
          secondary: colors.textSecondary,
          muted: colors.textMuted,
          faint: colors.textFaint,
        },
        placeholder: colors.placeholder,
        up: colors.up,
        down: colors.down,
        accent: { DEFAULT: colors.accent, muted: colors.accentMuted },
        warn: colors.warn,
        'on-tint': colors.onTint,
      },
      fontFamily: {
        sans: [fonts.regular],
        regular: [fonts.regular],
        medium: [fonts.medium],
        semibold: [fonts.semibold],
        bold: [fonts.bold],
        mono: [fonts.mono],
      },
      // The design's type scale; each size carries its line height.
      fontSize: {
        '2xs': ['10px', { lineHeight: '15px' }],
        caption: ['11px', { lineHeight: '16.5px' }],
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['13px', { lineHeight: '19.5px' }],
        base: ['15px', { lineHeight: '22.5px' }],
        md: ['16px', { lineHeight: '24px' }],
        lg: ['17px', { lineHeight: '25.5px' }],
        stat: ['22px', { lineHeight: '28px' }],
        title: ['30px', { lineHeight: '45px' }],
        amount: ['36px', { lineHeight: '54px' }],
        hero: ['40px', { lineHeight: '44px' }],
      },
      borderRadius: {
        xs: px(radius.xs),
        sm: px(radius.sm),
        md: px(radius.md),
        lg: px(radius.lg),
      },
    },
  },
  plugins: [],
};
