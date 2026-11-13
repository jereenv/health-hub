# Plan 2 — UI Foundation, Workouts and Settings Implementation Plan — Part 2b (Tasks 13–21)

> **Split note (controller, 2026-11-13):** Plan 2 was written as one 21-task plan and split for review size. This file is **Plan 2b: Tasks 13–21** (theme runtime, components, screens, on-device verification). It depends on Plan 2a (`2026-11-12-plan-2a-data-sync-foundations.md`, Tasks 1–12) being merged to `main`; the Interfaces blocks here consume what 2a produced. Task numbers are kept as written.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the developer screen with the real app: a themed five-tab shell, the atomic design components and charts, the Workouts pages (week-grouped history, workout detail with PRs, exercise progress, upcoming schedule) and Settings. All of it sits on hardened Lyfta sync and storage.

**Architecture:** The layering is the same as Plan 1. Pure TypeScript lives in `src/domain/` (dates, formatting, workout maths, screen models) and `src/data/` (SQLite, Lyfta, sync), and is tested in plain Node. React Native UI lives in `src/ui/` (theme, components, charts, screens), with thin route files in `app/`. A sync coordinator serialises every sync, re-sync and wipe, and publishes a snapshot that screens read through `useSyncExternalStore`. Charts are drawn with `react-native-svg` from a pure, tested geometry module.

**Tech Stack:** Plan 1's stack (Expo SDK 57, expo-router, expo-sqlite, expo-secure-store, zod, Jest + sql.js) plus react-native-svg, react-native-reanimated 4 + react-native-worklets, react-native-gesture-handler, expo-haptics, expo-blur, expo-font, expo-system-ui, and @expo-google-fonts/geist and geist-mono.

**Spec:** `docs/superpowers/specs/2026-11-12-health-hub-design.md`. Every screen also follows `docs/design/ui-guidelines.md`. The visual targets are the approved mockups (https://claude.ai/artifact/8uDe8Ymp5q2ZHK6mpSKYVH). Their HTML sources are `Workouts.dc.html`, `Main.dc.html`, `Body.dc.html` and `BodyFat.dc.html` in the controller's scratchpad `hh-mockups/project/`.

**Final repo path of this file:** `docs/superpowers/plans/2026-11-12-plan-2-ui-workouts-settings.md`.

## Starting point (controller verifies before Task 1)

Plan 2 builds on Plan 1 as merged into `main`. Confirm each item with `grep` or by reading the file. If one differs, append Plan 2's migrations after the real last one and adjust the named functions to match.

- `MIGRATIONS.length === 2`. Plan 1's v2 drops `workout.body_weight_kg`, so Plan 2 adds v3 to v6.
- `Workout` has no `bodyWeightKg`. The owner ruled that Lyfta's `body_weight` is never used, so no screen shows body weight.
- `syncLyfta` does the following:
  - when `lyfta.weightUnit` is unset, it resolves it from `/exercises/progress` `weight_unit`, and an unknown value is an error;
  - it saves the backfill cursor as JSON `{page, startedAt}`;
  - it confirms deletions against an unwindowed listing (`confirmDeletions`);
  - it keeps paging past an all-skipped page.
- `.prettierignore` contains `docs/`, and `tsconfig.json` matches Expo's version.
- The developer screen has a temporary "Full re-sync" button. Settings → Data → Re-sync (Task 17) replaces it. If Plan 1 added a sync-state reset helper for it, reuse that helper in Task 9 instead of adding a second one.

## Global Constraints

- Project root `/Users/jereenvalsson/personal/health-hub`.
- Expo SDK 57, React Native 0.86, React 19.2, TypeScript ~6.0.3. Install native packages with `npx expo install <pkg>`.
- Files under `src/domain/` and `src/data/` must not import `react-native` or `expo-*`, except adapter files named `expo*.ts`. Tests must run in plain Node.
- Path alias `@/` → `src/`.
- All stored timestamps are ISO-8601 UTC strings. All stored weights are kilograms.
- Lyfta:
  - base URL `https://my.lyfta.app`;
  - `Authorization: Bearer <key>`;
  - limits of 60 requests/minute and 5,000/day;
  - the exercise name field is spelled `excercise_name`.
- The Lyfta key lives only in `expo-secure-store` on the phone, or in the macOS Keychain item `health-hub-lyfta` for scripts. Never in code, logs, test fixtures, commits or chat.
- No analytics or crash-reporting SDKs.
- Before every commit, run `npm run typecheck && npm run lint && npm run format:check && npm test` and check `git diff --cached` for secrets and personal data.
- Commit messages are imperative, under 72 characters, with no AI attribution or Co-Authored-By lines.
- Never stage `android/`, `.expo/`, `.superpowers/` or `node_modules/`.
- Work on branch `jereenv/ui-workouts-settings`, created from `main` after Plan 1 merges. The controller creates it.
- Android build env:
  - `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`
  - `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
  - add `$JAVA_HOME/bin:$ANDROID_HOME/platform-tools` to `PATH`.

### Plan 2 rules

- **Paths.** The container lives in `src/bootstrap/`. **Never create `src/app/`**, because Expo Router treats it as the routes root. Routes live in `app/`, and each route file only re-exports a screen from `src/ui/screens/`.
- **UI code.** UI code lives in `src/ui/` and may import `react-native` and `expo-*`. Files there that hold pure logic (`tokens.ts`, `typography.ts`, `geometry.ts`, the `*Text.ts` and `*Form.ts` helpers) use type-only RN imports, so their tests run in Node.
- **New root files.** A new root-level file must be added to the `.gitignore` allowlist. Prefer placing files under `src/`.
- **Dates.**
  - A `DateKey` is a `'YYYY-MM-DD'` calendar day in the phone's time zone (America/New_York). It is not a timestamp. Schedule dates are stored as `DateKey`s.
  - Weeks start on Monday.
  - Never pass Lyfta strings to `new Date(string)` or `Date.parse`. Use `parseLyftaInstant` or `parseLyftaDate` (Task 6). `new Date(iso)` is only for our own normalised UTC strings.
- **Tests.** Jest runs with `TZ=America/New_York` (Task 1).
- **Units.**
  - Storage is always kg.
  - `lyfta.weightUnit` is the **parse unit**. It is a fact about Lyfta's set weights, it is auto-detected (Task 8), and it is not user-editable.
  - `display.weightUnit` is the **display preference** (Task 11). It defaults to the Lyfta account unit.
  - Units are per field. The parse unit applies to set `weight` only. Lyfta's `body_weight` is never used (owner ruling).
- **Volume (Ruling 14).** Volume is always Σ(weight_kg × reps) over completed sets: week totals, per-workout totals, exercise charts and, later, the export. Lyfta's `total_volume` is never displayed; its unit is unverified. Task 6 drops the unused `workout.total_volume_kg` column, and `raw_json` keeps the original.
- **Design rules** (from `ui-guidelines.md`):
  - colours come only from `src/ui/theme/tokens.ts`; hex literals are lint-blocked outside it from Task 13;
  - Geist and Geist Mono fonts;
  - tabular figures on every number;
  - touch targets of at least 44×44 with 8px between them;
  - press feedback scales to 0.98 over 150 ms;
  - bottom sheets instead of `Modal` or `Alert`; skeletons instead of `ActivityIndicator` (both lint-blocked from Task 13);
  - haptics on tab and range changes;
  - no shadows or elevation;
  - cards use radius 20–24 with a 1px `line` border.
- **Chart rules** (dataviz):
  - 2px lines and rounded bar ends;
  - a recessive grid in the `grid` token;
  - one accent series per chart;
  - text in `ink` or `muted`, never in the series colour;
  - one value axis, never dual-axis;
  - a press-and-hold tooltip;
  - an `accessibilityLabel` that summarises the data.
- **Scope.**
  - No muscle maps or muscle data.
  - No nutrition or calories.
  - Body, Activity and Export get empty states only. No Health Connect.
  - The only dependencies added are those in Task 1.
- **Device.**
  - The device is a Pixel 10 Pro XL, adb serial `59180DLCQ00B36`.
  - **Never uninstall the app**, because SecureStore holds the key. If an install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, stop and report BLOCKED.
  - Never type the key through adb.
  - Screenshots go only to the scratchpad `shots/` folder.

### Carried over from Plan 1's final review

| # | Item | Task |
|---|---|---|
| 1 | Cap Retry-After at 120 s, and treat an empty header as absent | 10 |
| 2 | Re-parse every stored `raw_json` when the parse unit changes (and when the parser version changes) | 8 |
| 3 | Settings → Re-sync is a full re-backfill, which retries skipped workouts | 12, 17 |
| 4 | Show sync status: skipped count, deletions paused and why, last error, last success | 9, 17, 18 |
| 5 | A failed ROLLBACK no longer masks the original error | 2 |
| 6 | Document that plain statements are not queued behind a transaction; UI writes and multi-statement reads run in `transaction` | 2, 8, 11 |
| 7 | Record Lyfta date and duration formats as patterns before parsing them; no engine date parsing | 3, 6 |
| 8 | Plan 2 parsers treat every field as optional | 6, 10 |
| 9 | A memoised singleton container (no second container or runner on remount or Fast Refresh) | 12 |
| 10 | `migrate`: a foreign-keys-off step option with `foreign_key_check`; throw on a database newer than the app | 2 |
| 11 | `describeShape`: collapse value-like keys and fix the `$union` re-merge before re-probing | 3 |
| 12 | `.gitignore` gains `*.db`, `*.db-*`, `*.sqlite*`, `*.pcap`, `*.pcapng` | 1 |
| 13 | `android.blockedPermissions`: READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW | 1 |
| 14 | `format:check` in the pre-commit gate (above) | all |
| 15 | Build and smoke-test a release APK with no Metro and Hermes bytecode | 21 |
| 16 | Use `src/bootstrap/` everywhere, never `src/app/` | all |
| 17 | A hard page cap in the backfill and the deletion-confirmation listing | 9 |
| 18 | Stalled deletions are visible, and the full listing is not repeated while the candidates are unchanged | 9, 17 |

## Review Focus

1. **Workouts near local midnight and across the DST change.** A Sunday 23:30 New York workout belongs to that Sunday's week, including the week of 2026-11-01 when DST ends. It must not slide into the next week the way it would under UTC bucketing. → Task 7, `a Sunday 23:30 workout stays in its week across the DST change`.
2. **A pound account.** Whole pounds round-trip on screen ("135 lb", never "134.9 lb"). Switching the display unit never rewrites stored kg. A detected parse-unit change re-converts every stored workout from `raw_json`. → Task 4, `formatWeight round-trips whole pounds`; Task 8, `converts stored workouts again when the unit changed`.
3. **Sets that cannot be scored.** These are sets that are not completed, have an empty or zero weight, empty reps, more than 12 reps (for 1RM), or are cardio. They never produce NaN, a volume, a PR or a 1RM, but they still display. → Task 5, `uncompleted, weightless and rep-less sets never count`; Task 18, `describeSetChip` cases.
4. **Thin data.** This covers no key, the first backfill still running, zero workouts, an exercise with one session, flat values and an empty schedule. The result is empty states or skeletons and finite chart domains, never a crash or a NaN axis. → Task 15, `a flat or single-point series gets a finite domain`; Task 18, `empty history gives an empty overview`.
5. **Settings actions overlapping a sync.** Wipe or Re-sync can be tapped mid-sync, and a settings write can land during the sync's upsert transaction. Wipe must leave no data behind, and the setting must survive a rollback of the sync transaction. → Task 12, `wipe waits for an in-flight run, then leaves no synced data`; Task 2, `a settings write survives another transaction's rollback`.

## Conventions

- **Unit test steps.** Run `npx jest <path>`. Before implementing, the expected result is FAIL (module or export missing). After implementing, the expected result is PASS. These steps are listed once per task as "Run → FAIL" and "Run → PASS".
- **Commit step.** Run the pre-commit gate, run `git add <the task's files>`, check `git diff --cached`, then `git commit -m "<message>"`.
- **On-device JS check** (UI tasks, after Task 1's native build). The controller or the assigned implementer drives the phone over adb:
  ```bash
  SP=/private/tmp/claude-501/-Users-jereenvalsson-personal/a171047d-208a-4e7c-8069-cf7aad7e0aaa/scratchpad
  mkdir -p "$SP/shots"; export ANDROID_HOME=… JAVA_HOME=… PATH=…   # Global Constraints
  npx expo start --dev-client --port 8081        # background
  adb -s 59180DLCQ00B36 reverse tcp:8081 tcp:8081
  adb -s 59180DLCQ00B36 shell am start -n com.jereenv.healthhub/.MainActivity
  adb -s 59180DLCQ00B36 exec-out screencap -p > "$SP/shots/<task>-<name>.png"
  adb -s 59180DLCQ00B36 shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml "$SP/shots/"   # find tap targets
  adb -s 59180DLCQ00B36 shell input tap <x> <y>     # long press: input swipe x y x y 800
  adb -s 59180DLCQ00B36 shell cmd uimode night      # read the current mode first; restore it at the end
  adb -s 59180DLCQ00B36 shell cmd uimode night yes|no
  adb -s 59180DLCQ00B36 logcat -d -s ReactNativeJS:V | tail -50
  ```
  Expected for every check: no red error screen, and no `ReactNativeJS` errors in logcat.

---

### Task 13: Theme runtime and atomic components

**Files:**
- Create:
  - `src/ui/theme/typography.ts`, `src/ui/theme/ThemeProvider.tsx`, `src/ui/haptics.ts`;
  - `src/ui/components/` `AppText.tsx`, `PressableScale.tsx`, `Card.tsx`, `iconPaths.ts`, `Icon.tsx`, `IconButton.tsx`, `Button.tsx`, `ScreenHeader.tsx`, `DetailHeader.tsx`, `StatCard.tsx`, `StatGroup.tsx`, `ActionRow.tsx`, `SectionCard.tsx`, `Skeleton.tsx`, `SegmentedControl.tsx`, `EmptyState.tsx`;
  - `app/dev-gallery.tsx`.
- Modify: `app/_layout.tsx`, `src/bootstrap/ContainerContext.tsx`, `eslint.config.js`
- Test: `src/ui/theme/typography.test.ts`

**Interfaces:**
- Consumes: `COLORS`, `RADIUS`, `SPACE`, `MOTION`, `TOUCH_MIN` (Task 1).
- Produces:
```ts
// typography.ts (type-only RN import)
export type TextVariant = 'display' | 'hero' | 'heroUnit' | 'title' | 'heading' | 'stat' | 'body' | 'bodyStrong'
  | 'label' | 'caption' | 'micro' | 'section' | 'mono';
export const TYPE: Readonly<Record<TextVariant, TextStyle>>;
export function tracking(fontSize: number, em: number): number;   // em × size
// ThemeProvider.tsx
export interface Theme { scheme: ColorScheme; colors: ThemeColors }
export function ThemeProvider(p: { children: React.ReactNode }): React.JSX.Element;
export function useTheme(): Theme;
// haptics.ts
export function selectionHaptic(): void;   // Haptics.selectionAsync, errors swallowed
// components (props)
AppText: TextProps & { variant: TextVariant; color?: 'ink' | 'muted' | 'accentInk' | 'onAccent' | 'statusHigh'; numeric?: boolean }
PressableScale: PressableProps & { style?: StyleProp<ViewStyle> }
Card: ViewProps & { surface?: 'card' | 'raised'; radius?: 'card' | 'tile'; padded?: boolean }
Icon: { name: IconName; size?: number; color: string; strokeWidth?: number }
IconButton: { icon: IconName; accessibilityLabel: string; onPress: () => void }
Button: { label: string; onPress: () => void; variant: 'primary' | 'secondary' | 'destructive' | 'plain'; disabled?: boolean }
ScreenHeader: { title: string; subtitle?: string; subtitleTone?: 'muted' | 'warning'; right?: React.ReactNode }
DetailHeader: { title: string; right?: React.ReactNode }            // back chevron calls router.back()
StatCard: { label: string; value: string; unit?: string; caption?: string; onPress?: () => void }
StatGroup: { items: readonly { label: string; value: string; unit?: string }[] }
ActionRow: { title: string; subtitle?: string; subtitleTone?: 'muted' | 'warning'; value?: string; leading?: React.ReactNode;
  trailing?: 'chevron' | 'none'; onPress?: () => void; disabled?: boolean; destructive?: boolean; divider?: boolean;
  accessibilityLabel?: string }
SectionCard: { label?: string; right?: React.ReactNode; children: React.ReactNode }
Skeleton: { width: number | `${number}%`; height: number; radius?: number }
SegmentedControl<T extends string>: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void;
  accessibilityLabel: string }
EmptyState: { icon: IconName; title: string; body: string; action?: { label: string; onPress: () => void } }
export type IconName = 'home' | 'body' | 'dumbbell' | 'activity' | 'export' | 'settings' | 'chevronRight' | 'chevronLeft'
  | 'chevronDown' | 'trophy' | 'info' | 'check' | 'bulb' | 'calendar';
```

**Decisions.**

- **Type scale** (from the mockups). Every variant uses Geist except `mono`, which uses GeistMono. Line height is shown as size/line height.

  | Variant | Size | Weight | Tracking | Notes |
  |---|---|---|---|---|
  | `display` | 34/40 | 700 | −0.02em | |
  | `hero` | 64/64 | 600 | −0.035em | tabular |
  | `heroUnit` | 24 | 500 | | |
  | `title` | 20/26 | 600 | −0.01em | |
  | `heading` | 17/22 | 600 | −0.01em | |
  | `stat` | 24/30 | 600 | −0.02em | tabular |
  | `body` | 15/21 | 400 | | |
  | `bodyStrong` | 15/21 | 600 | | |
  | `label` | 13/18 | 500 | | |
  | `caption` | 12/16 | 500 | | |
  | `micro` | 11/14 | 500 | | |
  | `section` | 13/18 | 600 | +0.02em | uppercase via the component |
  | `mono` | 13/18 | 400 | | GeistMono |

  The `numeric` prop adds `fontVariant: ['tabular-nums']`.
- **Icons.** Copy the SVG geometry verbatim from the mockups:
  - home, body, dumbbell, activity, export: the tab bar in `Main.dc.html`;
  - settings (sliders): the Today header;
  - chevrons, trophy, info, check and bulb: `Workouts.dc.html` and `BodyFat.dc.html`;
  - calendar: a 24-grid `rect` plus two ticks in the same 1.8 stroke style.
- **`ThemeProvider`.**
  - The scheme comes from `useColorScheme()`, falling back to `'dark'`.
  - On scheme change, call `SystemUI.setBackgroundColorAsync(colors.bg)`.
  - Render `<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />`.
- **`PressableScale`.** A Reanimated shared value runs `withTiming(0.98 / 1, { duration: 150 })` on press in and out. `accessibilityRole` defaults to `'button'`.
- **`Skeleton`.** Opacity pulses 1 → 0.35 → 1 over 1600 ms using the `track` colour. When `useReducedMotion()` is on, it stays static.
- **`SegmentedControl`.** This is the BodyFat mockup tablist:
  - a `card` pill with a 4px inset and 40px items;
  - the selected item is `accent` with `onAccent` 14/600 text, and the others are `muted`;
  - `accessibilityRole` is `'tab'`, with `accessibilityState.selected`;
  - `selectionHaptic()` fires only when the value changes.
- **Button variants.**
  - `primary`: `accent` fill.
  - `secondary`: `raised` with a `line` border.
  - `destructive`: `raised` surface with a `statusHigh` border and text. The tokens have no red, and none is invented.
  - `plain`: `accentInk` text.
  
  Every button is at least 44 tall and fully rounded.
- **`ScreenHeader`.** The top padding is the safe-area top plus 16. The subtitle (`label`, muted, or `statusHigh` for warning) sits above the `display` title.
- **`DetailHeader`.** A 44-tall row: a 44×44 back button, then a centred `heading` title.
- **`app/_layout.tsx` provider order:** `GestureHandlerRootView` → `ThemeProvider` → `ContainerProvider` → `Stack` with `headerShown: false` and `contentStyle` set to the `bg` colour.
- **`ContainerProvider`.** Loading shows `Skeleton` blocks shaped like a header and two cards. Failure shows `EmptyState` with "Try again".
- **ESLint.**
  - `no-restricted-imports` blocks `Alert`, `ActivityIndicator` and `Modal` from `react-native`, with a message pointing to `docs/design/ui-guidelines.md`.
  - `no-restricted-syntax` blocks string literals matching `/^#[0-9a-fA-F]{3,8}$/` in `app/**` and `src/ui/**`, except `src/ui/theme/tokens.ts`.
- **Dev gallery.** `app/dev-gallery.tsx` renders `<Redirect href="/" />` when `!__DEV__`. Otherwise it shows every component, in both press states where that matters.

- [ ] **Step 1: Write the failing test**

```ts
test('display is 34/40 bold with -0.02em tracking', () =>
  expect(TYPE.display).toMatchObject({ fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.68 }));
test('hero and stat use tabular figures', () => {
  expect(TYPE.hero.fontVariant).toContain('tabular-nums'); expect(TYPE.stat.fontVariant).toContain('tabular-nums');
});
test('every variant uses Geist or Geist Mono', () =>
  Object.values(TYPE).forEach((s) => expect(['Geist', 'GeistMono']).toContain(s.fontFamily)));
```

- [ ] **Step 2: Run → FAIL**, then **implement** everything above, then **Run → PASS** and the full gate. The new lint rules must pass, which proves no spinner, `Alert` or hex literal is left.

- [ ] **Step 3: On-device JS check**

```bash
adb -s 59180DLCQ00B36 shell am start -W -a android.intent.action.VIEW -d "healthhub://dev-gallery" com.jereenv.healthhub
```
Take screenshots in dark and light mode. Expected:
- text is in Geist (compare the "1" and "8" widths in a `stat` row: equal);
- the press scale is visible on a long press;
- the skeleton pulses;
- the segmented control switches value.

- [ ] **Step 4: Commit**: `git add src/ui app/_layout.tsx app/dev-gallery.tsx src/bootstrap/ContainerContext.tsx eslint.config.js` → "Add theme runtime and atomic UI components"

---

### Task 14: Bottom sheet

**Files:**
- Create: `src/ui/components/sheetGesture.ts`, `src/ui/components/SheetHost.tsx`, `src/ui/components/BottomSheet.tsx`
- Modify: `app/_layout.tsx`, `app/dev-gallery.tsx`
- Test: `src/ui/components/sheetGesture.test.ts`

**Interfaces:**
- Produces:
```ts
// sheetGesture.ts
export const DISMISS_DISTANCE = 120; export const DISMISS_VELOCITY = 800;
export function shouldDismiss(translationY: number, velocityY: number): boolean;
// SheetHost.tsx — wraps the Stack; owns the BlurTargetView and renders the active sheet above it
export function SheetHost(p: { children: React.ReactNode }): React.JSX.Element;
// BottomSheet.tsx — declarative; renders nothing in place, its content appears in the host
export function BottomSheet(p: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }): null;
```

**Decisions.**

- **Why not `Modal`.** Android can't blur another window, so an RN `Modal` (a separate dialog window) can't blur the app behind it. Instead, `SheetHost` wraps the navigator in expo-blur's `BlurTargetView` and renders a sibling overlay:
  - a `BlurView` with `blurTarget` set to the host's ref, `blurMethod="dimezisBlurViewSdk31Plus"`, `intensity` 40 and `tint` by scheme;
  - a `scrim` layer;
  - the sheet.
- **Content updates.** `BottomSheet` registers its `children` with the host in a layout effect on every render, so content updates live. The host shows one sheet at a time. Sheet content must not depend on navigation context.
- **Sheet surface and motion.**
  - The surface is `raised`, with top radius 24 and a 1px `line` top border.
  - The drag handle is 36×5, `muted` at 40% opacity, with radius 3.
  - The bottom padding is the safe-area bottom plus 16, plus `useAnimatedKeyboard().height`, so an input stays above the keyboard.
  - The sheet slides with `withTiming(…, { duration: MOTION.sheetMs })`.
  - A `Gesture.Pan()` on the handle and title area closes it when `shouldDismiss(...)` is true. A backdrop tap closes it, and so does the Android back button (`BackHandler` while open).
- **Accessibility.** The sheet has `accessibilityViewIsModal`. The target view gets `importantForAccessibility="no-hide-descendants"` while a sheet is open.

- [ ] **Step 1: Write the failing test**

```ts
test.each([[130, 0, true], [40, 900, true], [40, 200, false], [-50, -1000, false]])(
  'shouldDismiss(%p, %p) = %p', (t, v, e) => expect(shouldDismiss(t, v)).toBe(e));
```

- [ ] **Step 2: Run → FAIL**, then **implement**, then **Run → PASS** and the full gate.

- [ ] **Step 3: On-device JS check.** Add a gallery demo: a sheet containing a `TextInput` and a `Button`. Expected:
- the backdrop is visibly blurred in both modes;
- a drag down closes it, and so do a backdrop tap and the back button;
- the input stays above the keyboard.

- [ ] **Step 4: Commit**: `git add src/ui/components app/_layout.tsx app/dev-gallery.tsx` → "Add blurred bottom sheet"

---

### Task 15: Charts

**Files:**
- Create: `src/ui/charts/geometry.ts`, `src/ui/charts/TrendChart.tsx`, `src/ui/charts/Sparkline.tsx`, `src/ui/charts/HeatStrip.tsx`
- Modify: `app/dev-gallery.tsx`
- Test: `src/ui/charts/geometry.test.ts`

**Interfaces:**
- Consumes: `HeatCell` and `summarizeHeatStrip` (Task 7).
- Produces:
```ts
// geometry.ts
export interface PlotBox { width: number; height: number; top: number; bottom: number; left: number; right: number }
export interface ValueDomain { min: number; max: number; ticks: readonly [number, number, number] } // ascending
export function valueDomain(values: readonly number[], opts: { includeZero: boolean }): ValueDomain;
export function xPositions(count: number, box: PlotBox, kind: 'line' | 'bar'): number[];
export function yScale(domain: ValueDomain, box: PlotBox): (value: number) => number;
export function linePath(xs: readonly number[], ys: readonly number[]): string;
export function barPath(cx: number, bandWidth: number, yTop: number, yBase: number): string; // top r 4, bottom r 2, clamped
export function nearestIndex(xs: readonly number[], touchX: number): number;  // -1 when empty
export function axisLabelIndexes(count: number): number[];                    // first, middle, last; unique
export function describeSeries(title: string, caption: string, values: readonly number[],
  formatValue: (v: number) => string): string;
// TrendChart.tsx
export interface ChartDatum { key: string; value: number; tooltipLabel: string; axisLabel: string }
export function TrendChart(p: { kind: 'line' | 'bar'; data: readonly ChartDatum[]; formatValue: (v: number) => string;
  title: string; caption: string; height?: number; showValueAxis?: boolean; highlightLast?: boolean }): React.JSX.Element;
export function Sparkline(p: { values: readonly number[]; width: number; height: number; accessibilityLabel: string }): React.JSX.Element;
export function HeatStrip(p: { columns: readonly HeatCell[][] }): React.JSX.Element;
```

**Decisions.**

- **Why custom SVG.** The charts are custom `react-native-svg` rather than Skia or Victory Native. The datasets are tiny (no more than about 400 points). The dataviz rules need exact control. Skia adds a heavy native dependency. Spec §18.5 allows an SVG fallback.
- **Domain.**
  - Lines: [min − 10% of span, max + 10% of span]. A flat series uses a span of `max(1, |v| × 0.05)` either side.
  - Bars: [0, max × 1.1].
  - Empty data, or bars whose max is 0: [0, 1].
  - Ticks are [min, mid, max].
- **Rendering.**
  - **Line:** `accentInk`, 2px, round caps and joins. Dots appear only when there are 31 points or fewer: radius 3.5, `accentInk` fill, 2px `card` stroke.
  - **Bars:** `bar` fill, except the last bar, which is `accent` when `highlightLast` is set. Band gap 6.
  - **Grid:** 3 lines in `grid`, 1px.
  - **Value axis:** labels on the right only, `micro`, `muted`, tabular. The x-axis shows the `axisLabelIndexes` labels.
- **Press and hold.**
  - `Gesture.LongPress().minDuration(200)` combined with `Gesture.Pan().activateAfterLongPress(200)` selects `nearestIndex`.
  - The selection draws a dashed (2 3) `muted` rule, a 12px `ink` dot with a 2px `card` stroke, and a `raised` bubble with a `line` border: the `tooltipLabel` in `micro` `muted`, the value in `micro` 600 `ink`.
  - On release, the selection stays until the next tap or until the data changes.
- **Animation.** On data change, the plot fades in over 250 ms (Reanimated opacity).
- **Accessibility.** The wrapper `View` is `accessible`, with `accessibilityRole="image"` and `accessibilityLabel = describeSeries(...)`.
- **`HeatStrip`.**
  - 12 columns × 7 square cells with a 3px gap and radius 3.
  - Level 0 is `track`. Levels 1–4 are `accentInk` at opacities 0.3, 0.5, 0.75 and 1.0. Future days are empty.
  - A legend reads "Less ▢▢▢▢▢ More".
  - Its label is "Trained on N of M days in the last 12 weeks".

- [ ] **Step 1: Write the failing tests**

```ts
test('empty data gives a safe 0–1 domain', () =>
  expect(valueDomain([], { includeZero: false })).toMatchObject({ min: 0, max: 1 }));
test('a flat or single-point series gets a finite domain', () => {
  const d = valueDomain([99, 99], { includeZero: false });
  expect(d.min).toBeLessThan(99); expect(d.max).toBeGreaterThan(99); expect(d.ticks[1]).toBeCloseTo(99);
  expect(Number.isFinite(valueDomain([0], { includeZero: false }).max)).toBe(true);
});
test('bars start at zero with 10% headroom', () =>
  { const d = valueDomain([10, 20], { includeZero: true }); expect(d.min).toBe(0); expect(d.max).toBeCloseTo(22, 9); });
test('line x positions span the plot; a single point is centred');
test('nearestIndex picks the closest point and clamps outside touches');
test('barPath clamps corner radii on short bars', () => {
  const p = barPath(50, 20, 99, 100); expect(p).not.toContain('NaN');
});
test.each([[0, []], [1, [0]], [2, [0, 1]], [8, [0, 3, 7]]])('axisLabelIndexes(%p)', (n, e) =>
  expect(axisLabelIndexes(n)).toEqual(e));
test('describeSeries summarises first, last and highest', () => {
  expect(describeSeries('Weekly volume', 'last 8 weeks', [24.1, 31, 27.4], (v) => `${v.toFixed(1)} t`))
    .toBe('Weekly volume, last 8 weeks: from 24.1 t to 27.4 t, highest 31.0 t.');
  expect(describeSeries('Weekly volume', 'last 8 weeks', [], String)).toBe('Weekly volume, last 8 weeks: no data yet.');
});
```

- [ ] **Step 2: Run → FAIL**, then **implement**, then **Run → PASS** and the full gate.

- [ ] **Step 3: On-device JS check.** The gallery shows a line chart, a bar chart, a sparkline and a heat strip, each with fixed sample data. Expected:
- the chart rules hold in both modes;
- a long press (`input swipe x y x y 800`) shows the tooltip;
- TalkBack-style `uiautomator dump` shows each chart's `content-desc` summary.

- [ ] **Step 4: Commit**: `git add src/ui/charts app/dev-gallery.tsx` → "Add SVG trend, sparkline and heat strip charts"

---

### Task 16: App shell: tabs, empty states and launch sync

**Files:**
- Create:
  - routes:
    - `app/(tabs)/_layout.tsx`;
    - Today stack: `app/(tabs)/(today)/_layout.tsx`, `app/(tabs)/(today)/index.tsx`, `app/(tabs)/(today)/settings.tsx`;
    - single-screen tabs: `app/(tabs)/body.tsx`, `app/(tabs)/activity.tsx`, `app/(tabs)/export.tsx`;
    - Workouts stack: `app/(tabs)/workouts/_layout.tsx`, `app/(tabs)/workouts/index.tsx`;
  - navigation: `src/ui/navigation/tabItems.ts`, `src/ui/navigation/TabBar.tsx`, `src/ui/navigation/useTabBarInset.ts`;
  - data hooks: `src/ui/data/useAsyncData.ts`, `src/ui/data/useSyncSnapshot.ts`, `src/ui/data/usePreferences.ts`;
  - `src/ui/screens/placeholders/` `TodayScreen.tsx`, `BodyScreen.tsx`, `ActivityScreen.tsx`, `ExportScreen.tsx`;
  - stubs replaced in later tasks: `src/ui/screens/settings/SettingsScreen.tsx` (Task 17), `src/ui/screens/workouts/WorkoutsScreen.tsx` (Task 18).
- Modify: `app/_layout.tsx` (Stack: `(tabs)`, `dev-gallery`; `LaunchSync`)
- Delete: `app/index.tsx`. This is the planned replacement of Plan 1's temporary developer screen; Settings → Re-sync replaces its "Full re-sync".

**Interfaces:**
- Consumes: `getAppContainer`, `SyncCoordinator`, `PreferencesStore` (Tasks 11–12); the components (Task 13).
- Produces:
```ts
export const TAB_ITEMS: readonly { route: '(today)' | 'body' | 'workouts' | 'activity' | 'export'; label: string; icon: IconName }[];
export function TabBar(props: BottomTabBarProps): React.JSX.Element;   // from 'expo-router/js-tabs'
export function useTabBarInset(): number;                              // content bottom padding = bar height + 24
export type AsyncState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };
export function useAsyncData<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T>; // ignores stale results
export function useSyncSnapshot(): SyncSnapshot;     // useSyncExternalStore(sync.subscribe, sync.getSnapshot)
export function usePreferences(): Preferences;
```

**Decisions.**

- **Navigation imports.** `Tabs` and the `BottomTabBarProps` type come from `'expo-router/js-tabs'`, because importing `Tabs` from `'expo-router'` is deprecated in SDK 57.
- **Routes.** Workouts detail routes are nested in the Workouts stack, so the tab bar stays visible (as in the BodyFat mockup). Settings is pushed in the Today stack.
- **`TabBar`.**
  - It is absolutely positioned at the bottom, with a `nav` background (no live blur, because the bar lives inside the navigator), a 1px `line` top border, 8px top padding and the safe-area bottom plus 8.
  - There are 5 equal items, each at least 52 tall: a 56×30 pill with a 20px icon and an 11px label.
  - The active item has an `accent` pill, an `onAccent` icon with stroke 2, and an `ink` 600 label. Inactive items are `muted`, with stroke 1.8 and weight 500.
  - On press, emit `tabPress`. If the tab isn't already focused, call `selectionHaptic()` and navigate.
  - Each item has `accessibilityRole="tab"` and a selected state.
- **`LaunchSync`.** A child of `ContainerProvider` that calls `sync.run()` once on mount. StrictMode remounts share the in-flight run.
- **Today.** `ScreenHeader` with subtitle `formatWeekdayLong(today)`, title "Today", and an `IconButton` with the settings icon that pushes `/settings`. Then an `EmptyState`.
- **Empty-state copy:**

  | Tab | Title | Body | Action |
  |---|---|---|---|
  | Today | "Your day at a glance" | "Weigh-ins, sleep and steps appear here once the scale and Health Connect are connected." | "See workouts" |
  | Body | "No weigh-ins yet" | "Body metrics arrive when the scale and Health Connect are connected." | |
  | Activity | "No activity yet" | "Steps, sleep and heart rate arrive when Health Connect is connected." | |
  | Export | "Export is on its way" | "Soon you can send a summary of your progress to ChatGPT from here." | |

- [ ] **Step 1: Implement** the routes and components above, following the interfaces and decisions. Run the full gate, including the existing tests.

- [ ] **Step 2: On-device JS check.** Expected:
- the app opens on Today, with no spinner at any point;
- the tab bar shows the accent pill on the active tab, and each tab switch changes the pill and gives a haptic tick (owner confirms the haptic);
- the settings button opens the stub and back returns to Today;
- the dark and light screenshots match the mockups' bar and header;
- `logcat` shows one Lyfta sync at launch (no duplicate requests in the `ReactNativeJS` output).

- [ ] **Step 3: Commit**: `git add app src/ui && git rm app/index.tsx` → "Replace the developer screen with the tab shell"

---

### Task 17: Settings

**Files:**
- Create:
  - `src/ui/sync/syncStatusText.ts`;
  - `src/ui/screens/settings/profileForm.ts`;
  - `src/ui/screens/settings/` `LyftaKeySheet.tsx`, `ProfileSheet.tsx`, `WipeSheet.tsx`, `AboutSheet.tsx`.
- Modify: `src/ui/screens/settings/SettingsScreen.tsx`
- Test: `src/ui/sync/syncStatusText.test.ts`, `src/ui/screens/settings/profileForm.test.ts`

**Interfaces:**
- Consumes: `SyncState` and `DeletionPause` (Task 9); `ProfileRepository` and `PreferencesStore` (Task 11); `SyncCoordinator` (Task 12); the components and `BottomSheet` (Tasks 13–14).
- Produces:
```ts
// syncStatusText.ts
export interface SyncStatusInput { state: SyncState; running: boolean; hasKey: boolean; now: Date; noun: 'workout' | 'scheduled workout' }
export interface SyncStatusLine { text: string; tone: 'muted' | 'warning' }
export function describeSyncStatus(input: SyncStatusInput): SyncStatusLine;     // one line, for headers and rows
export function describeSyncDetails(input: SyncStatusInput): SyncStatusLine[];  // all lines, for Settings
// profileForm.ts
export interface ProfileForm { height: string; birthDate: string; sex: Sex | null; goalWeight: string; bmiCutoffs: BmiCutoffs }
export function profileToForm(profile: Profile | null, unit: WeightUnit): ProfileForm;
export function formToProfileInput(form: ProfileForm, unit: WeightUnit, today: DateKey):
  { input: ProfileInput; errors: ProfileError[] };
```

**`describeSyncStatus` priority.** The first match wins:

| Condition | Text | Tone |
|---|---|---|
| no key | "Lyfta not connected" | warning |
| running | "Syncing…" | muted |
| `lastError === 'invalid_key'` | "Lyfta rejected the key" | warning |
| other `lastError` | "Sync failed " + `formatRelativeTime(lastErrorAt)` | warning |
| `deletionPause` reason `unreadable` | "N workouts couldn't be read · deletions paused" | warning |
| `deletionPause` reason `error` | "Deletion check failed · retrying next sync" | warning |
| `lastSkipped > 0` | "N workouts couldn't be read" | warning |
| `lastSuccessAt` set | "Synced " + relative time | muted |
| otherwise | "Not synced yet" | muted |

`describeSyncDetails` lists every line that applies:
- "Last synced …";
- the last error, with its message;
- for a pause: "Deletions from Lyfta are paused: N workouts there can't be read. Re-sync retries them."

**Screen sections** (top to bottom).

`DetailHeader` "Settings", then these sections, each a `SectionCard` of `ActionRow`s:

1. **Connections.**
   - "Lyfta": the subtitle is "Key saved" / "No key", or "Key rejected" (warning). It opens `LyftaKeySheet`.
   - "Senssun account", "Health Connect" and "Scale pairing" are disabled rows with the subtitle "Coming later".
2. **Units.**
   - "Weight unit": a `SegmentedControl` (kg | lb) wired to `setDisplayWeightUnit`.
   - The caption reads "Lyfta reports weights in lb · stored as kg on this phone", with the unit taken from `lyftaAccountUnit`.
3. **Profile.**
   - Rows: Height (`formatHeight`), Birth date (`formatFullDate` plus the age), Sex, Goal weight (in the display unit) and BMI ranges ("WHO standard" / "WHO Asian").
   - Unset fields show "Not set". Any row opens `ProfileSheet`.
   - The caption reads "Used for body estimates in a later update. Stays on this phone."
4. **Data.**
   - "Lyfta workouts" and "Lyfta schedule": the subtitle is `describeSyncStatus` and the value is the count. Tapping shows `describeSyncDetails` inline (an expanded row).
   - "Re-sync from Lyfta" calls `sync.resync()`; it is disabled while running and its subtitle reads "Downloads your full history again".
   - "Wipe local data" (destructive) opens `WipeSheet`.
5. **About.**
   - "Formula sources" opens `AboutSheet`: "Estimated 1-rep max: Epley, weight × (1 + reps ÷ 30), from completed sets of 1–12 reps."
   - The note "Health Hub shows estimates for personal tracking. It is not medical advice."
   - The app version (`expo-constants`).

**Sheet rules.**

- **`LyftaKeySheet`.**
  - Never shows the key, not even masked.
  - The field is a `TextInput` with `secureTextEntry`, `autoCapitalize="none"`, `autoCorrect={false}` and `importantForAutofill="no"`.
  - "Save key" is disabled while the trimmed value is empty. On save, clear the field **before** awaiting `secrets.set`, then close the sheet and start `sync.run()` without awaiting it.
  - "Remove key" is a two-step confirm inside the sheet: "Remove the key? Syncing stops until you add one."
- **`WipeSheet`.**
  - Title "Wipe local data?". Body: "Deletes all workouts, schedule and sync history from this phone. Your Lyfta key, profile and settings stay. Re-sync brings the data back."
  - A destructive "Wipe data" button, disabled while running, which calls `sync.wipe()` and then closes.
  - A plain "Cancel".
- **`ProfileSheet`.**
  - Fields: height in cm (`numeric` keyboard); birth date as "YYYY-MM-DD" (`numbers-and-punctuation`); sex as a `SegmentedControl` (Female | Male); goal weight in the display unit; BMI ranges as a `SegmentedControl`.
  - Inline errors appear per field.
  - Save calls `profile.save(input, now)`.
- **No system alerts anywhere.**

- [ ] **Step 1: Write the failing tests**

```ts
test.each([
  // [description, input overrides, expected text, tone]
  ['no key', { hasKey: false }, 'Lyfta not connected', 'warning'],
  ['running', { running: true }, 'Syncing…', 'muted'],
  ['invalid key', { state: { lastError: 'invalid_key' } }, 'Lyfta rejected the key', 'warning'],
  ['failure', { state: { lastError: 'Could not reach Lyfta (network error or timeout)', lastErrorAt: TWO_H_AGO } }, 'Sync failed 2 h ago', 'warning'],
  ['paused', { state: { lastSuccessAt: NOW, deletionPause: { reason: 'unreadable', candidateIds: [7], skipped: 2 } } },
    "2 workouts couldn't be read · deletions paused", 'warning'],
  ['ok', { state: { lastSuccessAt: TWO_MIN_AGO } }, 'Synced 2 min ago', 'muted'],
  ['never', {}, 'Not synced yet', 'muted'],
])('describeSyncStatus: %s', …);
test('describeSyncDetails lists last success, last error and the pause reason');
test('blank profile fields become null');
test('goal weight typed in lb is stored in kg');          // '172' lb → 172 × LB_TO_KG
test('accepts a comma decimal');                          // '82,5' kg → 82.5
test('reports an invalid height and a malformed birth date');
test('a saved profile round-trips through the form');
```

- [ ] **Step 2: Run → FAIL**, then **implement**, then **Run → PASS** and the full gate.

- [ ] **Step 3: On-device JS check.** Expected:
- Lyfta shows "Key saved", and the key text never appears anywhere in the `uiautomator dump`;
- switching the unit changes the caption and gives a haptic tick;
- saving a profile updates the rows;
- each sheet opens with a blur and closes with back;
- the sync rows show "Synced …".

Do **not** wipe, re-sync or remove the key here; Task 21 does it.

- [ ] **Step 4: Commit**: `git add src/ui/sync src/ui/screens/settings` → "Add Settings with key, units, profile and data controls"

---

### Task 18: Workouts overview

**Files:**
- Create:
  - `src/domain/workouts/overview.ts`;
  - `src/ui/screens/workouts/setChipText.ts`;
  - `src/ui/data/WorkoutDataContext.tsx`;
  - `src/ui/screens/workouts/` `SetChip.tsx`, `LatestWorkoutCard.tsx`, `TopLiftCard.tsx`, `UpcomingCard.tsx`, `WeekSection.tsx`, `WorkoutsSkeleton.tsx`.
- Modify: `src/ui/screens/workouts/WorkoutsScreen.tsx`, `app/(tabs)/workouts/_layout.tsx` (wrap the Stack in `WorkoutDataProvider`)
- Test: `src/domain/workouts/overview.test.ts`, `src/ui/screens/workouts/setChipText.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 5 and 7 (format, metrics, records, history, buckets); `ScheduleRepository.listBetween` (Task 10); `listAll` (Task 8); `useSyncSnapshot` and `usePreferences` (Task 16); `describeSyncStatus` (Task 17); the charts (Task 15).
- Produces:
```ts
// overview.ts
export const OVERVIEW_WEEKS = 8; export const TOP_LIFT_DAYS = 56; export const UPCOMING_LIMIT = 5; export const HISTORY_PAGE_WEEKS = 8;
export type WeekLabel = 'this_week' | 'earlier_this_week' | 'last_week' | 'range';
export interface OverviewWeek { weekStart: DateKey; label: WeekLabel; sessions: number; volumeKg: number; durationS: number | null; rows: Workout[] }
export interface TopLift { exerciseId: number; name: string; latestE1rmKg: number; deltaKg: number | null; since: DateKey | null; series: number[] }
export interface WorkoutsOverview { thisWeek: { sessions: number; volumeKg: number; durationS: number | null };
  weeklyVolume: SeriesPoint[]; heat: HeatCell[][]; latest: Workout | null; latestPrCount: number;
  topLift: TopLift | null; upcoming: ScheduledWorkout[]; weeks: OverviewWeek[] }
export function buildWorkoutsOverview(input: { workouts: readonly Workout[]; upcoming: readonly ScheduledWorkout[];
  records: readonly PersonalRecord[]; today: DateKey }): WorkoutsOverview;
// setChipText.ts
export function describeSetChip(set: WorkoutSet, unit: WeightUnit, isPr: boolean):
  { main: string; sub: string; tone: 'plain' | 'pr' | 'dim'; accessibilityLabel: string };
// WorkoutDataContext.tsx — loads once per dataVersion for the whole Workouts stack
export type WorkoutData = { status: 'loading' } | { status: 'error'; message: string }
  | { status: 'ready'; workouts: Workout[]; upcoming: ScheduledWorkout[]; records: PersonalRecord[]; prKeys: ReadonlySet<string> };
export function WorkoutDataProvider(p: { children: React.ReactNode }): React.JSX.Element;
export function useWorkoutData(): WorkoutData;
```

**Model rules.**

- **`weeklyVolume`.** 8 weekly sums, zero-filled, ending with this week.
- **`latest`.** The newest workout. `latestPrCount` is the number of distinct PR sets in it.
- **`topLift`.**
  - Among exercises with a non-null `bestE1rmKg` session in the last 56 days, pick the one with the most sessions; on ties, the most recent wins.
  - `latestE1rmKg` is the latest session's value.
  - When there are at least 2 sessions, `deltaKg` is latest minus first and `since` is the first session's date. Otherwise both are null.
  - `series` is the per-session `bestE1rmKg`, oldest first.
- **`upcoming`.** Items with date ≥ today and `!completed`, soonest first, at most 5.
- **`weeks`.**
  - `groupByWeek` output with `latest` removed from the rows, dropping any group left empty. Group totals still include every workout of that week.
  - Labels:

    | Week | Label |
    |---|---|
    | current week, and the latest workout is in it | `earlier_this_week` |
    | current week otherwise | `this_week` |
    | the previous week | `last_week` |
    | any other week | `range` |
- **`describeSetChip`:**

  | Set | `main` |
  |---|---|
  | weight > 0 and reps ≥ 1 (completed or not) | `formatWeightNumber` + " × " + reps |
  | reps ≥ 1 with no weight | "N reps" |
  | otherwise | "—" |

  - `sub` joins "PR", "RIR n" and "Not done" with " · ". If none apply, it is a single U+00A0, which keeps chip height.
  - `tone` is `pr` for a PR set, `dim` for a set that isn't completed, and `plain` otherwise.
  - `accessibilityLabel` reads like "Set 3, 90 lb × 3, RIR 1, personal record".
- **`WorkoutDataProvider`.** Loads `workouts.listAll()` and `schedule.listBetween(today, today + 28)` via `useAsyncData`, keyed by `dataVersion` and today. `records` (`computePersonalRecords`) and `prKeys` (`prSetKeys`) are computed in a `useMemo`.

**Screen** (top to bottom, following `Workouts.dc.html`).

1. **`ScreenHeader`.** The subtitle is "From Lyfta · " + `describeSyncStatus`, with its tone. The title is "Workouts".
2. **Summary card.**
   - A `StatGroup`: Sessions, Volume (`formatVolume`) and Time (`formatDuration`, or "—").
   - Below it, a `TrendChart` of kind `bar`: height 72, `showValueAxis` false, `highlightLast`. Each point's `axisLabel` is its week start, except the last, which is "This week". The tooltip label is "Week of 9 Nov".
3. **Heat-strip card.** Titled "Last 12 weeks".
4. **`LatestWorkoutCard`.**
   - Meta: `formatRelativeDay` · duration · volume. The title is shown, with a "N PR" accent chip and trophy icon when there are any.
   - For each exercise: the name, "N sets · volume", and a horizontal `ScrollView` of `SetChip`s.
   - Tapping opens `/workouts/<id>`.
5. **`TopLiftCard`.**
   - "<name> · estimated 1-rep max", the value, and `formatSignedDelta` + unit + `formatSinceLabel`, with a 72×32 `Sparkline`.
   - Tapping opens `/workouts/exercise/<id>`.
6. **`UpcomingCard`.**
   - A `SectionCard` titled "UPCOMING". Each row has a dashed 44×44 date tile (weekday letters plus the day number), the title, and `formatRelativeDay`.
   - When there are no items, a single row reads "No upcoming workouts in Lyfta".
7. **`WeekSection`s.**
   - One `SectionCard` per week. The label is "EARLIER THIS WEEK" / "THIS WEEK" / "LAST WEEK" / `formatWeekRange` uppercased. The right side shows "N · volume · duration".
   - Rows: the title, "Wed 11 Nov · 52 min", the volume and a chevron.
   - 8 weeks show at first. A "Show earlier weeks" `Button` (`plain`) adds 8 more each time.
- **Pull to refresh.** A `RefreshControl` calls `sync.run()`, tinted with `accentInk` on `raised`. This is the platform pull gesture, not a loading state.
- **States:**

  | Condition | Shows |
  |---|---|
  | data loading, or 0 workouts while a sync runs | `WorkoutsSkeleton` (the card shapes) with the caption "Fetching your Lyfta history…" |
  | no key | `EmptyState` "Connect Lyfta" → Settings |
  | ready with 0 workouts and not running | `EmptyState` "No workouts on this phone yet" with action "Sync now" |
  | load error | `EmptyState` with "Try again" |

- [ ] **Step 1: Write the failing tests**

```ts
test('empty history gives an empty overview with zeroed week stats');
test("this week's totals include the latest workout");
test('the latest workout is excluded from rows and labels its week Earlier this week');
test('weekly volume has 8 zero-filled weeks ending this week');
test('top lift is the most frequent exercise of the last 56 days, with change since its first session there');
test('upcoming keeps only future, uncompleted items, soonest first, at most 5');
test.each([
  [{ weightKg: 90, reps: 3, rir: 1, completed: true }, 'kg', true, { main: '90 × 3', sub: 'PR · RIR 1', tone: 'pr' }],
  [{ weightKg: null, reps: 12, rir: null, completed: true }, 'kg', false, { main: '12 reps', sub: '\u00a0', tone: 'plain' }],
  [{ weightKg: 135 * LB_TO_KG, reps: 5, rir: 2, completed: false }, 'lb', false, { main: '135 × 5', sub: 'RIR 2 · Not done', tone: 'dim' }],
  [{ weightKg: null, reps: null, rir: null, completed: true }, 'kg', false, { main: '—', sub: '\u00a0', tone: 'plain' }],
])('describeSetChip %#', (set, unit, pr, expected) => expect(describeSetChip(makeSet(set), unit as WeightUnit, pr)).toMatchObject(expected));
```

- [ ] **Step 2: Run → FAIL**, then **implement**, then **Run → PASS** and the full gate.

- [ ] **Step 3: On-device JS check** with the owner's 31 workouts. Expected:
- the header reads "From Lyfta · Synced …";
- the summary and heat strip are filled in;
- the latest card shows the newest workout's exercises, each with a horizontally scrolling row of set chips;
- weights are in lb;
- the week sections expand with "Show earlier weeks" until the row counts plus the latest workout add up to 31;
- pull to refresh syncs;
- a long press on the weekly bars shows the tooltip;
- the layout holds in light mode.

- [ ] **Step 4: Commit**: `git add src/domain/workouts/overview.* src/ui app/(tabs)/workouts/_layout.tsx` → "Build the Workouts overview"

---

### Task 19: Workout detail

**Files:**
- Create: `src/domain/workouts/detail.ts`, `src/ui/navigation/params.ts`, `src/ui/screens/workouts/WorkoutDetailScreen.tsx`, `app/(tabs)/workouts/[workoutId].tsx`
- Test: `src/domain/workouts/detail.test.ts`, `src/ui/navigation/params.test.ts`

**Interfaces:**
- Consumes: `useWorkoutData` and `SetChip` (Task 18); `prSetKey`, `exerciseVolumeKg` and `scoredSetCount` (Task 5).
- Produces:
```ts
export interface WorkoutDetail { lyftaId: number; title: string; date: DateKey; durationS: number | null; volumeKg: number;
  exerciseCount: number; setCount: number; prCount: number;   // setCount = every set, done or not exercises: { exerciseId: number; position: number; name: string; scoredSets: number; volumeKg: number;
  sets: { set: WorkoutSet; isPr: boolean }[] }[] }
export function buildWorkoutDetail(workout: Workout, prKeys: ReadonlySet<string>): WorkoutDetail;
export function parseIdParam(param: string | string[] | undefined): number | null; // positive integer only
```

**Screen.**

- `DetailHeader` with the title `formatShortDate(date)`.
- The workout title in `title`, then the meta "N exercises · M sets · duration · volume · K PRs", then one `Card` per exercise:
  - the name and a chevron, which opens `/workouts/exercise/<exerciseId>`;
  - "N sets · volume";
  - **every** set as a `SetChip` in a wrapping row (`flexWrap`).
- A footnote in `caption` `muted`: "PR: heavier than any earlier session of this exercise, or a higher estimated 1-rep max."
- An unknown or invalid id shows `EmptyState` "Workout not found", with back.

- [ ] **Step 1: Write the failing tests**

```ts
test('marks PR sets and counts each PR set once');
test('exercise meta counts scored sets and their volume');
test('counts every exercise and set, including sets not done');
test.each([['42', 42], [['42'], 42], ['4.2', null], ['-1', null], ['abc', null], [undefined, null]])(
  'parseIdParam(%p) = %p', (p, e) => expect(parseIdParam(p)).toBe(e));
```

- [ ] **Step 2: Run → FAIL**, then **implement**, then **Run → PASS** and the full gate.

- [ ] **Step 3: On-device JS check.** Open the newest workout. Expected:
- the meta reads "12 exercises · 56 sets" and 12 exercise cards are present;
- the PR chips are accent-filled;
- an exercise chevron opens its progress route (a placeholder until Task 20, which is acceptable);
- back returns to Workouts with the tab bar visible throughout.

- [ ] **Step 4: Commit**: `git add src/domain/workouts/detail.* src/ui app/(tabs)/workouts` → "Add workout detail with every set and PRs"

---

### Task 20: Exercise progress

**Files:**
- Create: `src/domain/workouts/progress.ts`, `src/ui/screens/workouts/chartData.ts`, `src/ui/screens/workouts/ExerciseProgressScreen.tsx`, `app/(tabs)/workouts/exercise/[exerciseId].tsx`
- Test: `src/domain/workouts/progress.test.ts`, `src/ui/screens/workouts/chartData.test.ts`

**Interfaces:**
- Consumes: `exerciseSessions` (Task 7); `bucketSeries` and `fillEmptyBuckets` (Task 7); `TrendChart` (Task 15); `SegmentedControl` and `BottomSheet` (Tasks 13–14).
- Produces:
```ts
export const RANGE_WINDOWS: { day: 30; week: 12 };   // days / weeks back; month = all history
export interface ExerciseProgress { exerciseId: number; name: string; sessions: number; lastDate: DateKey;
  bestWeight: { kg: number; date: DateKey } | null; bestE1rm: { kg: number; date: DateKey; weightKg: number; reps: number } | null;
  e1rmSeries: SeriesPoint[]; volumeSeries: SeriesPoint[]; recent: ExerciseSession[] }
export function buildExerciseProgress(workouts: readonly Workout[], exerciseId: number, range: RangeKind, today: DateKey):
  ExerciseProgress | null;
export function toChartData(points: readonly SeriesPoint[], range: RangeKind, formatValue: (v: number) => string,
  today: DateKey): ChartDatum[];
```

**Rules.**

- **Window.**
  - Day: sessions in the last 30 days, one point per session day.
  - Week: the last 12 weeks.
  - Month: every month since the first session.
- **Series.** The e1RM series is the bucket `max` and stays sparse, since an empty week is not a 1RM of zero. The volume series is the bucket `sum`, zero-filled for Week and Month.
- **Bests and recent sessions.** `bestWeight` and `bestE1rm` come from **all** history, not just the window. `name` is the latest session's name. `recent` is the 10 newest sessions.
- **Chart labels:**

  | Range | `tooltipLabel` | `axisLabel` |
  |---|---|---|
  | Day | 'Wed 11 Nov' | '11 Nov', with the last one 'Today' when it is today |
  | Week | 'Week of 9 Nov' | '9 Nov' |
  | Month | 'November 2026' | 'Nov' |

**Screen.**

- `DetailHeader` (the name, plus an info `IconButton` that opens a formula sheet).
- The hero: the label "Estimated 1-rep max", then `bestE1rm` in `hero` with the unit in `heroUnit`, then "Set on 11 Nov · 90 lb × 3".
- A `StatGroup`: Best weight, Sessions, Last done.
- A `SegmentedControl` (Day | Week | Month) with a haptic.
- A card "Estimated 1-rep max" with a line `TrendChart` (caption "Last 30 days" / "Last 12 weeks" / "All time").
- A card "Volume" with a bar `TrendChart`.
- A "Recent sessions" `SectionCard`: rows of date, top set and volume, which open the workout.
- The footnote: "Estimated with the Epley formula: weight × (1 + reps ÷ 30), from completed sets of 1–12 reps."
- An exercise with no scored sets shows `EmptyState` "No weighted sets for this exercise" in place of both charts. An unknown id shows "Exercise not found".

- [ ] **Step 1: Write the failing tests**

```ts
test('returns null for an exercise never performed');
test('day range keeps only sessions from the last 30 days');
test('week range zero-fills volume but not e1RM');
test('best weight and e1RM come from all history, not the range');
test('uses the latest exercise name');
test('toChartData labels day, week and month points');
```

- [ ] **Step 2: Run → FAIL**, then **implement**, then **Run → PASS** and the full gate.

- [ ] **Step 3: On-device JS check** from a detail chevron. Expected:
- Day, Week and Month each switch both charts, with a haptic;
- a long press shows the tooltip;
- the info sheet states Epley;
- weights are in lb;
- there is no NaN for an exercise with one session.

- [ ] **Step 4: Commit**: `git add src/domain/workouts/progress.* src/ui/screens/workouts app/(tabs)/workouts/exercise` → "Add exercise progress with 1RM and volume trends"

---

### Task 21: On-device verification, debug and release

The controller drives the phone over adb. The Lyfta key is already in SecureStore, so no key entry is needed.

- [ ] **Step 1: Pre-flight.** The full gate passes and `git status` is clean. Read and record the current `cmd uimode night` value.

- [ ] **Step 2: Debug build**

```bash
npx expo prebuild --platform android && npx expo run:android --device
```
Expected: the build installs as an update, and the app opens on Today with "Key saved" in Settings.

- [ ] **Step 3: Functional checks** (screenshots to `$SP/shots/t21-*`)

1. A cold launch shows skeletons, never a spinner. The tab bar and pill switch on all 5 tabs, and the 4 empty states read correctly.
2. In Settings → Data, **Re-sync** shows "Syncing…" and then "Synced just now". The workouts count is 31, there is no skipped or paused line, and the schedule row is "Synced …".
3. Workouts matches the Task 18 checks. Workout detail matches the Task 19 checks (12 / 56). Exercise progress matches the Task 20 checks.
4. Upcoming either lists the owner's planned Lyfta workouts or shows "No upcoming workouts in Lyfta". The owner confirms which, against the Lyfta app.
5. Units: switch to kg, and the chips change (for example 135 lb → 61.2 kg). Switch back to lb, and the stored values are unchanged.
6. Wipe: the sheet opens, back closes it, then reopen it and tap "Wipe data". Workouts shows "No workouts on this phone yet", and the Settings rows read "Not synced yet". **Re-sync** then restores 31 workouts.
7. Light mode: `cmd uimode night no`. Take screenshots of all screens, then restore the recorded mode.
8. Logs. Run:
   ```bash
   adb logcat -d | grep -c -F "$(security find-generic-password -a "$USER" -s health-hub-lyfta -w)"
   ```
   Expected: `0` (Plan 1 Ruling 8 pattern: the count only, never the value). If the Keychain key is ruled unavailable, run `adb logcat -d | grep -c -E 'Bearer |Authorization'` instead (expected `0`) and list the exact-key check as an owner confirmation. Then run `adb logcat -d -s ReactNativeJS:V`. Expected: no errors.

- [ ] **Step 4: Release smoke test (no Metro, Hermes bytecode)**

Stop Metro, then run `npx expo run:android --variant release --device`. The template signs release builds with the debug keystore, so this installs as an update. Expected:
- the app opens without Metro;
- Workouts shows 31 workouts, with detail and progress opening;
- Settings shows "Key saved";
- a pull-to-refresh sync succeeds;
- `logcat` shows no `ReactNativeJS` errors.

If zod throws under release Hermes, add `src/data/lyfta/zodConfig.ts` calling `z.config({ jitless: true })`, import it first in `parseWorkouts.ts` and `parseSchedule.ts`, rerun the gate, rebuild and repeat this step.

Leave the release build installed, because it runs without the Mac. The next plan reinstalls debug as an update.

- [ ] **Step 5: Owner confirmations (pending list in the report)**
- haptics are felt on tab and range changes;
- the newest workout's duration matches Lyfta;
- Upcoming matches Lyfta's plan;
- the fonts and colours match the approved mockups.

Volume may differ slightly from Lyfta's figure by definition. Health Hub counts completed weighted sets only.

- [ ] **Step 6: Commit** any fixes from this task: "Fix issues found in on-device verification". If there were none, nothing is committed.

---

## Notes for later plans

- **Plan 8 (polish).** It needs real release signing, with a dedicated keystore kept out of git. It also covers Today content, and Settings "Recompute body metrics" once Plan 4 exists.
- **`set_type_id`.** Its meaning (warm-up and so on) is unknown, so warm-up sets currently count toward volume and PRs. Revisit this if Lyfta documents the ids.
- **The "Upcoming" row.** The mockup shows "6 exercises · about 60 min", which needs `/templates`. Plan 2 shows only the relative day.

## Done when

- `npm run typecheck && npm run lint && npm run format:check && npm test` pass on `jereenv/ui-workouts-settings`.
- On the Pixel, the release build runs without Metro, the Workouts pages show all 31 workouts with correct detail (12 exercises and 56 sets on the newest), exercise progress charts every range, and Settings key, units, profile, re-sync and wipe all work.
- No key material appears in logcat, and no screenshot or fixture with personal values is committed.
