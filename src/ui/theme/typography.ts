import type { TextStyle } from 'react-native';

export type TextVariant =
  | 'display'
  | 'hero'
  | 'heroUnit'
  | 'title'
  | 'heading'
  | 'stat'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'micro'
  | 'section'
  | 'mono';

/** Letter spacing in px for a spacing given in em (React Native has no em unit). */
export function tracking(fontSize: number, em: number): number {
  return Math.round(fontSize * em * 100) / 100;
}

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export const TYPE: Readonly<Record<TextVariant, TextStyle>> = {
  display: {
    fontFamily: 'Geist',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: tracking(34, -0.02),
  },
  hero: {
    fontFamily: 'Geist',
    fontSize: 64,
    lineHeight: 64,
    fontWeight: '600',
    letterSpacing: tracking(64, -0.035),
    fontVariant: TABULAR,
  },
  heroUnit: { fontFamily: 'Geist', fontSize: 24, fontWeight: '500' },
  title: {
    fontFamily: 'Geist',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: tracking(20, -0.01),
  },
  heading: {
    fontFamily: 'Geist',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: tracking(17, -0.01),
  },
  stat: {
    fontFamily: 'Geist',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    letterSpacing: tracking(24, -0.02),
    fontVariant: TABULAR,
  },
  body: { fontFamily: 'Geist', fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontFamily: 'Geist', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontFamily: 'Geist', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontFamily: 'Geist', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  micro: { fontFamily: 'Geist', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  section: {
    fontFamily: 'Geist',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: tracking(13, 0.02),
  },
  mono: { fontFamily: 'GeistMono', fontSize: 13, lineHeight: 18, fontWeight: '400' },
};
