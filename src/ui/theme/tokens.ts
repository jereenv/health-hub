export type ColorScheme = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  card: string;
  raised: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  onAccent: string;
  accentInk: string;
  statusLow: string;
  statusOk: string;
  statusHigh: string;
  track: string;
  grid: string;
  bar: string;
  nav: string;
  scrim: string;
}

export const COLORS: Readonly<Record<ColorScheme, ThemeColors>> = {
  dark: {
    bg: '#0A0A0B',
    card: '#141416',
    raised: '#1E1E22',
    line: 'rgba(255,255,255,0.08)',
    ink: '#F5F5F7',
    muted: '#9A9AA2',
    accent: '#D2FF52',
    onAccent: '#0A0A0B',
    accentInk: '#D2FF52',
    statusLow: '#5A82E6',
    statusOk: '#14A086',
    statusHigh: '#BF8228',
    track: 'rgba(255,255,255,0.10)',
    grid: 'rgba(255,255,255,0.06)',
    bar: 'rgba(255,255,255,0.22)',
    nav: 'rgba(16,16,18,0.84)',
    scrim: 'rgba(0,0,0,0.5)',
  },
  light: {
    bg: '#FFFFFF',
    card: '#F6F6F8',
    raised: '#FFFFFF',
    line: 'rgba(0,0,0,0.07)',
    ink: '#111111',
    muted: '#6B6B73',
    accent: '#D2FF52',
    onAccent: '#111111',
    accentInk: '#4D6B00',
    statusLow: '#3A63D8',
    statusOk: '#0F8A73',
    statusHigh: '#B8741A',
    track: 'rgba(0,0,0,0.08)',
    grid: 'rgba(0,0,0,0.06)',
    bar: 'rgba(0,0,0,0.18)',
    nav: 'rgba(255,255,255,0.88)',
    scrim: 'rgba(0,0,0,0.3)',
  },
};

export const RADIUS = { card: 24, tile: 20, chip: 14, set: 12, pill: 999 } as const;
export const SPACE = { screen: 20, card: 16, stack: 14, row: 12, gap: 8 } as const;
export const MOTION = { pressScale: 0.98, pressMs: 150, sheetMs: 250, pulseMs: 1600 } as const;
export const TOUCH_MIN = 44;
