# Plan 2 — UI Foundation, Workouts and Settings Implementation Plan — Part 2a (Tasks 1–12)

> **Split note (controller, 2026-11-13):** Plan 2 was written as one 21-task plan and split for review size. This file is **Plan 2a: Tasks 1–12** (dependencies, data, sync, domain logic, container). Task numbers are kept as written so cross-references stay valid. Plan 2b (`2026-11-12-plan-2b-ui-screens.md`, Tasks 13–21) starts after 2a passes its final review and merges to `main`. Shared sections (Starting point, Global Constraints, Review Focus, Conventions) are identical in both files; Review Focus lines apply to whichever tasks own the code.

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

### Task 1: Dependencies, native config, tokens and test time zone

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.json`, `.gitignore`
- Create: `src/ui/theme/tokens.ts`, `src/ui/theme/contrast.ts`, `src/test-support/timezone.globalSetup.ts`
- Test: `src/ui/theme/tokens.test.ts`, `src/test-support/timezone.test.ts`

**Interfaces:**
- Produces:
```ts
// tokens.ts
export type ColorScheme = 'dark' | 'light';
export interface ThemeColors { bg: string; card: string; raised: string; line: string; ink: string; muted: string;
  accent: string; onAccent: string; accentInk: string; statusLow: string; statusOk: string; statusHigh: string;
  track: string; grid: string; bar: string; nav: string; scrim: string }
export const COLORS: Readonly<Record<ColorScheme, ThemeColors>>;
export const RADIUS: { readonly card: 24; readonly tile: 20; readonly chip: 14; readonly set: 12; readonly pill: 999 };
export const SPACE: { readonly screen: 20; readonly card: 16; readonly stack: 14; readonly row: 12; readonly gap: 8 };
export const MOTION: { readonly pressScale: 0.98; readonly pressMs: 150; readonly sheetMs: 250; readonly pulseMs: 1600 };
export const TOUCH_MIN = 44;
// contrast.ts — WCAG 2.x contrast of two '#RRGGBB' colours
export function contrastRatio(foreground: string, background: string): number;
```

- [ ] **Step 1: Install the dependencies**

```bash
npx expo install react-native-svg react-native-reanimated react-native-worklets react-native-gesture-handler \
  expo-haptics expo-blur expo-font expo-system-ui @expo-google-fonts/geist @expo-google-fonts/geist-mono
```
These versions were verified with `npm view` against SDK 57's `bundledNativeModules.json`:

| Package | Version |
|---|---|
| react-native-svg | 15.15.4 |
| react-native-reanimated | 4.5.1 |
| react-native-worklets | 0.10.1 |
| react-native-gesture-handler | ~2.32.0 |
| expo-haptics | ~57.0.3 |
| expo-blur | ~57.0.3 |
| expo-font | ~57.0.4 |
| expo-system-ui | ~57.0.4 |
| @expo-google-fonts/geist | ^0.4.2 |
| @expo-google-fonts/geist-mono | ^0.4.3 |

No `babel.config.js` is needed, because `babel-preset-expo` adds the worklets plugin automatically. Then run `npm audit --omit=dev` and record the counts in the commit body. Never use `--force`.

- [ ] **Step 2: Native config in `app.json`**

- Add these `plugins`:
  - `"expo-system-ui"`;
  - `["expo-font", { "android": { "fonts": [ ... ] } }]`, with two families:
    - `{ "fontFamily": "Geist", "fontDefinitions": [...] }`, one definition per weight 400/500/600/700, each with `path` `./node_modules/@expo-google-fonts/geist/<400Regular|500Medium|600SemiBold|700Bold>/Geist_<…>.ttf`;
    - `{ "fontFamily": "GeistMono", … }` with weights 400/500.
  
  Text then uses `fontFamily: 'Geist'` plus `fontWeight`. Geist ships the `tnum` feature.
- Set `android.blockedPermissions` to `["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.SYSTEM_ALERT_WINDOW"]`.
- In `.gitignore`, under "Never commit", add `*.db`, `*.db-*`, `*.sqlite*`, `*.pcap` and `*.pcapng`.

- [ ] **Step 3: Write the failing tests**

```ts
// tokens.test.ts
test('approved tokens are exact', () => {
  expect(COLORS.dark).toMatchObject({ bg: '#0A0A0B', card: '#141416', raised: '#1E1E22', ink: '#F5F5F7',
    muted: '#9A9AA2', accent: '#D2FF52', onAccent: '#0A0A0B', accentInk: '#D2FF52',
    statusLow: '#5A82E6', statusOk: '#14A086', statusHigh: '#BF8228', line: 'rgba(255,255,255,0.08)' });
  expect(COLORS.light).toMatchObject({ bg: '#FFFFFF', card: '#F6F6F8', raised: '#FFFFFF', ink: '#111111',
    muted: '#6B6B73', accent: '#D2FF52', onAccent: '#111111', accentInk: '#4D6B00',
    statusLow: '#3A63D8', statusOk: '#0F8A73', statusHigh: '#B8741A', line: 'rgba(0,0,0,0.07)' });
});
test.each(['dark', 'light'] as const)('%s text tokens reach 4.5:1', (s) => {
  const c = COLORS[s];
  for (const fg of [c.ink, c.muted, c.accentInk]) {
    expect(contrastRatio(fg, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fg, c.bg)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
});
test.each(['dark', 'light'] as const)('%s status colours reach 3:1 on card', (s) => {
  const c = COLORS[s];
  for (const fg of [c.statusLow, c.statusOk, c.statusHigh]) expect(contrastRatio(fg, c.card)).toBeGreaterThanOrEqual(3);
});
// timezone.test.ts
test('tests run in America/New_York', () => {
  expect(new Date('2026-11-12T12:00:00Z').getTimezoneOffset()).toBe(300);
  expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(240);
});
```

- [ ] **Step 4: Run → FAIL**

- [ ] **Step 5: Implement**
- Tokens not in the guidelines table are taken from the mockups:

  | Token | Dark | Light |
  |---|---|---|
  | `track` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.08)` |
  | `grid` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
  | `bar` | `rgba(255,255,255,0.22)` | `rgba(0,0,0,0.18)` |
  | `nav` | `rgba(16,16,18,0.84)` | `rgba(255,255,255,0.88)` |
  | `scrim` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.3)` |
- `timezone.globalSetup.ts` default-exports a function that sets `process.env.TZ = 'America/New_York'`. Register it as `jest.globalSetup` in `package.json`.

- [ ] **Step 6: Run → PASS**, then the full pre-commit gate.

- [ ] **Step 7: Native rebuild and device check**

```bash
npx expo prebuild --platform android      # applies plugins; if it rewrites tsconfig.json, restore it with git
npx expo run:android --device
adb -s 59180DLCQ00B36 shell dumpsys package com.jereenv.healthhub | grep -cE 'EXTERNAL_STORAGE|SYSTEM_ALERT_WINDOW'
```
Expected:
- the developer screen opens and still shows "Key saved", which proves an upgrade install that kept the data;
- the `grep -c` prints `0`.

If plugin changes are not applied, `npx expo prebuild --clean` deletes and regenerates `android/`. Ask the controller before running it.

- [ ] **Step 8: Commit**: `git add package.json package-lock.json app.json .gitignore src/ui/theme src/test-support` → "Add UI dependencies, theme tokens and test time zone"

---

### Task 2: Database hardening

**Files:**
- Modify: `src/data/db/SqlDatabase.ts`, `src/data/db/migrate.ts`, `src/data/db/schema.ts` (the element type only), `src/data/settings/SettingsRepository.ts`
- Test: `src/data/db/SqlDatabase.test.ts` (new), `src/data/db/migrate.test.ts`, `src/data/settings/SettingsRepository.test.ts`

**Interfaces:**
- Produces:
```ts
// migrate.ts
export type Migration = string | { readonly sql: string; readonly foreignKeysOff: true };
export class DatabaseTooNewError extends Error { readonly found: number; readonly supported: number }
export function migrate(db: SqlDatabase, migrations: readonly Migration[]): Promise<number>;
// schema.ts
export const MIGRATIONS: readonly Migration[];
```

- [ ] **Step 1: Write the failing tests**

```ts
// SqlDatabase.test.ts — createTransactionRunner with a fake exec that records SQL
test('commits on success and rolls back on throw');           // ['BEGIN IMMEDIATE','COMMIT'] / [...,'ROLLBACK']
test('rethrows the original error when ROLLBACK also fails'); // fn throws Error('boom'), ROLLBACK rejects → rejects 'boom'
test('runs transactions one at a time and continues after a failure');
// SettingsRepository.test.ts (sql.js)
test("a settings write survives another transaction's rollback", async () => {
  // tx A: insert a marker row, await a deferred, then throw. While A is open: settings.set('lyfta.weightUnit','lb').
  // Release A → A rejects; settings.get → 'lb'; marker row absent.
});
// migrate.test.ts
test('refuses a database newer than the app');                // user_version = MIGRATIONS.length + 1 → DatabaseTooNewError, version unchanged
test('a foreign-keys-off step can rebuild a parent table');   // rebuild `workout` (create new, copy, drop, rename) with child rows present
                                                               // → children intact, PRAGMA foreign_keys = 1 afterwards
test('a foreign-keys-off step that orphans rows rolls back'); // DELETE FROM workout with children → rejects, version unchanged,
                                                               // parent row still present, PRAGMA foreign_keys = 1
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**
- **`createTransactionRunner`:** in the catch path, attempt `ROLLBACK` inside its own try/catch, then always rethrow the **original** error.
- **`SqlDatabase` doc comment:** plain `exec`/`run`/`all`/`first` calls are not queued behind an open transaction. On the single shared connection they execute *inside* it and are rolled back with it. UI-triggered writes, and reads that need a consistent multi-statement view, must use `transaction`.
- **`SettingsRepository.set`:** runs inside `db.transaction`.
- **`migrate`:**
  - If the current `user_version` is greater than `migrations.length`, throw `DatabaseTooNewError` before running anything.
  - For a `{ foreignKeysOff: true }` step, run `PRAGMA foreign_keys = OFF` **outside** the transaction, because SQLite ignores it inside one. Inside the step's transaction, run the SQL, then `PRAGMA foreign_key_check`. Any row makes it throw `Error('Migration N left M foreign key violations')`. Restore `PRAGMA foreign_keys = ON` in `finally`.
  - Return `migrations.length`.
- No Plan 2 migration rebuilds a table, so every Plan 2 step stays a plain string.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/data/db src/data/settings` → "Harden transactions and migrations"

---

### Task 3: Probe tooling and recorded value formats

**Files:**
- Modify: `src/data/lyfta/describeShape.ts`, `src/data/lyfta/describeShape.test.ts`, `scripts/lyfta-probe.ts`, `docs/research/lyfta-api-shapes.md`

**Interfaces:**
- Produces:
```ts
export const VALUE_KEY = '<key>';
export function describeShape(value: unknown): unknown;   // now collapses value-like keys; unions flatten when re-merged
export function describePattern(value: unknown): string;  // strings: digit→'9', ASCII letter→'a', whitespace→' ', other chars kept,
                                                           // cut at 40 chars + '…'; non-strings → their type name
```

- [ ] **Step 1: Write the failing tests**

```ts
test('collapses value-like keys so ids and dates never print', () => {
  expect(describeShape({ '2026-11-12': { a: 1 }, '2026-11-13': { a: 2, b: 'x' } }))
    .toEqual({ '<key>': { a: 'number', b: 'string' } });
  expect(describeShape({ name: 'x', '1042': true })).toEqual({ name: 'string', '<key>': 'boolean' });
});
test('re-merging a nullable object keeps one flat union', () => {
  expect(describeShape([[{ a: 1 }, null], [{ b: 'x' }]]))
    .toEqual([[{ $union: ['null', { a: 'number', b: 'string' }] }]]);
});
test('a real "$union" key is not mistaken for a union', () => {
  expect(describeShape([{ $union: 1 }, { $union: 'x' }])).toEqual([{ $union: 'number | string' }]);
});
test.each([
  ['01:05:23', '99:99:99'], ['2026-11-14', '9999-99-99'],
  ['2026-08-20T17:05:00.000Z', '9999-99-99a99:99:99.999a'], [null, 'null'], [42, 'number'],
])('describePattern(%p) = %p', (input, expected) => expect(describePattern(input)).toBe(expected));
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**
- **Value-like keys.** A key is value-like if it is all digits, starts with `YYYY-MM-DD`, is UUID-shaped, or is 16 or more hex characters. Value-like keys merge under `VALUE_KEY`.
- **Union nodes.** Track union nodes in a module-level `WeakSet`, so only nodes created by `mergeShapes` count as unions. `mergeShapes` spreads a union input's members back into its inputs before merging.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Add a `--patterns` mode to `scripts/lyfta-probe.ts`**

Run with `npm run lyfta:probe -- --patterns`. It makes two requests:
- `listWorkouts({ page: 1, limit: 20 })`;
- `listSchedule({ from: <today−60 UTC>, to: <today+60 UTC>, includeCompleted: true })`.

It prints the distinct `describePattern` values, with counts, for:
- workouts: `workout_perform_date` and `workout_duration`;
- schedule: `scheduled_date` and `scheduled_time`;
- the envelope fields `total_records` and `total_pages`.

It also prints the `describeShape` of the schedule response.

For workouts `weight_unit`, it prints the raw value only when the value matches `/^[a-z]{1,5}$/i`, and the pattern otherwise. It never prints titles, notes, ids or any other value, and the key reaches the client only as in Plan 1.

- [ ] **Step 6: Run the probe and read the public OpenAPI descriptions**

Run: `npm run lyfta:probe -- --patterns`
Expected: pattern lines only.

**If the controller rules the Keychain key unavailable** (it will not be worked around), take the workout patterns from the phone's own stored `raw_json` instead. No API call or key is needed. The debug build allows `run-as`:
```bash
mkdir -p "$SP/hh-db"
adb -s 59180DLCQ00B36 shell run-as com.jereenv.healthhub ls files/SQLite   # locate health-hub.db (+ -wal)
adb -s 59180DLCQ00B36 exec-out run-as com.jereenv.healthhub cat files/SQLite/health-hub.db > "$SP/hh-db/health-hub.db"
adb -s 59180DLCQ00B36 exec-out run-as com.jereenv.healthhub cat files/SQLite/health-hub.db-wal > "$SP/hh-db/health-hub.db-wal"
```
Run a `python3 -I` script that reads `raw_json` from that copy and prints only the distinct patterns, with counts, of `workout_perform_date` and `workout_duration`, using the same `describePattern` rules. The copy stays in the scratchpad (`*.db` is git-ignored). The schedule patterns then stay unconfirmed: Task 10's parser accepts both `YYYY-MM-DD` and an ISO prefix, and Task 21 confirms them on device.

Then:
```bash
curl -sS https://my.lyfta.app/openapi.json | python3 -I -c "import json,sys; …"
```
This is a public document and needs no key. Print only the `description` of the properties `workout_duration`, `workout_perform_date` and `scheduled_date`.

- [ ] **Step 7: Record the formats in `docs/research/lyfta-api-shapes.md`**

Add a "Value formats (patterns)" section. For each field, record the patterns seen and the interpretation Task 6 will implement, for example:
- `99:99:99` means a duration in H:MM:SS;
- `9999-99-99a99:99:99.999a` means a UTC instant.

**BLOCKED rule:** if `workout_duration` is digits-only and the OpenAPI description does not state its unit, stop and report BLOCKED. Seconds and minutes cannot be told apart from shape.

Re-read the doc for personal values before committing.

- [ ] **Step 8: Commit**: `git add src/data/lyfta/describeShape.ts src/data/lyfta/describeShape.test.ts scripts/lyfta-probe.ts docs/research/lyfta-api-shapes.md` → "Record Lyfta value formats as patterns"

---

### Task 4: Local dates and display formatting

**Files:**
- Create: `src/domain/time/localDate.ts`, `src/domain/format/units.ts`, `src/domain/format/dates.ts`, `src/domain/format/numbers.ts`
- Test: `localDate.test.ts`, `units.test.ts`, `dates.test.ts`, `numbers.test.ts`, each next to its source

**Interfaces:**
- Consumes: `WeightUnit`, and `LB_TO_KG` from `@/data/lyfta/parseWorkouts`. Move `LB_TO_KG` into `src/domain/format/units.ts` and re-export it from `parseWorkouts.ts`, so the domain layer never imports from data.
- Produces:
```ts
// localDate.ts
export type DateKey = string; // 'YYYY-MM-DD' in the phone's time zone
export function isDateKey(value: string): boolean;              // a real calendar date
export function localDateKey(instant: Date | string): DateKey;  // string = our normalised ISO UTC
export function addDays(key: DateKey, days: number): DateKey;
export function daysBetween(from: DateKey, to: DateKey): number;
export function weekStartKey(key: DateKey): DateKey;            // Monday
export function monthStartKey(key: DateKey): DateKey;
export function weekdayIndex(key: DateKey): number;             // 0 = Monday … 6 = Sunday
export function ageOn(birth: DateKey, on: DateKey): number;     // whole years
// units.ts
export const LB_TO_KG = 0.45359237;
export function kgToUnit(kg: number, unit: WeightUnit): number;
export function unitToKg(value: number, unit: WeightUnit): number;
export function formatWeightNumber(kg: number, unit: WeightUnit): string; // ≤ 1 decimal, '.0' dropped
export function formatWeight(kg: number, unit: WeightUnit): string;       // '82.5 kg', '135 lb'
export function formatVolume(kg: number, unit: WeightUnit): string;       // '850 kg' | '12.4 t' | '850 lb' | '27.4k lb'
export function formatHeight(cm: number): string;                         // '178 cm · 5 ft 10 in'
// dates.ts
export function formatShortDate(key: DateKey): string;     // 'Wed 11 Nov'
export function formatDayMonth(key: DateKey): string;      // '11 Nov'
export function formatFullDate(key: DateKey): string;      // '11 Nov 2026'
export function formatWeekdayLong(key: DateKey): string;   // 'Thursday 12 November'
export function formatMonthYear(key: DateKey): string;     // 'November 2026'
export function formatMonthShort(key: DateKey): string;    // 'Nov'
export function formatWeekRange(weekStart: DateKey): string; // '26 Oct – 1 Nov'
export function formatRelativeDay(key: DateKey, today: DateKey): string;
export function formatSinceLabel(from: DateKey, today: DateKey): string;
export function formatRelativeTime(iso: string, now: Date): string;
// numbers.ts
export function formatDuration(seconds: number): string;   // '58 min' | '1h' | '2h 41m'
export function formatSignedDelta(value: number, decimals: number): string; // '+4' | '−1.3' (U+2212) | '0'
export function formatCount(n: number, singular: string, plural?: string): string; // '1 PR', '2 PRs'
export function formatInteger(n: number): string;          // '9,412'
```

- [ ] **Step 1: Write the failing tests** (TZ = America/New_York)

```ts
test.each([
  ['2026-11-13T03:30:00.000Z', '2026-11-12'],   // 22:30 local, previous day
  ['2026-11-01T04:30:00.000Z', '2026-11-01'],   // 00:30 EDT
  ['2026-11-02T04:30:00.000Z', '2026-11-01'],   // 23:30 EST, after DST ends
])('localDateKey(%p) = %p', (iso, key) => expect(localDateKey(iso)).toBe(key));
test('calendar arithmetic ignores DST', () => {
  expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
  expect(daysBetween('2026-11-01', '2026-11-15')).toBe(14);
});
test('weeks start on Monday', () => {
  expect(weekStartKey('2026-11-15')).toBe('2026-11-09');
  expect(weekStartKey('2026-11-09')).toBe('2026-11-09');
  expect(monthStartKey('2026-11-15')).toBe('2026-11-01');
  expect(weekdayIndex('2026-11-15')).toBe(6);
});
test('ageOn counts whole years', () => {
  expect(ageOn('1996-11-13', '2026-11-12')).toBe(29);
  expect(ageOn('1996-11-12', '2026-11-12')).toBe(30);
});
test('isDateKey rejects impossible dates', () => expect(isDateKey('2026-02-30')).toBe(false));
test('formatWeight round-trips whole pounds', () => {
  expect(formatWeight(135 * LB_TO_KG, 'lb')).toBe('135 lb');
  expect(formatWeight(82.5, 'kg')).toBe('82.5 kg');
  expect(formatWeight(135 * LB_TO_KG, 'kg')).toBe('61.2 kg');
});
test.each([
  [850, 'kg', '850 kg'], [12400, 'kg', '12.4 t'], [1100, 'kg', '1.1 t'],
  [850 * LB_TO_KG, 'lb', '850 lb'], [27400 * LB_TO_KG, 'lb', '27.4k lb'],
])('formatVolume(%p, %p) = %p', (kg, unit, text) => expect(formatVolume(kg, unit as WeightUnit)).toBe(text));
test('formatHeight', () => expect(formatHeight(178)).toBe('178 cm · 5 ft 10 in'));
test.each([[3480, '58 min'], [3600, '1h'], [9660, '2h 41m'], [0, '0 min']])(
  'formatDuration(%p) = %p', (s, t) => expect(formatDuration(s)).toBe(t));
test.each([[4, 0, '+4'], [-1.3, 1, '−1.3'], [0, 1, '0']])(
  'formatSignedDelta(%p, %p) = %p', (v, d, t) => expect(formatSignedDelta(v, d)).toBe(t));
test('formatCount and formatInteger', () => {
  expect(formatCount(1, 'PR')).toBe('1 PR'); expect(formatCount(2, 'PR')).toBe('2 PRs');
  expect(formatInteger(9412)).toBe('9,412');
});
test('date labels', () => {
  expect(formatShortDate('2026-11-11')).toBe('Wed 11 Nov');
  expect(formatWeekdayLong('2026-11-12')).toBe('Thursday 12 November');
  expect(formatWeekRange('2026-10-26')).toBe('26 Oct – 1 Nov');
  expect(formatMonthYear('2026-11-03')).toBe('November 2026');
});
test.each([
  ['2026-11-12', 'Today'], ['2026-11-13', 'Tomorrow'], ['2026-11-15', 'In 3 days'],
  ['2026-11-21', 'Sat 21 Nov'], ['2026-11-11', 'Yesterday'],
])('formatRelativeDay(%p) from 2026-11-12 = %p', (k, t) => expect(formatRelativeDay(k, '2026-11-12')).toBe(t));
test('formatSinceLabel names the month, or the day within the same month', () => {
  expect(formatSinceLabel('2026-09-14', '2026-11-12')).toBe('since September');
  expect(formatSinceLabel('2026-11-03', '2026-11-12')).toBe('since 3 Nov');
  expect(formatSinceLabel('2025-12-01', '2026-11-12')).toBe('since December 2025');
});
test.each([
  ['2026-11-12T14:59:30.000Z', 'just now'], ['2026-11-12T14:55:00.000Z', '5 min ago'],
  ['2026-11-12T12:00:00.000Z', '3 h ago'], ['2026-11-11T20:00:00.000Z', 'yesterday'],
  ['2026-11-01T12:00:00.000Z', '1 Nov'], ['2025-11-01T12:00:00.000Z', '1 Nov 2025'],
])('formatRelativeTime(%p) at 10:00 local = %p', (iso, t) =>
  expect(formatRelativeTime(iso, new Date('2026-11-12T15:00:00.000Z'))).toBe(t));
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**
- **Calendar arithmetic.** Parse the `DateKey` into parts and use `Date.UTC`. Never use local-midnight milliseconds.
- **`localDateKey`.** Use local getters.
- **Month and day names.** Use fixed English arrays, not `Intl`, so that Hermes and Node give identical output.
- **`formatRelativeDay`:**
  - 2 to 6 days ahead → "In N days";
  - 7 or more days ahead, or 2 or more days back → `formatShortDate`.
- **`formatRelativeTime`:**
  - under 60 s → "just now";
  - under 60 min → "N min ago";
  - same local day → "N h ago";
  - previous local day → "yesterday";
  - otherwise `formatDayMonth`, plus the year when it differs.
- **`formatVolume`.** For 1,000 or more in the display unit, use one decimal with " t" (kg) or "k lb" (lb).

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/domain/time src/domain/format src/data/lyfta/parseWorkouts.ts` → "Add local-date and display formatting helpers"

---

### Task 5: Set metrics, Epley 1RM and personal records

**Files:**
- Create: `src/domain/workouts/metrics.ts`, `src/domain/workouts/records.ts`, `src/test-support/workoutBuilders.ts`
- Test: `metrics.test.ts`, `records.test.ts`

**Interfaces:**
- Consumes: `Workout`, `WorkoutExercise`, `WorkoutSet`.
- Produces:
```ts
// metrics.ts
export const EPLEY_MAX_REPS = 12;
export type ScoredSet = WorkoutSet & { weightKg: number; reps: number };
export function isScoredSet(set: WorkoutSet): set is ScoredSet;  // completed && weightKg > 0 && reps >= 1
export function setVolumeKg(set: WorkoutSet): number;            // scored ? weight × reps : 0
export function exerciseVolumeKg(exercise: WorkoutExercise): number;
export function workoutVolumeKg(workout: Workout): number;
export function scoredSetCount(exercise: WorkoutExercise): number;
export function estimateOneRepMaxKg(weightKg: number, reps: number): number | null;
// records.ts
export type PrKind = 'weight' | 'e1rm';
export interface PersonalRecord { kind: PrKind; exerciseId: number; lyftaId: number; exercisePosition: number;
  setPosition: number; valueKg: number; previousKg: number }
export function prSetKey(lyftaId: number, exercisePosition: number, setPosition: number): string; // 'id:ex:set'
export function computePersonalRecords(workouts: readonly Workout[]): PersonalRecord[];
export function prSetKeys(records: readonly PersonalRecord[]): ReadonlySet<string>;
// test-support/workoutBuilders.ts — every Plan 2 test builds workouts through these, so Task 6's type change touches one file
export function makeSet(p?: Partial<WorkoutSet>): WorkoutSet;            // defaults: completed, 80 kg × 5, RIR null
export function makeExercise(p?: Partial<WorkoutExercise>): WorkoutExercise;
export function makeWorkout(p: Partial<Workout> & { lyftaId: number; performedAt: string }): Workout;
```

**Decisions.**

- **Volume.** Volume is Σ weight × reps over scored sets only, and the same definition is used everywhere so that totals add up (Ruling 14). Lyfta's own `total_volume` is never used.
- **Epley 1RM.** The estimate is `weight × (1 + reps / 30)`. One rep returns the weight itself. Fewer than 1 or more than 12 reps returns null.
- **PR rule** (exact):
  1. Order workouts by (`performedAt`, `lyftaId`) ascending.
  2. Keep a running best weight and best e1RM for each `exerciseId`. Within one workout, pool every scored set of that `exerciseId`, even if the exercise appears twice.
  3. Find the workout's best set by weight. On ties, the earliest exercise position and then the earliest set position wins. Do the same for e1RM, using only sets with 12 reps or fewer.
  4. The best set is a PR of that kind only when a prior best exists and it beats it by more than `1e-6` kg. The first-ever session of an exercise is the baseline and gets no PR.
  5. After each workout, update the bests.
  6. A set can hold both kinds of PR. It still counts as one PR set for chips and counts.

- [ ] **Step 1: Write the failing tests**

```ts
test.each([[90, 3, 99], [100, 1, 100], [80, 12, 112], [80, 13, null], [80, 0, null]])(
  'estimateOneRepMaxKg(%p, %p) = %p', (w, r, e) => {
    const v = estimateOneRepMaxKg(w, r);
    if (e === null) expect(v).toBeNull(); else expect(v).toBeCloseTo(e, 9);
  });
test('uncompleted, weightless and rep-less sets never count', () => {
  // sets: {80,5,completed:false}, {null,5}, {0,10}, {80,null}, {80,5} → workoutVolumeKg = 400; scoredSetCount = 1
});
test('first session of an exercise sets a baseline and is not a PR');
test('a heavier top set than every earlier workout is a weight PR on that set only');
  // W1 bench 80×5; W2 bench 85×5, 90×3 → one weight PR at W2 set 1, valueKg 90, previousKg 80
test('equal weight is not a PR');
test('more reps at the same weight is an e1RM PR but not a weight PR');  // 80×5 then 80×8
test('sets above 12 reps never produce an e1RM PR');
test('workouts are ordered by time, not input order');
test('an exercise repeated within one workout is scored once');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the decisions above.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/domain/workouts/metrics.* src/domain/workouts/records.* src/test-support/workoutBuilders.ts` → "Add volume, Epley 1RM and PR detection"

---

### Task 6: Workout parser v2, stored duration, unused volume dropped (migration v3)

**Files:**
- Create: `src/data/lyfta/parseLyftaDates.ts`, `src/data/lyfta/parseDuration.ts`, `src/data/lyfta/lyftaUnit.ts`
- Modify:
  - `src/domain/workouts/types.ts` (`Workout` gains `durationS`, loses `totalVolumeKg`);
  - `src/test-support/workoutBuilders.ts` (Task 5 helper follows the type);
  - `src/data/lyfta/parseWorkouts.ts`;
  - `src/data/lyfta/lyftaSync.ts` (`resolveWeightUnit` uses `readAccountUnit`);
  - `src/data/db/schema.ts` (v3);
  - `src/data/workouts/sqliteWorkoutRepository.ts` (read and write `duration_s`; stop writing `total_volume_kg`).
- Test: `parseLyftaDates.test.ts`, `parseDuration.test.ts`, `lyftaUnit.test.ts`, `parseWorkouts.test.ts`, `migrate.test.ts`, `sqliteWorkoutRepository.test.ts`

**Interfaces:**
- Consumes: the "Value formats" section of `docs/research/lyfta-api-shapes.md` (Task 3), and `DateKey` and `isDateKey` (Task 4).
- Produces:
```ts
export function parseLyftaInstant(value: unknown): string | null;   // → ISO UTC; zoneless = UTC
export function parseLyftaDate(value: unknown): DateKey | null;     // calendar date part, no zone conversion
export function parseDurationSeconds(value: unknown): number | null;
export function parseWeightUnit(value: unknown): WeightUnit | null; // kg|kgs|kilogram(s) / lb|lbs|pound(s), any case, trimmed
export function readAccountUnit(progressJson: unknown): WeightUnit | null; // top-level weight_unit
export const WORKOUT_PARSER_VERSION = 2;
export function parseWorkoutRecord(raw: unknown, unit: WeightUnit): ParsedWorkout | null;
// Workout gains: durationS: number | null; loses totalVolumeKg (Ruling 14)
// ParsedWorkoutPage gains: totalRecords: number | null  (envelope total_records, number or numeric string)
```

- [ ] **Step 1: Write the failing tests**

```ts
test.each([
  ['2026-08-20T17:05:00.000Z', '2026-08-20T17:05:00.000Z'], ['2026-08-20T17:05:00Z', '2026-08-20T17:05:00.000Z'],
  ['2026-08-20T13:05:00-04:00', '2026-08-20T17:05:00.000Z'], ['2026-08-20 17:05:00', '2026-08-20T17:05:00.000Z'],
  ['2026-02-30T00:00:00Z', null], ['not a date', null], ['', null], [1724173500000, null],
])('parseLyftaInstant(%p) = %p', (v, e) => expect(parseLyftaInstant(v)).toBe(e));
test.each([['2026-11-14', '2026-11-14'], ['2026-11-14T00:00:00.000Z', '2026-11-14'], ['2026-13-01', null], [null, null]])(
  'parseLyftaDate(%p) = %p', (v, e) => expect(parseLyftaDate(v)).toBe(e));
test.each([['1:05:23', 3923], ['01:05:23', 3923], ['1:75:00', null], ['', null], [null, null]])(
  'parseDurationSeconds(%p) = %p', (v, e) => expect(parseDurationSeconds(v)).toBe(e));
// plus one case per pattern recorded in Task 3 (a two-part value like '58:00' means whatever the doc states)
test.each([['lb', 'lb'], ['LBS', 'lb'], [' kg ', 'kg'], ['kgs', 'kg'], ['pounds', 'lb'], ['stone', null], [null, null]])(
  'parseWeightUnit(%p) = %p', (v, e) => expect(parseWeightUnit(v)).toBe(e));
test('readAccountUnit reads the top-level weight_unit', () => {
  expect(readAccountUnit({ weight_unit: 'lbs', data: [] })).toBe('lb');
  expect(readAccountUnit({})).toBeNull(); expect(readAccountUnit(null)).toBeNull();
});
// parseWorkouts.test.ts additions (copies of the sandbox fixture)
test('reads workout_duration into durationS');           // value in the recorded pattern → seconds; absent → null
test('reads zoneless perform dates as UTC');              // '2026-08-20 17:05:00' → '2026-08-20T17:05:00.000Z'
test('a workout weight_unit overrides the account unit for set weights'); // 'kg' on an 'lb' page → 80
test('keeps an exercise whose id is a numeric string');   // '2' → 2
test('drops an exercise without an id but keeps the workout');
test('missing title, exercise name and type get placeholders'); // 'Workout', 'Exercise', 'unknown'
test('parseWorkoutRecord returns null for an invalid workout');
test('the page exposes total_records');                   // fixture → totalRecords 2; absent → null
// migrate.test.ts: 'v3 adds workout.duration_s and drops total_volume_kg'; repository: 'stores and reads durationS'
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**
- **`parseLyftaInstant`.** Regex-parse `YYYY-MM-DD[T ]HH:MM(:SS(.fff)?)?` with an optional `Z` or `±HH:MM`. Build the instant with `Date.UTC` minus the offset. Reject the result when a component does not round-trip, which catches dates like Feb 30.
- **`parseDurationSeconds`.** Accept `H:MM:SS` and `HH:MM:SS` with minutes and seconds below 60, plus the formats Task 3 recorded, interpreted exactly as the doc says. A non-negative number of seconds is the only output.
- **`parseWorkouts`, item 8 (all fields optional).**
  - Every field is `.nullish()`.
  - A workout needs an `id` (a number or numeric string) and a `workout_perform_date` that `parseLyftaInstant` accepts, otherwise it is skipped.
  - An exercise without a usable id is dropped.
  - A non-object set entry is dropped.
  - `is_completed` missing → false, as in Plan 1.
- **Units per field.** `parseWeightUnit(workout.weight_unit) ?? unit` converts set `weight` only. `total_volume` and `body_weight` are no longer read (Ruling 14 and the owner's ruling); `raw_json` keeps both.
- **Refactoring.** `parseWorkoutPage` maps items through `parseWorkoutRecord`. Plan 1's `resolveWeightUnit` calls `readAccountUnit`, with the same behaviour.
- **Migration v3:** `ALTER TABLE workout ADD COLUMN duration_s INTEGER; ALTER TABLE workout DROP COLUMN total_volume_kg;`. This mirrors Plan 1's v2 `body_weight_kg` drop; it is not a table rebuild. Any test that inserts into `workout` positionally must now name its columns.

- [ ] **Step 4: Run → PASS**, then the whole suite.

- [ ] **Step 5: Commit**: `git add src/domain/workouts/types.ts src/test-support src/data/lyfta src/data/db src/data/workouts` → "Parse Lyfta durations, instants and per-workout units"

---

### Task 7: Week grouping, heat strip and D/W/M series

**Files:**
- Create: `src/domain/series/buckets.ts`, `src/domain/workouts/history.ts`, `src/domain/workouts/exerciseProgress.ts`
- Test: `buckets.test.ts`, `history.test.ts`, `exerciseProgress.test.ts`

**Interfaces:**
- Consumes: Task 4 (`DateKey`, `localDateKey`, `weekStartKey`, `monthStartKey`, `addDays`), Task 5 (`isScoredSet`, `setVolumeKg`, `workoutVolumeKg`, `estimateOneRepMaxKg`, `EPLEY_MAX_REPS`, `makeWorkout`) and Task 6 (`Workout.durationS`).
- Produces:
```ts
// buckets.ts
export type RangeKind = 'day' | 'week' | 'month';
export type Aggregate = 'sum' | 'max' | 'mean';
export interface DatedValue { date: DateKey; value: number }
export interface SeriesPoint { start: DateKey; value: number; count: number }
export function bucketStart(date: DateKey, range: RangeKind): DateKey;
export function nextBucketStart(start: DateKey, range: RangeKind): DateKey;
export function bucketSeries(values: readonly DatedValue[], range: RangeKind, aggregate: Aggregate): SeriesPoint[]; // ascending, sparse
export function fillEmptyBuckets(points: readonly SeriesPoint[], range: RangeKind, from: DateKey, to: DateKey): SeriesPoint[]; // missing → {value 0, count 0}
// history.ts
export interface WeekGroup { weekStart: DateKey; workouts: Workout[]; sessions: number; volumeKg: number; durationS: number | null }
export function groupByWeek(workouts: readonly Workout[]): WeekGroup[];  // newest week first; workouts newest first
export const HEAT_WEEKS = 12;
export type HeatLevel = 0 | 1 | 2 | 3 | 4;
export interface HeatCell { date: DateKey; volumeKg: number; sessions: number; level: HeatLevel; future: boolean }
export function buildHeatStrip(workouts: readonly Workout[], today: DateKey, weeks?: number): HeatCell[][]; // columns oldest→newest, cells Mon→Sun
export function summarizeHeatStrip(columns: readonly HeatCell[][]): { trainingDays: number; pastDays: number };
// exerciseProgress.ts
export interface ExerciseSession { lyftaId: number; performedAt: string; date: DateKey; name: string; scoredSets: number;
  volumeKg: number; bestWeightKg: number | null; bestE1rmKg: number | null; topSet: { weightKg: number; reps: number } | null }
export function exerciseSessions(workouts: readonly Workout[], exerciseId: number): ExerciseSession[]; // oldest first
```

**Decisions.**

- **Week totals.** `durationS` is the sum of the known durations, or null when none are known. A week group's `volumeKg` uses `workoutVolumeKg`.
- **Heat level.**
  - a day with no sessions → 0;
  - otherwise `max(1, ceil(4 × dayVolume / maxDayVolumeInStrip))`;
  - when the strip's maximum day volume is 0 → 1.
  
  Days after `today` are `future: true`.
- **Session top set.** The heaviest scored set wins. On ties, more reps wins, then the earliest set.
- **Session name.** A session's `name` is that workout's exercise name. The progress screen uses the latest one.

- [ ] **Step 1: Write the failing tests**

```ts
test('bucketSeries sums by week across the DST change');      // values on 2026-10-29, 2026-11-01, 2026-11-02 → weeks 10-26 and 11-02
test('bucketSeries takes the max per month and the mean when asked');
test('fillEmptyBuckets zero-fills missing weeks between from and to');
test('a Sunday 23:30 workout stays in its week across the DST change', () => {
  // performedAt '2026-11-02T04:30:00.000Z' (Sun 1 Nov 23:30 EST) → groupByWeek weekStart '2026-10-26'
});
test('groupByWeek totals sessions, volume and known durations; null when no duration is known');
test('heat strip is 12 Monday-first columns ending this week, with future days marked', () => {
  // today '2026-11-12' (Thu): 12 columns × 7; last column Fri–Sun future; first cell date '2026-08-24'
});
test('heat levels scale with day volume and give bodyweight-only days level 1');
test('summarizeHeatStrip counts training days among past days');
test('exerciseSessions merges repeated entries in one workout and skips other exercises');
test('exerciseSessions top set prefers heavier, then more reps');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the interfaces and decisions above.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/domain/series src/domain/workouts/history.* src/domain/workouts/exerciseProgress.*` → "Group workouts by week and build progress series"

---

### Task 8: Snapshot reads, stored re-parse and unit refresh

**Files:**
- Create: `src/data/workouts/reparseStoredWorkouts.ts`
- Modify: `src/data/workouts/WorkoutRepository.ts`, `sqliteWorkoutRepository.ts`, `src/data/lyfta/lyftaUnit.ts`, and `src/data/settings/SettingsRepository.ts` (`SettingKey` adds `'lyfta.parsedWith'`)
- Test: `reparseStoredWorkouts.test.ts`, `sqliteWorkoutRepository.test.ts`, `lyftaUnit.test.ts`

**Interfaces:**
- Consumes: `parseWorkoutRecord` and `WORKOUT_PARSER_VERSION` (Task 6).
- Produces:
```ts
// WorkoutRepository additions — list/get/listAll each read inside one db.transaction (consistent snapshot)
listAll(): Promise<Workout[]>;                                            // newest first
listRaw(): Promise<{ lyftaId: number; rawJson: string; syncedAt: string }[]>;
// reparseStoredWorkouts.ts — 'lyfta.parsedWith' holds JSON {version, unit}
export interface ParsedWith { version: number; unit: WeightUnit }
export function ensureWorkoutsParsed(deps: { workouts: WorkoutRepository; settings: SettingsRepository }):
  Promise<{ reparsed: number; skipped: number } | null>;  // null = nothing to do
// lyftaUnit.ts
export function refreshLyftaUnit(deps: { client: LyftaClient; settings: SettingsRepository }):
  Promise<{ unit: WeightUnit | null; changed: boolean }>;  // LyftaError propagates
```

**Rules.**

- **`ensureWorkoutsParsed`.** It runs from raw, so it needs no network.
  - If `lyfta.weightUnit` is unset, return null.
  - If `parsedWith` equals `{ WORKOUT_PARSER_VERSION, unit }`, return null.
  - Otherwise, re-parse every `listRaw()` row with `parseWorkoutRecord(JSON.parse(rawJson), unit)`. A row that fails `JSON.parse` or parsing keeps its stored data and counts as `skipped`.
  - Upsert the re-parsed rows **grouped by original `syncedAt`**, so each row keeps its sync time.
  - Then save `parsedWith`.
- **`refreshLyftaUnit`.**
  - Stored unit unset → no request (Plan 1's `syncLyfta` resolves it).
  - Otherwise fetch `/exercises/progress`. A detected unit that is null or unchanged → `changed: false`. A different unit → save it and return `changed: true`. The coordinator then re-parses (Task 12).

- [ ] **Step 1: Write the failing tests**

```ts
test('listAll returns every workout newest first with durations');
test('listRaw returns stored raw JSON and sync time');
test('listAll never sees a half-written workout during an upsert'); // start upsertMany(2) unawaited, then listAll → 2 complete workouts
test('reparses every stored workout when the parser version changed');  // stored parsed weight mangled, raw intact → restored; parsedWith saved
test('converts stored workouts again when the unit changed');           // parsedWith {2,'kg'}, unit 'lb' → 80 × LB_TO_KG
test('does nothing when already parsed with this version and unit');    // returns null; upsertMany not called
test('keeps a stored workout whose raw JSON no longer parses and counts it');
test("keeps each workout's original synced_at");
test('refreshLyftaUnit makes no request when no unit is stored');
test('refreshLyftaUnit stores a changed account unit and reports it');
test('refreshLyftaUnit keeps the stored unit when Lyfta reports an unknown one');
test('refreshLyftaUnit propagates unauthorized');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the rules above. `hydrate` runs inside the caller's transaction and must not open a transaction of its own.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/data/workouts src/data/lyfta/lyftaUnit.* src/data/settings` → "Re-parse stored workouts on unit or parser change"

---

### Task 9: Lyfta sync hardening and persisted status (migration v4)

**Files:**
- Modify: `src/data/lyfta/lyftaSync.ts`, `src/data/sync/SyncStateRepository.ts`, `src/data/db/schema.ts` (v4)
- Test: `lyftaSync.test.ts`, `SyncStateRepository.test.ts`, `migrate.test.ts`

**Interfaces:**
- Consumes: `ParsedWorkoutPage.totalRecords` (Task 6).
- Produces:
```ts
// SyncStateRepository.ts
export interface DeletionPause { reason: 'unreadable' | 'error'; candidateIds: number[]; skipped: number }
export interface SyncState { /* Plan 1 fields */ lastSkipped: number; deletionPause: DeletionPause | null }
export interface SuccessDetails { skipped: number; deletionPause: DeletionPause | null }
recordSuccess(source: SyncSource, at: string, cursor: string | null, details?: SuccessDetails): Promise<void>; // default {0, null}
reset(source: SyncSource): Promise<void>;   // forgets cursor, success, error, skipped and pause (reuse Plan 1's helper if present)
// lyftaSync.ts
export const LYFTA_MAX_PAGES = 200;
export function pageCap(totalRecords: number | null): number; // min(200, ceil(totalRecords / LYFTA_PAGE_SIZE) + 2); null → 200
// LyftaSyncResult 'ok' gains: deletionPause: DeletionPause | null
```

**Rules.**

- **Page cap** (items 17 and 1 of the re-review). In both the backfill and `confirmDeletions`, compute `pageCap` from the first page fetched in that loop. Before fetching page `p`, if `p > cap`, throw `LyftaError('invalid_response', 'Lyfta returned more pages than expected')`.
- **Stalled deletions** (item 18).
  - **Skipped in the window.** If the windowed fetch skipped workouts, then `deletionPause = { reason: 'unreadable', candidateIds: [], skipped }`.
  - **Candidates present.** If deletion candidates exist and the stored `deletionPause` is `unreadable` with the **same sorted** `candidateIds`, skip the full listing and keep that pause.
  - **Otherwise, confirm.** Run `confirmDeletions`, which now returns `{ deleted, pause }`:
    - the full listing has skipped rows → `pause = { reason: 'unreadable', candidateIds, skipped }`;
    - the listing throws → `pause = { reason: 'error', candidateIds, skipped: 0 }`, which is retried next run;
    - success → `pause = null`.
  - **Backfill.** A backfill records `deletionPause: null`.
  - **Bookkeeping.** `recordSuccess` stores `{ skipped: totals.skipped, deletionPause }`. `recordError` leaves `deletionPause` untouched.
- **Migration v4:**
  ```sql
  ALTER TABLE sync_state ADD COLUMN last_skipped INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sync_state ADD COLUMN deletion_pause TEXT;  -- JSON DeletionPause
  ```

- [ ] **Step 1: Write the failing tests**

```ts
test.each([[150, 4], [0, 2], [null, 200], [100000, 200]])('pageCap(%p) = %p', (n, cap) => expect(pageCap(n)).toBe(cap));
test('stops a backfill whose server never reaches the last page');  // fake: total_pages 999, total_records 150, never empty
                                                                    // → status 'error'; listWorkouts called 4 times
test('caps the deletion-confirmation listing the same way');
test('records the skipped count and an unreadable deletion pause');
test('does not repeat the full listing while the same candidates stay blocked'); // 2nd run: no unwindowed listWorkouts call
test('retries the confirmation when the candidates change');
test('retries after a confirmation that failed with an error');
test('a backfill clears any deletion pause');
// SyncStateRepository.test.ts
test('recordSuccess stores the skipped count and deletion pause');
test('recordError keeps the deletion pause');
test('reset forgets everything for that source');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the rules above.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/data/lyfta/lyftaSync.* src/data/sync src/data/db` → "Cap Lyfta paging and record paused deletions"

---

### Task 10: Lyfta schedule: client, parser, storage and sync (migration v5)

**Files:**
- Create: `src/domain/workouts/schedule.ts`, `src/data/lyfta/parseSchedule.ts`, `src/data/lyfta/__fixtures__/schedule-page.json`, `src/data/schedule/ScheduleRepository.ts`, `src/data/lyfta/scheduleSync.ts`
- Modify: `src/data/lyfta/LyftaClient.ts`, `src/data/sync/SyncStateRepository.ts` (`SyncSource` adds `'lyfta_schedule'`), `src/data/db/schema.ts` (v5)
- Test: `parseSchedule.test.ts`, `ScheduleRepository.test.ts`, `scheduleSync.test.ts`, `LyftaClient.test.ts`, `migrate.test.ts`

**Interfaces:**
- Consumes: `parseLyftaDate` (Task 6); `localDateKey` and `addDays` (Task 4); `SyncStateRepository` (Task 9).
- Produces:
```ts
// domain/workouts/schedule.ts
export interface ScheduledWorkout { lyftaId: string; date: DateKey; title: string; templateId: string | null;
  source: string | null; status: string | null; completed: boolean }
// parseSchedule.ts
export interface ParsedScheduledWorkout { item: ScheduledWorkout; rawJson: string }
export interface ParsedSchedulePage { items: ParsedScheduledWorkout[]; skipped: number; currentPage: number; totalPages: number }
export function parseSchedulePage(json: unknown): ParsedSchedulePage;
// LyftaClient.ts
listSchedule(p: { from?: string; to?: string; includeCompleted?: boolean; page?: number; limit?: number }): Promise<unknown>;
export const MAX_RETRY_AFTER_MS = 120_000;
// ScheduleRepository.ts
export interface ScheduleRepository {
  replaceRange(from: DateKey, to: DateKey, items: readonly ParsedScheduledWorkout[], syncedAt: string,
    deleteMissing: boolean): Promise<{ upserted: number; deleted: number }>;   // one transaction
  listBetween(from: DateKey, to: DateKey): Promise<ScheduledWorkout[]>;        // inclusive; date, then title
  count(): Promise<number>;
}
export function createSqliteScheduleRepository(db: SqlDatabase): ScheduleRepository;
// scheduleSync.ts
export const SCHEDULE_PAGE_SIZE = 100;
export function scheduleWindow(today: DateKey): { from: DateKey; to: DateKey }; // today−8 … today+29 (7 back, 28 ahead, ±1 padding)
export type ScheduleSyncResult = { status: 'ok'; upserted: number; deleted: number; skipped: number }
  | { status: 'invalid_key' } | { status: 'error'; message: string };
export interface ScheduleSyncDeps { client: LyftaClient; schedule: ScheduleRepository; syncState: SyncStateRepository; now: () => Date }
export function syncLyftaSchedule(deps: ScheduleSyncDeps): Promise<ScheduleSyncResult>; // never rejects
```

**Rules.**

- **Parser** (item 8: every field optional).
  - The page envelope needs a `workouts` array, otherwise `LyftaError('invalid_response')`. `current_page` and `total_pages` are numbers or numeric strings, defaulting to 1.
  - Item fields:

    | Field | Rule |
    |---|---|
    | `id` | string or number → string; missing → skip and count |
    | `scheduled_date` | through `parseLyftaDate`; null → skip and count |
    | `title` | missing or blank → `'Workout'` |
    | `template_id` | string or number → string |
    | `source`, `status` | strings |
    | `is_completed` | missing → false |
  - `note` and `scheduled_time` stay only in `raw_json`.
- **Sync.**
  - Fetch every page of `scheduleWindow(localDateKey(now()))` with `includeCompleted: true` and `limit: SCHEDULE_PAGE_SIZE`.
  - After all pages succeed, call `replaceRange(from, to, items, now, skipped === 0)`.
  - Record success with `{ skipped, deletionPause: null }`.
  - On 401, record `'invalid_key'` and return `invalid_key`. Any other error records its message and returns `error`.
- **Client.**
  - The query keys are sent in the order `from, to, include_completed, page, limit`.
  - A Retry-After that is blank after trimming counts as absent, and a value is capped at `MAX_RETRY_AFTER_MS`.
- **Fixture.** The fixture is synthetic. It follows the recorded shape and Task 3's `scheduled_date` pattern, and has 3 items: one upcoming (`'Lower Strength B'`), one completed, and one with `scheduled_date: 'soon'`. It contains no personal values.
- **Migration v5:**
  ```sql
  CREATE TABLE scheduled_workout (lyfta_id TEXT PRIMARY KEY NOT NULL, scheduled_date TEXT NOT NULL,
    title TEXT NOT NULL, template_id TEXT, source TEXT, status TEXT, completed INTEGER NOT NULL,
    raw_json TEXT NOT NULL, synced_at TEXT NOT NULL);
  CREATE INDEX idx_scheduled_workout_date ON scheduled_workout (scheduled_date);
  ```

- [ ] **Step 1: Write the failing tests**

```ts
test('parses items into calendar dates and keeps raw JSON');
test('skips items without an id or a valid date and counts them'); // fixture → 2 items, skipped 1
test('accepts numeric ids and string pagination');                 // id 7 → '7'; total_pages '2' → 2
test('a missing title falls back to Workout');
test('rejects a response without a workouts array');
test('listSchedule sends range, completed flag, page and limit', async () => {
  // listSchedule({ from: '2026-11-04', to: '2026-12-11', includeCompleted: true, page: 2, limit: 100 }) →
  // 'https://my.lyfta.app/api/v1/schedule?from=2026-11-04&to=2026-12-11&include_completed=true&page=2&limit=100'
});
test('treats an empty Retry-After as absent');   // 'Retry-After: ' → sleep(2000)
test('caps Retry-After at 120 s');               // 'Retry-After: 3600' → sleep(120000)
test('replaceRange upserts and deletes missing items only inside the range');
test('replaceRange keeps everything when deleteMissing is false');
test('listBetween is inclusive and ordered by date then title');
test('scheduleWindow pads a week back and four weeks ahead by one day', () =>
  expect(scheduleWindow('2026-11-12')).toEqual({ from: '2026-11-04', to: '2026-12-11' }));
test('fetches every page of the window including completed items');
test('replaces the stored window and records success for lyfta_schedule');
test('deletes nothing when a page fails or an item was skipped');
test('returns invalid_key on 401 and records it');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the rules above.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/domain/workouts/schedule.ts src/data/lyfta src/data/schedule src/data/sync src/data/db` → "Sync the Lyfta schedule into local storage"

---

### Task 11: Profile and preferences (migration v6)

**Files:**
- Create: `src/domain/profile/profile.ts`, `src/data/profile/ProfileRepository.ts`, `src/data/settings/preferences.ts`
- Modify: `src/data/settings/SettingsRepository.ts` (`SettingKey` adds `'display.weightUnit'`), `src/data/db/schema.ts` (v6)
- Test: `profile.test.ts`, `ProfileRepository.test.ts`, `preferences.test.ts`, `migrate.test.ts`

**Interfaces:**
- Produces:
```ts
// domain/profile/profile.ts
export type Sex = 'female' | 'male';
export type BmiCutoffs = 'who' | 'who_asian';
export interface Profile { heightCm: number | null; birthDate: DateKey | null; sex: Sex | null; goalWeightKg: number | null;
  bmiCutoffs: BmiCutoffs; effectiveFrom: string }
export type ProfileInput = Omit<Profile, 'effectiveFrom'>;
export type ProfileError = 'height' | 'birthDate' | 'goalWeight';
export const PROFILE_LIMITS: { heightCm: [100, 250]; ageYears: [13, 100]; goalWeightKg: [30, 300] };
export function validateProfile(input: ProfileInput, today: DateKey): ProfileError[]; // null fields are allowed
// data/profile/ProfileRepository.ts — append-only versions
export interface ProfileRepository {
  getCurrent(): Promise<Profile | null>;
  getAt(iso: string): Promise<Profile | null>;   // latest version effective at iso, else the earliest version
  save(input: ProfileInput, at: string): Promise<boolean>; // false = equal to current, nothing written; one transaction
}
export function createSqliteProfileRepository(db: SqlDatabase): ProfileRepository;
// data/settings/preferences.ts
export interface Preferences { displayWeightUnit: WeightUnit; displayUnitIsExplicit: boolean; lyftaAccountUnit: WeightUnit | null }
export interface PreferencesStore { getSnapshot(): Preferences; subscribe(listener: () => void): () => void;
  reload(): Promise<void>; setDisplayWeightUnit(unit: WeightUnit): Promise<void> }
export function resolveDisplayUnit(display: string | null, lyfta: string | null): WeightUnit; // explicit → Lyfta → 'kg'
export function createPreferencesStore(settings: SettingsRepository): Promise<PreferencesStore>;
```

**Decisions.**

- The profile is stored now, so Plan 4 does not need new Settings UI. It is versioned as the spec's §7 requires, so old readings use the profile in effect at that time. Height is always stored in cm.
- `getSnapshot` returns the same object until a change.
- **Migration v6:**
  ```sql
  CREATE TABLE profile_version (id INTEGER PRIMARY KEY AUTOINCREMENT, effective_from TEXT NOT NULL,
    height_cm REAL, birth_date TEXT, sex TEXT, goal_weight_kg REAL, bmi_cutoffs TEXT NOT NULL);
  CREATE INDEX idx_profile_version_effective ON profile_version (effective_from);
  ```

- [ ] **Step 1: Write the failing tests**

```ts
test('accepts a complete valid profile and an empty one');
test('rejects height outside 100–250 cm');
test('rejects a future, under-13 or impossible birth date');  // '2026-02-30' → 'birthDate'
test('rejects goal weight outside 30–300 kg');
test('getCurrent is null before any save');
test('save appends versions and getCurrent returns the newest');
test('getAt returns the version in effect, else the earliest');
test('saving an unchanged profile adds no version');           // returns false
test('display unit defaults to the Lyfta account unit, then kg');
test('an explicit display unit wins and persists');
test('reload picks up a newly detected Lyfta unit and notifies');
test('snapshot is referentially stable between changes');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the interfaces and decisions above.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/domain/profile src/data/profile src/data/settings src/data/db` → "Store a versioned profile and unit preferences"

---

### Task 12: Sync coordinator and singleton container

**Files:**
- Create: `src/data/sync/syncCoordinator.ts`, `src/data/maintenance/wipeSyncedData.ts`, `src/bootstrap/memoizeAsync.ts`
- Modify:
  - `src/data/lyfta/lyftaSync.ts`: remove `createLyftaSyncRunner`; its concurrency test moves here.
  - `src/bootstrap/container.ts`, `src/bootstrap/ContainerContext.tsx`.
  - `app/index.tsx`: the dev screen calls `sync.run()` and `sync.resync()` until Task 16 replaces it.
- Test: `syncCoordinator.test.ts`, `wipeSyncedData.test.ts`, `memoizeAsync.test.ts`, `lyftaSync.test.ts`

**Interfaces:**
- Consumes:
  - `syncLyfta` (Plan 1 + Task 9);
  - `refreshLyftaUnit` and `ensureWorkoutsParsed` (Task 8);
  - `syncLyftaSchedule` and `ScheduleRepository` (Task 10);
  - `PreferencesStore`, `ProfileRepository` (Task 11);
  - `SyncStateRepository.reset` (Task 9).
- Produces:
```ts
// syncCoordinator.ts
export interface SyncRunResult { workouts: LyftaSyncResult; schedule: ScheduleSyncResult | { status: 'skipped' };
  reparsed: { reparsed: number; skipped: number } | null }
export interface SyncSnapshot { running: boolean; lastResult: SyncRunResult | null; dataVersion: number }
export interface SyncCoordinatorDeps { client: LyftaClient; workouts: WorkoutRepository; schedule: ScheduleRepository;
  syncState: SyncStateRepository; settings: SettingsRepository; secrets: SecretStore;
  preferences: Pick<PreferencesStore, 'reload'>; wipeSyncedData: () => Promise<void>; now: () => Date }
export interface SyncCoordinator {
  run(): Promise<SyncRunResult>; resync(): Promise<SyncRunResult>; wipe(): Promise<void>;
  subscribe(listener: () => void): () => void; getSnapshot(): SyncSnapshot }
export function createSyncCoordinator(deps: SyncCoordinatorDeps): SyncCoordinator;
// wipeSyncedData.ts — one transaction: DELETE FROM workout (cascades), scheduled_workout, sync_state
export function wipeSyncedData(db: SqlDatabase): Promise<void>;
// memoizeAsync.ts
export function memoizeAsync<T>(factory: () => Promise<T>): { get(): Promise<T>; reset(): void }; // a rejection is not kept
// container.ts
export interface AppContainer { workouts: WorkoutRepository; schedule: ScheduleRepository; syncState: SyncStateRepository;
  settings: SettingsRepository; profile: ProfileRepository; preferences: PreferencesStore; secrets: SecretStore; sync: SyncCoordinator }
export function getAppContainer(): Promise<AppContainer>;  // module-level memoised singleton
export function resetAppContainer(): void;                 // for the provider's "Try again"
```

**`run()` order.** It never rejects; each step's unexpected throw is caught and turned into a result.

1. `ensureWorkoutsParsed`. It is local only, and its result goes in `reparsed`.
2. If there is no key, return `{ workouts: not_configured, schedule: skipped }` without making any request.
3. Call `refreshLyftaUnit`.
   - If it reports `changed`, run `ensureWorkoutsParsed` again.
   - If it fails with `unauthorized`, call `recordError('lyfta', 'invalid_key')` and return `{ workouts: invalid_key, schedule: skipped }`.
   - Any other error is ignored, because `syncLyfta` will surface it.
4. Run `syncLyfta`.
5. Run `syncLyftaSchedule`, unless the workouts result is `invalid_key` or `not_configured`.
6. Call `preferences.reload()`.
7. Set `running: false`, set `lastResult`, increment `dataVersion`, and notify subscribers.

**Concurrency.** There is one in-flight slot.

| Call | While this is in flight | Behaviour |
|---|---|---|
| `run()` | `run` or `resync` | returns that same promise |
| `run()` | `wipe` | waits for the wipe, then runs |
| `resync()` | anything | waits, then `reset('lyfta')` and `reset('lyfta_schedule')`, then runs (a full re-backfill, which retries skipped workouts) |
| `wipe()` | anything | waits, then wipes, increments `dataVersion` and notifies |

`wipe` keeps the key, settings and profile. `getSnapshot` returns a new object only when something changes.

- [ ] **Step 1: Write the failing tests**

```ts
test('runs re-parse, unit check, workouts and schedule in that order'); // fake client call log: getExerciseProgress, listWorkouts, listSchedule
test('makes no request without a key');
test('stops with invalid_key when the unit check is rejected');
test('re-parses stored workouts when the Lyfta unit changed');
test('concurrent runs share one sync');                // listWorkouts page 1 called once; both results are the same object
test('resync clears both sync states and backfills');  // listWorkouts without from/to; listSchedule called
test('wipe waits for an in-flight run, then leaves no synced data');
  // run blocked on a deferred listWorkouts; wipe(); release; after both: workouts 0, schedule 0, sync_state empty;
  // key, 'display.weightUnit' and profile still present
test('snapshot is stable between changes and bumps dataVersion after each run and wipe');
test('never rejects when a repository throws');
test('memoizeAsync shares one result and retries after a failure');
test('wipeSyncedData deletes workouts, sets, schedule and sync state only');
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**, following the order and concurrency table above.
- `getAppContainer` opens the database, migrates, builds the repositories and `createPreferencesStore`, then builds the coordinator with `wipeSyncedData: () => wipeSyncedData(db)`.
- `ContainerProvider` uses `getAppContainer()`. On failure it calls `resetAppContainer()` before showing the error, so a retry builds a fresh container.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**: `git add src/data/sync src/data/maintenance src/data/lyfta/lyftaSync.* src/bootstrap app/index.tsx` → "Coordinate sync, re-sync and wipe in one container"

---

## Done when (Plan 2a)

Tasks 1–12 are complete with clean task reviews, the 2a final whole-branch review is clean, `npm run typecheck && npm run lint && npm test && npm run format:check` pass, and the branch is merged to local `main`.
