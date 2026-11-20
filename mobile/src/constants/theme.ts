/**
 * Design tokens mirror the muted light palette used by the existing web app
 * (frontend/src/styles.css). Dark tokens are provided for the optional theme.
 */

export const lightColors = {
  brand: '#b0577f',
  brandStrong: '#964465',
  brandFill: '#a94e75',
  brandFillStrong: '#8f3f61',
  brandSoft: '#fdf3f7',
  brandLine: '#e9c9d7',
  paper: '#fffafd',
  ink: '#282328',
  muted: '#6e6670',
  line: '#eddee5',
  wash: '#faf3f6',
  soft: '#fdf7fa',
  inverse: '#211c20',
  onDark: '#fffdfb',
  focus: 'rgba(176, 87, 127, 0.22)',
} as const;

export const darkColors = {
  brand: '#ff8cc2',
  brandStrong: '#ffadd6',
  brandFill: '#d42776',
  brandFillStrong: '#e8428f',
  brandSoft: '#4a273d',
  brandLine: '#8d4c6d',
  paper: '#2a2431',
  ink: '#fff9fd',
  muted: '#ded3dd',
  line: '#5a4b60',
  wash: '#342c3b',
  soft: '#302838',
  inverse: '#17131a',
  onDark: '#fffdfb',
  focus: 'rgba(255, 140, 194, 0.32)',
} as const;

/** Widen the literal hex values so both palettes satisfy the same token shape. */
export type AppColors = { [K in keyof typeof lightColors]: string };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  card: 20,
  panel: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const, lineHeight: 38 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 29 },
  subtitle: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  button: { fontSize: 15, fontWeight: '700' as const, lineHeight: 20 },
} as const;

export const touchTarget = 44;

export const theme = {
  colors: lightColors,
  spacing,
  radius,
  typography,
  touchTarget,
};
