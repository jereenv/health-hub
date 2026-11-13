export type IconName =
  | 'home'
  | 'body'
  | 'dumbbell'
  | 'activity'
  | 'export'
  | 'settings'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'trophy'
  | 'info'
  | 'check'
  | 'bulb'
  | 'calendar';

export type IconShape =
  | { kind: 'path'; d: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };

const path = (d: string): IconShape => ({ kind: 'path', d });

/** 24x24 line icons, copied from the approved mockups. */
export const ICON_SHAPES: Readonly<Record<IconName, readonly IconShape[]>> = {
  home: [path('M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z')],
  body: [
    { kind: 'rect', x: 3.5, y: 3.5, width: 17, height: 17, rx: 5 },
    path('M8.5 10a4.5 4.5 0 0 1 7 0M12 10.5l1.6-2'),
  ],
  dumbbell: [path('M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11')],
  activity: [path('M3 12h4l2.5-6 5 12 2.5-6H21')],
  export: [path('M12 3.5v11M7.5 8 12 3.5 16.5 8M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5')],
  settings: [
    path('M4 7h10M18 7h2M4 17h4M12 17h8'),
    { kind: 'circle', cx: 16, cy: 7, r: 2 },
    { kind: 'circle', cx: 10, cy: 17, r: 2 },
  ],
  chevronRight: [path('m9 6 6 6-6 6')],
  chevronLeft: [path('m15 6-6 6 6 6')],
  chevronDown: [path('m6 9 6 6 6-6')],
  trophy: [path('M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8.5 20h7')],
  info: [{ kind: 'circle', cx: 12, cy: 12, r: 9 }, path('M12 11v5M12 8h.01')],
  check: [path('m5 12.5 4.5 4.5L19 7.5')],
  bulb: [path('M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z')],
  calendar: [
    { kind: 'rect', x: 3.5, y: 5.5, width: 17, height: 15, rx: 4 },
    path('M8 3.5v3M16 3.5v3'),
  ],
};
