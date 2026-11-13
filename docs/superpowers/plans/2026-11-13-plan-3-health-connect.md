# Plan 3 — Health Connect Implementation Plan (Tasks 22–28)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the owner's Samsung Health data (daily steps, distance, calories; sleep; heart rate; Galaxy Watch body fat) and the MovingLife weight and body-fat history from Health Connect, and show the Samsung data on the Activity tab. Add the Settings connection row with its permission flow and the privacy screen Health Connect requires.

**Architecture:** Same layering as Plans 1–2. A narrow `HealthConnectGateway` interface hides the native library. All logic (parsing, weigh-in grouping, sleep maths, window planning, sync) is pure TypeScript tested in Node against a fake gateway and sql.js. One adapter file (`expoHealthConnectGateway.ts`) talks to `react-native-health-connect`. The sync joins the existing `SyncCoordinator`, so it is serialised with Lyfta syncs and wipes. The Activity screens read through the same `dataVersion` pattern as Workouts.

**Tech Stack:** Plan 2's stack plus `react-native-health-connect` 4.1.3 (exact) and `expo-build-properties`.

**Spec:** `docs/superpowers/specs/2026-11-12-health-hub-design.md`, §6, §7, §10, §11 (Activity, Settings), §18 items 2, 3 and 8. UI follows `docs/design/ui-guidelines.md`. There is **no Activity mockup**; the screen is composed from the approved components and charts of Plans 2a/2b (tab icon only appears in the mockups).

**Final repo path of this file:** `docs/superpowers/plans/2026-11-13-plan-3-health-connect.md`.

## Starting point (controller verifies before Task 22)

- Branch `jereenv/health-connect`, from `main` at `6a9c2fa` (Plans 1, 2a and 2b merged).
- `MIGRATIONS.length === 6`. Plan 3 adds v7.
- `SyncSource` is `'lyfta' | 'lyfta_schedule'`; `SyncRunResult` has `workouts`, `schedule`, `reparsed`.
- Settings has a disabled "Health Connect — Coming later" row; `app/(tabs)/activity.tsx` re-exports a placeholder.
- The dev client is installed on the Pixel with the Lyfta key in SecureStore.

## Library research (done while writing this plan)

| Item | Finding |
|---|---|
| Library | `react-native-health-connect` **4.1.3** (npm, 2026-08-06, MIT, repo `matinzd/react-native-health-connect`). Built against RN 0.86.2 and React 19.2.3 (its devDependencies), TurboModule spec `NativeHealthConnect.ts`, README: "Supports both old and new architecture". Wraps `androidx.health.connect:connect-client:1.1.0`. |
| Expo plugin | **Bundled in the library since v4** (`app.plugin.js`, `expo-module.config.json`, `android-expo/`). It adds the rationale intent filter (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`) to `MainActivity`, the `ViewPermissionUsageActivity` alias (Android 14+), and registers the permission-result delegate automatically. `expo-health-connect` 0.1.1 is **deprecated**; installing it too breaks the build with a duplicate `HealthConnectPackage` class. **Do not install it.** |
| Not done by the plugin | `uses-permission` entries. They go in `app.json` `android.permissions`. |
| minSdk | Health Connect client needs **26**. RN 0.86's default is 24, so add `expo-build-properties` `~57.0.23` (SDK 57's bundled version) with `minSdkVersion: 26`. compile/target SDK stay at 36 (RN default, the library's default). |
| API used | `getSdkStatus`, `initialize`, `requestPermission`, `getGrantedPermissions`, `openHealthConnectSettings`, `readRecords` (paged with `pageToken`, `pageSize` default 1000, `dataOriginFilter`, `ascendingOrder`), `aggregateGroupByPeriod` (day slices in the phone's zone, `dataOriginFilter`, results carry `dataOrigins`). Each record has `metadata.dataOrigin` (package name), `metadata.id`, `metadata.lastModifiedTime`. History permission is requested as `{ accessType: 'read', recordType: 'ReadHealthDataHistory' }`. |
| Aggregate result keys | Steps `COUNT_TOTAL`; Distance `DISTANCE.inMeters`; `ACTIVE_CALORIES_TOTAL.inKilocalories`; `ENERGY_TOTAL.inKilocalories` (total calories); HeartRate `BPM_MIN`/`BPM_AVG`/`BPM_MAX`. Group results have `startTime` as a zoneless local date-time such as `2026-11-12T00:00`. |
| Sleep stage constants | `UNKNOWN 0, AWAKE 1, SLEEPING 2, OUT_OF_BED 3, LIGHT 4, DEEP 5, REM 6`. |

**Ruling 1 — library choice.** Use `react-native-health-connect` 4.1.3 with its bundled plugin. *Why:* it targets this exact RN/React/New Architecture combination and covers every call needed. *Cost if wrong* (the Task 22 dev-client build fails and cannot be fixed with config): write a small local Expo module in Kotlin exposing the same ten functions over `HealthConnectClient`. About one extra task, because the `HealthConnectGateway` interface (Task 24) is the only code that would change.

## Global Constraints

- Project root `/Users/jereenvalsson/personal/health-hub`. Expo SDK 57, React Native 0.86, React 19.2, TypeScript ~6.0.3, New Architecture.
- Files under `src/domain/` and `src/data/` must not import `react-native` or `expo-*`, except adapter files named `expo*.ts`. Tests run in plain Node (Jest 29, sql.js, `TZ=America/New_York`).
- Path alias `@/` → `src/`. Stored timestamps are ISO-8601 UTC strings; stored weights are kg; a `DateKey` is a `'YYYY-MM-DD'` day in the phone's zone. Weeks start Monday. Never pass non-ISO strings to `new Date`.
- Parse every Health Connect result defensively with zod from `unknown` (every field optional until checked), as the Lyfta parsers do. Library results are never trusted by type alone.
- Health values never appear in logs, commits, fixtures, ledgers or screenshots that are committed. Test fixtures use synthetic numbers. The probe prints counts, origins and dates only.
- No analytics or crash SDKs. Health Hub only **reads** Health Connect; never call `insertRecords` or any delete function.
- Before every commit, run `npm run typecheck && npm run lint && npm run format:check && npm test` and check `git diff --cached` for secrets and personal data. Commit messages are imperative, under 72 characters, no AI attribution, no Co-Authored-By. Commits are SSH-signed via 1Password; if signing fails, stop and report. Never bypass signing.
- Never stage `android/`, `.expo/`, `.superpowers/` or `node_modules/`. New root files need a `.gitignore` allowlist entry; prefer `src/`.
- Routes live in `app/` and only re-export a screen from `src/ui/screens/`. Never create `src/app/`.
- Design rules are Plan 2's: colours only from `src/ui/theme/tokens.ts`, Geist fonts, tabular figures, 44×44 touch targets, bottom sheets instead of `Modal`/`Alert`, skeletons instead of `ActivityIndicator`, no shadows, cards radius 20–24 with a 1px `line` border. Chart rules: 2px lines, rounded bar ends, one accent series per chart, an `accessibilityLabel` summarising the data.
- **Builders never run adb, never uninstall the app (SecureStore holds a key), never run `expo prebuild --clean`, never read the macOS Keychain.** Only the controller drives the phone (adb serial `59180DLCQ00B36`, app id `com.jereenv.healthhub`).
- Android build env: `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, `PATH` gains `$JAVA_HOME/bin:$ANDROID_HOME/platform-tools`.
- Scope: owner direction is that this app is just an exporter for them. Fix only what affects the correctness of numbers and dates that reach the export. Rare sync edge cases are accepted. No Body pages, metric detail, body-composition formulas, export, BLE or Senssun here.

## Rulings (made while planning)

Each is "ruling — why — cost if wrong".

- **Ruling 2 — daily totals use aggregation, filtered to Samsung Health.** `aggregateGroupByPeriod` with `dataOriginFilter: ['com.sec.android.app.shealth']`, one-day slices. *Why:* Health Connect itself sums records into the phone-local day, so we never fetch tens of thousands of minute records and never sum them wrongly. A day with an empty `dataOrigins` means "no data" and is stored as no value, never as 0. *Cost:* if Samsung's totals look wrong on the device, the fallback is summing raw records (adapter-only change).
- **Ruling 3 — incremental scheme is a trailing-window re-read, not change tokens.** Each run re-reads the last 14 days (`WINDOW_DAYS_BACK`) of daily data and replaces those days; weight and body-fat records (a few hundred rows in total) are always re-read in full and rebuilt. First run, and the first run after the history permission is newly granted, reads everything. *Why:* equally correct for our data model. Tokens only report changed records, so every change would still force us to recompute whole days; tokens expire after 30 days unused, which forces a full import anyway; and replace-the-window handles edits and deletions with no extra code. *Cost:* a record backdated more than 14 days before our last sync is missed until Settings → Re-import. Accepted.
- **Ruling 4 — weigh-in dedupe rule is `time_window`, and the Task 22 probe confirms or flips it.** `time_window`: same weigh-in if within ±2 minutes and 0.1 kg (spec §7). `same_day`: same local day and within 0.1 kg (spec §18 item 8, used if MovingLife writes sync time). The constant `WEIGH_IN_MATCH` in `src/data/healthconnect/constants.ts` selects it; both are implemented and tested. *Cost if wrong:* wrong rule shows an extra duplicate reading or merges two real same-weight weigh-ins on one day; either only changes counts, never the weight value of a day's first reading.
- **Ruling 5 — origin decides the table.** Weight and body fat from `com.moving.movinglife` become `scale_reading` plus `legacy_body_value`. Body fat from `com.sec.android.app.shealth` becomes `watch_body_fat` and is never joined to the scale series. Every other origin, and Samsung weight, is ignored and counted. A MovingLife body-fat record with no weight within the match rule is dropped and counted.
- **Ruling 6 — sleep.** One row per Health Connect session. A session belongs to the local day it **ends** on (`wake_date`). Asleep time = SLEEPING + LIGHT + DEEP + REM; awake time = AWAKE + OUT_OF_BED; UNKNOWN is ignored. A session with no stages counts `end − start` as asleep and has no stage split. Nights per day sum all sessions ending that day (naps included).
- **Ruling 7 — heart rate (owner decision 2026-11-13).** Heart rate is the daily min/avg/max from Health Connect aggregation (Samsung origin). There is no resting or asleep-average figure anywhere (no column, model field, query or UI row). *Why:* Samsung writes no resting heart rate and the owner chose daily figures only. *Cost:* none.
- **Ruling 8 — wipe.** `wipeSyncedData` also deletes the Health Connect imports: the new tables and `scale_reading` rows with `source = 'health_connect'` (their `legacy_body_value` cascade). Rows from other sources stay, because BLE readings (Plan 5) cannot be re-downloaded. *Cost if wrong:* none; Re-import restores everything.
- **Ruling 9 — permissions are all-or-nothing.** "Connected" means all 8 read permissions are granted. A partial grant shows "Not connected" with the Allow button; no data type is synced alone. The history permission is separate: without it the app syncs, shows "Last 30 days only" in Settings, and does a full import when it is later granted.
- **Ruling 10 — rationale.** The manifest entries Health Connect needs come from the plugin. In-app, a `/privacy` route shows the rationale text, reachable from the Health Connect sheet and from Settings → About. The system intent that opens `MainActivity` from Health Connect's "privacy policy" link just opens the app; it is not redirected. *Cost:* one extra tap for a sideloaded personal app.
- **Ruling 11 — Activity ranges.** Day shows the last 30 days (today included, partial). Week (12 weeks) and Month (12 months) points are the **average per completed day** in the bucket, today excluded, so a partial current week never looks like a drop. Distance follows the weight unit preference: `lb` shows miles, `kg` shows kilometres (owner-confirmed 2026-11-13). Heart rate shows the daily average as the line and min/avg/max for the visible period as stats (owner decision: daily avg/min/max only); there is no min–max band (it needs a new chart primitive). *Cost:* add the band later if wanted.
- **Ruling 13 — Activity layout (owner decision 2026-11-13).** No mockup; build the five-card page described in Task 27 from the approved components.
- **Ruling 12 — day buckets use the phone's current time zone,** natively for totals and by `localDateKey` for sessions. A record written in another zone is re-bucketed. Accepted.

## Review Focus

1. **Origin routing.** Samsung body fat never reaches `scale_reading`; MovingLife body fat never reaches `watch_body_fat`; Samsung and unknown-origin weight never become weigh-ins. → Task 24 `weighIns` tests.
2. **Day boundaries and DST.** A night ending on 2026-11-01 (DST end) keeps its wake date. `2026-11-01T00:00` aggregate results parse to the right `DateKey`. → Task 24.
3. **Zero versus no data.** A day with empty `dataOrigins` has no row; a real zero is stored as 0. → Task 24 parser tests.
4. **Idempotence and replacement.** Syncing the same data twice leaves identical rows; a record removed from Health Connect inside the window disappears; rows older than the window are kept. → Task 25.
5. **History permission transition.** Granting history after a run that lacked it triggers a full import. → Task 24 `planImport`, Task 25.
6. **Source independence.** A Health Connect failure leaves the Lyfta result untouched; a missing Lyfta key does not block Health Connect. → Task 25 coordinator tests.
7. **Wipe scope.** Wipe removes Health Connect rows but keeps a `ble` scale reading. → Task 23.

## Conventions

- **Unit test steps.** Run `npx jest <path>`. Before implementing, expect FAIL (module or export missing); after, PASS.
- **Commit step.** Run the pre-commit gate, `git add <the task's files>`, check `git diff --cached`, then `git commit -m "<message>"`.
- **sql.js tests.** Use the harness in `src/data/workouts/sqliteWorkoutRepository.test.ts` (open an in-memory database, `migrate(db, MIGRATIONS)`).
- **On-device JS check** (controller only): `adb -s 59180DLCQ00B36 reverse tcp:8081 tcp:8081`, start `npx expo start --dev-client --port 8081` in the background, launch `am start -n com.jereenv.healthhub/.MainActivity`, screenshot with `exec-out screencap -p` into the scratchpad `shots/` folder, `uiautomator dump` for tap targets, and check `logcat -d -s ReactNativeJS:V`. Expected for every check: no red error screen and no `ReactNativeJS` errors.
- **SDD ledger.** The controller records outcomes in `.superpowers/sdd/2026-11-13-plan-3-health-connect/` (git-ignored).

---

### Task 22: Library, native config, probe and the dedupe ruling

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.json`
- Create: `src/data/healthconnect/constants.ts`, `src/data/healthconnect/pageThrough.ts`, `src/data/healthconnect/probeSummary.ts` (throwaway), `src/ui/screens/dev/HealthConnectProbeScreen.tsx` (throwaway), `app/hc-probe.tsx` (throwaway)
- Test: `src/data/healthconnect/constants.test.ts`, `pageThrough.test.ts`, `probeSummary.test.ts`

**Interfaces (produces):**
```ts
// constants.ts — pure
export const MOVINGLIFE_ORIGIN = 'com.moving.movinglife';
export const SAMSUNG_HEALTH_ORIGIN = 'com.sec.android.app.shealth';
export const READ_RECORD_TYPES = ['Steps','Distance','ActiveCaloriesBurned','TotalCaloriesBurned','HeartRate','SleepSession','Weight','BodyFat'] as const;
export type ReadRecordType = (typeof READ_RECORD_TYPES)[number];
export const MANIFEST_PERMISSIONS: readonly string[]; // 'android.permission.health.READ_STEPS', …, READ_SLEEP (for SleepSession), …, READ_HEALTH_DATA_HISTORY last
export const WEIGH_IN_MATCH: 'time_window' | 'same_day';        // starts as 'time_window'
export const WEIGH_IN_WINDOW_MS = 120_000; export const WEIGH_IN_WEIGHT_TOLERANCE_KG = 0.1;
export const WINDOW_DAYS_BACK = 14; export const CHUNK_DAYS = 92; export const MAX_PAGES = 200;
// pageThrough.ts
export async function pageThrough<T>(readPage: (pageToken: string | undefined) => Promise<{ records: T[]; pageToken?: string }>): Promise<T[]>; // throws Error('Health Connect returned too many pages') after MAX_PAGES
// probeSummary.ts
export interface OriginSummary { count: number; earliest: DateKey | null; latest: DateKey | null }
export function summariseByOrigin(records: readonly unknown[], timeOf: (r: unknown) => string | null): Record<string, OriginSummary>;
export interface BodyProbe { origin: string; count: number; timeEqLastModified: number; batchedWrites: number; daysWithOne: number; daysWithTwo: number; daysWithThreePlus: number; pairsTimeWindow: number; pairsSameDay: number; hourHistogram: number[] }
export function summariseBodyRecords(records: readonly unknown[], origin: string): BodyProbe;
```

- [ ] **Step 1: Install**

```bash
npm install --save-exact react-native-health-connect@4.1.3
npx expo install expo-build-properties
npm audit --omit=dev    # record the counts in the commit body; never --force
```
Confirm `expo-health-connect` is **not** in `package.json` and `expo-build-properties` is `~57.0.23`.

- [ ] **Step 2: `app.json`**
- Add to `plugins`: `"react-native-health-connect"` and `["expo-build-properties", { "android": { "minSdkVersion": 26 } }]`.
- Add `android.permissions` with exactly the nine strings in `MANIFEST_PERMISSIONS`: `android.permission.health.` + `READ_STEPS`, `READ_DISTANCE`, `READ_ACTIVE_CALORIES_BURNED`, `READ_TOTAL_CALORIES_BURNED`, `READ_HEART_RATE`, `READ_SLEEP`, `READ_WEIGHT`, `READ_BODY_FAT`, `READ_HEALTH_DATA_HISTORY`. Keep `blockedPermissions` as it is.

- [ ] **Step 3: Write the failing tests**

```ts
// constants.test.ts
test('app.json declares exactly the manifest permissions', () => {
  // read app.json with fs; expect(expo.android.permissions).toEqual(MANIFEST_PERMISSIONS) (order-insensitive)
});
test('every read record type has a permission and the history permission is last');
test('the plugins include react-native-health-connect and no expo-health-connect');
test('the dedupe constants are the spec values');   // WINDOW 120000, tolerance 0.1, WINDOW_DAYS_BACK 14
// pageThrough.test.ts
test('follows page tokens until none is returned and concatenates in order');
test('stops with an error after MAX_PAGES pages');
// probeSummary.test.ts (synthetic records: { metadata: { dataOrigin, lastModifiedTime }, time })
test('groups count and earliest/latest local day by origin');          // days via localDateKey, TZ New York
test('ignores records with no parseable time and counts none for them');
test('timeEqLastModified counts records whose time is within 2 s of lastModifiedTime');
test('batchedWrites counts records sharing a lastModified second with a record whose time differs by over 2 minutes');
test('days-per-count histogram, adjacent-pair counts under both rules, and the 24-bucket local hour histogram');
```
For `pairsTimeWindow`/`pairsSameDay`: sort by time, then count adjacent pairs `(i, i+1)` that satisfy each rule (the weight tolerance does not apply because the probe summarises body fat and weight with the same function and never reads values; pairs use time and day only).

- [ ] **Step 4: Run → FAIL**, implement, **Run → PASS.**

- [ ] **Step 5: Throwaway probe screen.**
`HealthConnectProbeScreen` renders a plain "Probe" title and runs once on mount only when `__DEV__` is true (otherwise renders nothing). It calls `initialize()`, `requestPermission` for the 8 read types plus `ReadHealthDataHistory` (the system dialog is tapped by the controller), then logs with `console.log('HHPROBE <label> ' + JSON.stringify(value))`, one line per label:
- `granted`: the list of granted `recordType` names only;
- for each interval type (Steps, Distance, ActiveCaloriesBurned, TotalCaloriesBurned, HeartRate, SleepSession): the earliest and latest local day from two `readRecords` calls with `dataOriginFilter: [SAMSUNG_HEALTH_ORIGIN]`, `pageSize: 1`, `ascendingOrder` true and false, time filter `after 2000-01-01T00:00:00Z`;
- for Weight and BodyFat: all records, all origins, through `pageThrough` (page size 1000), then `summariseByOrigin` and, for MovingLife and Samsung, `summariseBodyRecords`.
It never logs a weight, percentage or step value. `app/hc-probe.tsx` re-exports the screen. It is reached with `adb shell am start -a android.intent.action.VIEW -d healthhub://hc-probe com.jereenv.healthhub`.

- [ ] **Step 6: Gate and commit**: `git add package.json package-lock.json app.json src/data/healthconnect src/ui/screens/dev app/hc-probe.tsx` → "Add Health Connect library, native config and probe".

- [ ] **Step 7 (controller): native rebuild.**
```bash
npx expo prebuild --platform android      # no --clean; restore tsconfig.json from git if it is rewritten
npx expo run:android --device
grep -c ViewPermissionUsageActivity android/app/src/main/AndroidManifest.xml     # expect 1
grep -c "android.permission.health.READ_" android/app/src/main/AndroidManifest.xml   # expect 9
```
Expected: the build succeeds and installs as an update; the app opens and Settings still says "Key saved". If the build fails, record the error and stop (see Ruling 1). If prebuild did not apply the plugins, ask the owner before any clean prebuild.

- [ ] **Step 8 (controller): run the probe and record the facts.** Launch the probe link, tap through the system permission dialog (including "Allow access to past data"), then `adb logcat -d -s ReactNativeJS:V | grep HHPROBE`. Write into `.superpowers/sdd/2026-11-13-plan-3-health-connect/probe.md`, counts, origins and dates only:
1. The origins present for Weight and BodyFat, with counts, and the earliest and latest MovingLife day (answers §18 item 3).
2. How history access shows in `granted` (whether `ReadHealthDataHistory` is listed) and whether Samsung's earliest dates are older than 30 days.
3. For MovingLife weight: `timeEqLastModified / count`, `batchedWrites`, the day histogram and the hour histogram.

**Ruling rule (§18 item 8):** keep `time_window` unless `timeEqLastModified / count ≥ 0.9` **and** `batchedWrites = 0` **and** the hour histogram does not match the owner's real weigh-in hours (morning). In that case MovingLife writes sync time: set `WEIGH_IN_MATCH = 'same_day'`. If the evidence is mixed, keep `time_window` and list it as an owner question. Also record any origin other than MovingLife and Samsung. Commit any constant change as "Record the Health Connect dedupe ruling".

---

### Task 23: Schema v7, repository and wipe

**Files:**
- Modify: `src/data/db/schema.ts`, `src/data/maintenance/wipeSyncedData.ts`, `src/data/sync/SyncStateRepository.ts` (the `SyncSource` union only), `src/data/db/migrate.test.ts` (version count), `src/data/maintenance/wipeSyncedData.test.ts`
- Create: `src/data/healthconnect/HealthConnectRepository.ts`
- Test: `src/data/healthconnect/HealthConnectRepository.test.ts`

**Interfaces (produces):**
```ts
// schema.ts — v7
CREATE TABLE activity_daily (date TEXT PRIMARY KEY NOT NULL, steps INTEGER, distance_m REAL, active_kcal REAL, total_kcal REAL, synced_at TEXT NOT NULL);
CREATE TABLE sleep_session (hc_id TEXT PRIMARY KEY NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, wake_date TEXT NOT NULL,
  asleep_s INTEGER NOT NULL, awake_s INTEGER NOT NULL, light_s INTEGER, deep_s INTEGER, rem_s INTEGER, has_stages INTEGER NOT NULL, synced_at TEXT NOT NULL);
CREATE INDEX idx_sleep_session_wake_date ON sleep_session (wake_date);
CREATE TABLE heart_rate_daily (date TEXT PRIMARY KEY NOT NULL, min_bpm INTEGER NOT NULL, avg_bpm REAL NOT NULL, max_bpm INTEGER NOT NULL, synced_at TEXT NOT NULL);
CREATE TABLE watch_body_fat (hc_id TEXT PRIMARY KEY NOT NULL, measured_at TEXT NOT NULL, body_fat_pct REAL NOT NULL, origin TEXT NOT NULL);
CREATE INDEX idx_watch_body_fat_measured_at ON watch_body_fat (measured_at);
CREATE TABLE scale_reading (id INTEGER PRIMARY KEY AUTOINCREMENT, measured_at TEXT NOT NULL, weight_kg REAL NOT NULL, impedance_ohm REAL,
  source TEXT NOT NULL, source_record_id TEXT NOT NULL, raw_payload TEXT, device_id TEXT, UNIQUE (source, source_record_id));
CREATE INDEX idx_scale_reading_measured_at ON scale_reading (measured_at);
CREATE TABLE legacy_body_value (reading_id INTEGER NOT NULL REFERENCES scale_reading (id) ON DELETE CASCADE,
  metric TEXT NOT NULL, value REAL NOT NULL, origin TEXT NOT NULL, PRIMARY KEY (reading_id, metric));
// SyncStateRepository.ts
export type SyncSource = 'lyfta' | 'lyfta_schedule' | 'health_connect';
// HealthConnectRepository.ts
export interface ActivityDay { date: DateKey; steps: number | null; distanceM: number | null; activeKcal: number | null; totalKcal: number | null }
export interface SleepSessionRow { hcId: string; startAt: string; endAt: string; wakeDate: DateKey; asleepS: number; awakeS: number;
  lightS: number | null; deepS: number | null; remS: number | null; hasStages: boolean }
export interface HeartRateDay { date: DateKey; minBpm: number; avgBpm: number; maxBpm: number }
export interface WatchBodyFat { hcId: string; measuredAt: string; bodyFatPct: number; origin: string }
export interface WeighIn { measuredAt: string; weightKg: number; sourceRecordId: string; rawPayload: string; bodyFatPct: number | null }
export interface ImportPayload { from: DateKey; activity: ActivityDay[]; sleep: SleepSessionRow[]; heartRate: HeartRateDay[];
  watchBodyFat: WatchBodyFat[]; weighIns: WeighIn[]; syncedAt: string }
export interface HealthConnectRepository {
  /** One transaction: replaces activity, sleep and heart-rate rows dated `from` or later, replaces ALL watch body fat and ALL scale readings with source 'health_connect'. */
  applyImport(payload: ImportPayload): Promise<void>;
  listActivityDays(): Promise<ActivityDay[]>;            // ascending by date
  listSleepSessions(): Promise<SleepSessionRow[]>;       // ascending by end
  listHeartRateDays(): Promise<HeartRateDay[]>;
  listWatchBodyFat(): Promise<WatchBodyFat[]>;
  listScaleReadings(): Promise<Array<{ id: number; measuredAt: string; weightKg: number; source: string; bodyFatPct: number | null }>>; // ascending; body fat from legacy_body_value 'body_fat_pct'
  counts(): Promise<{ activityDays: number; sleepSessions: number; heartRateDays: number; watchBodyFat: number; weighIns: number }>;
}
export function createSqliteHealthConnectRepository(db: SqlDatabase): HealthConnectRepository;
```

- [ ] **Step 1: Write the failing tests**

```ts
// migrate.test.ts: update the expected version to MIGRATIONS.length (7); v7 creates the seven tables.
// HealthConnectRepository.test.ts (sql.js)
test('applyImport stores every row type and the lists read them back in order');
test('applyImport replaces activity, sleep and heart-rate rows from the window start and keeps older rows');
test('applyImport removes a sleep session that is no longer in the payload');
test('applyImport rebuilds health_connect scale readings and their legacy body fat, and keeps a ble reading');
test('a weigh-in without body fat has no legacy_body_value row; with it, metric body_fat_pct and origin movinglife');
test('applyImport is atomic: a failure on the last insert leaves the previous data intact');   // payload with a duplicate hcId
test('applying the same payload twice leaves identical rows');
// wipeSyncedData.test.ts
test('wipe also clears the Health Connect tables and health_connect scale readings but keeps a ble reading');
// SyncStateRepository.test.ts: health_connect source round-trips like the others.
```

- [ ] **Step 2: Run → FAIL**, implement the v7 migration as one plain string (no table rebuild), the repository, and the wipe additions (`DELETE FROM` the four new tables and `scale_reading WHERE source = 'health_connect'`; `legacy_body_value` cascades; foreign keys are on). **Run → PASS.**

- [ ] **Step 3: Commit**: `git add src/data` → "Add Health Connect schema and repository".

---

### Task 24: Parsers, weigh-ins, sleep, import window and the gateway

**Files:**
- Create: `src/data/healthconnect/HealthConnectGateway.ts`, `parseHealthConnect.ts`, `weighIns.ts`, `sleepSummary.ts`, `importWindow.ts`, `expoHealthConnectGateway.ts`
- Test: `parseHealthConnect.test.ts`, `weighIns.test.ts`, `sleepSummary.test.ts`, `importWindow.test.ts`, and fixtures in `src/data/healthconnect/__fixtures__/` (synthetic JSON shaped like the library's results)

**Interfaces (produces):**
```ts
// HealthConnectGateway.ts
export type HealthConnectAvailability = 'available' | 'not_installed' | 'update_required' | 'unavailable';
export interface HealthConnectAccess { readAll: boolean; history: boolean; missing: ReadRecordType[] }
export interface DateRange { from: DateKey; toExclusive: DateKey }
export type DailyKind = 'steps' | 'distanceM' | 'activeKcal' | 'totalKcal';
export interface DailyValue { date: DateKey; value: number }
export interface DailyHeartRate { date: DateKey; minBpm: number; avgBpm: number; maxBpm: number }
export type SleepStageName = 'awake' | 'out_of_bed' | 'asleep' | 'light' | 'deep' | 'rem' | 'unknown';
export interface SleepRecord { hcId: string; startAt: string; endAt: string; stages: Array<{ stage: SleepStageName; startAt: string; endAt: string }> }
export interface BodyRecord { hcId: string; time: string; origin: string; value: number }   // weight in kg, body fat in percent
export interface HealthConnectGateway {
  availability(): Promise<HealthConnectAvailability>;
  getAccess(): Promise<HealthConnectAccess>;
  requestAccess(): Promise<HealthConnectAccess>;
  earliestDate(): Promise<DateKey | null>;                           // earliest Samsung record over the six interval types
  dailyValues(kind: DailyKind, range: DateRange): Promise<DailyValue[]>;
  dailyHeartRate(range: DateRange): Promise<DailyHeartRate[]>;
  sleepRecords(range: DateRange): Promise<SleepRecord[]>;            // sessions whose END falls in the range
  bodyRecords(kind: 'weight' | 'bodyFat'): Promise<BodyRecord[]>;   // all history, all origins
  openSettings(): void;
}
// parseHealthConnect.ts — all take `unknown`, never throw, drop what cannot be read and report how many
export interface Parsed<T> { items: T[]; rejected: number }
export function parseDailyValues(kind: DailyKind, raw: unknown): Parsed<DailyValue>;
export function parseDailyHeartRate(raw: unknown): Parsed<DailyHeartRate>;
export function parseSleepRecords(raw: unknown): Parsed<SleepRecord>;
export function parseBodyRecords(kind: 'weight' | 'bodyFat', raw: unknown): Parsed<BodyRecord>;
// weighIns.ts
export interface WeighInResult { weighIns: WeighIn[]; watchBodyFat: WatchBodyFat[]; ignored: number; orphanBodyFat: number; implausible: number }
export function buildWeighIns(weights: readonly BodyRecord[], bodyFat: readonly BodyRecord[], rule?: 'time_window' | 'same_day'): WeighInResult; // rule defaults to WEIGH_IN_MATCH
// sleepSummary.ts
export function summariseSleep(record: SleepRecord): SleepSessionRow | null;   // null when end <= start
// importWindow.ts
export interface HealthConnectCursor { v: 1; syncedThrough: DateKey; history: boolean }
export function parseCursor(raw: string | null): HealthConnectCursor | null;
export function planImport(input: { cursor: HealthConnectCursor | null; historyGranted: boolean; today: DateKey; earliest: DateKey | null }):
  { mode: 'full' | 'incremental'; range: DateRange };
export function chunkRange(range: DateRange, days: number): DateRange[];
```

**Parsing rules** (fixtures show the library's real shapes: group results `{ result: { COUNT_TOTAL, dataOrigins }, startTime: '2026-11-12T00:00', endTime }`; sleep and body records carry `metadata: { id, dataOrigin, lastModifiedTime }`):
- `parseDailyHeartRate` rounds min and max to integers and avg to 1 decimal; `DailyHeartRate` maps 1:1 onto `HeartRateDay`.
- A day is the first 10 characters of the group `startTime`, which must be a valid `DateKey`. A group whose `dataOrigins` is missing or empty yields **no item** (not 0, not counted as rejected). A group with origins but a non-finite or negative value is rejected. Steps are rounded to an integer; distance is `DISTANCE.inMeters`; kcal values are `…inKilocalories`.
- Sleep: the record needs `metadata.id`, ISO `startTime` and `endTime`. Unknown stage numbers map to `unknown`; stages with bad times are dropped, not the record.
- Body records: `hcId` is `metadata.id`; `origin` is `metadata.dataOrigin` (missing becomes `''`); value is `weight.inKilograms` or `percentage`.

**`buildWeighIns` algorithm** (the part the tests alone do not give):
1. Split weights by origin: MovingLife records are candidates; all others add to `ignored`. Weights outside 20–400 kg add to `implausible` and are dropped.
2. Sort candidates by `time`, then `hcId`. Walk them; a record joins the current group when it matches the group's **first** record (not a chain): `time_window` means `|Δt| ≤ WEIGH_IN_WINDOW_MS` and `|Δkg| ≤ 0.1 + 1e-9`; `same_day` means the same `localDateKey` and `|Δkg| ≤ 0.1 + 1e-9`. Otherwise it starts a new group. Each group becomes one `WeighIn` using its first record's time, weight and id; `rawPayload` is `JSON.stringify({ weightRecordIds, bodyFatRecordId })` (ids only).
3. MovingLife body fat (values must satisfy 0 < v < 100, else `implausible`) attaches to the nearest weigh-in that satisfies the rule's time test (`time_window`: within 2 minutes; `same_day`: same local day, nearest in time). If a weigh-in receives several, the earliest wins; one with none gets `bodyFatPct: null`. A body-fat record that matches no weigh-in adds to `orphanBodyFat`.
4. Samsung-origin body fat becomes `watchBodyFat` (same plausibility check). Other origins add to `ignored`.

**Other algorithms:**
- `summariseSleep`: stage totals follow Ruling 6; `wakeDate = localDateKey(endAt)`; `hasStages` is whether any stage with a known type exists; `lightS`/`deepS`/`remS` are null when `hasStages` is false.
- `planImport`: `full` when the cursor is null, or `historyGranted` is true and `cursor.history` is false; its range starts at `earliest` (or `today − 30 days` when null) and ends at `today + 1`. Otherwise `incremental`, starting at `cursor.syncedThrough − WINDOW_DAYS_BACK`. `parseCursor` returns null for anything malformed.
- `chunkRange`: consecutive ranges of at most `days` days, covering the input exactly, none empty.

**Adapter (`expoHealthConnectGateway.ts`).** Not unit-tested in Node (native). It must stay thin: call the library, pass the result to the parsers, return `items`. Specifics:
- `availability`: `getSdkStatus()` → `SDK_AVAILABLE` (3) → `available`, `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` (2) → `update_required`, `SDK_UNAVAILABLE` (1) → `not_installed` on Android 13 and below, otherwise `unavailable`; any thrown error → `unavailable`. Call `initialize()` once before the first read; a false result means `unavailable`.
- `getAccess`/`requestAccess`: compare granted `recordType`s with `READ_RECORD_TYPES`; `history` is true when `getGrantedPermissions()` lists `ReadHealthDataHistory`. If the probe (Task 22) showed it is not listed, derive `history` from `earliestDate()` being older than 29 days instead, and say so in a comment.
- `dailyValues`/`dailyHeartRate`: `aggregateGroupByPeriod({ recordType, timeRangeFilter: { operator: 'between', startTime, endTime }, timeRangeSlicer: { period: 'DAYS', length: 1 }, dataOriginFilter: [SAMSUNG_HEALTH_ORIGIN] })`. `startTime`/`endTime` are the UTC instants of local midnight of `from` and `toExclusive` (the library converts them back to local time).
- `sleepRecords`: `pageThrough` over `readRecords('SleepSession', …)` with the Samsung filter and a time range padded 1 day each side, then keep sessions whose `localDateKey(endAt)` is inside the range.
- `bodyRecords`: `pageThrough` over `readRecords` for the record type, no origin filter, time `after 2000-01-01T00:00:00Z`.
- `earliestDate`: for each of the six interval types, `readRecords` ascending, `pageSize: 1`, Samsung filter; the minimum local day.

- [ ] **Step 1: Write the failing tests**

```ts
// parseHealthConnect.test.ts (fixtures)
test('steps parse to a rounded integer per local day from the zoneless startTime');
test('a group with empty dataOrigins yields no item and is not rejected');          // no data is not zero
test('a group with origins and a zero total keeps the zero');
test('a negative, NaN or non-numeric total is rejected and counted');
test('distance reads inMeters and calories read inKilocalories');
test('heart rate groups keep min, avg and max and drop groups without measurements');
test('sleep records keep stages, map unknown stage numbers to unknown, and drop a record without an id');
test('body records read kg and percent, default a missing origin to empty, and reject non-finite values');
test('every parser returns empty results for null, a string, an object and an empty array');
// weighIns.test.ts
test('a MovingLife weight with body fat 2 minutes later becomes one weigh-in with that body fat');
test('two MovingLife weights 90 s and 0.05 kg apart collapse to the first');                  // time_window
test('two weights 3 minutes apart stay separate under time_window');
test('two weights hours apart on one day with the same weight collapse under same_day');
test('a 0.2 kg difference keeps two weigh-ins under both rules');
test('grouping compares with the first record of the group, not a chain');                   // 3 records each 90 s apart → 2 groups
test('Samsung body fat becomes watch body fat and never touches a weigh-in');
test('Samsung weight and unknown-origin weight are ignored and counted');
test('an orphan MovingLife body fat is counted and dropped');
test('implausible weights and percentages are dropped and counted');
test('output is deterministic when records arrive unsorted');
// sleepSummary.test.ts
test('stage totals: asleep is sleeping+light+deep+rem, awake is awake+out_of_bed, unknown ignored');
test('a session without stages counts its whole length as asleep and has null stage columns');
test('a session ending after local midnight belongs to the day it ends');
test('the night ending on the DST change (2026-11-01) keeps wake date 2026-11-01');
test('end before start gives null');
// importWindow.test.ts
test('no cursor is a full import from the earliest record to tomorrow');
test('no data at all falls back to the last 30 days');
test('a cursor gives an incremental window starting 14 days before syncedThrough');
test('history newly granted after a run without it is a full import');
test('history that was granted and is now revoked stays incremental');
test('a malformed cursor counts as no cursor');
test('chunkRange covers the range exactly with no empty chunk');                             // 200 days, 92-day chunks
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Run the gate; `tsc` must accept the adapter's library imports.

- [ ] **Step 3: Commit**: `git add src/data/healthconnect` → "Parse Health Connect data and plan imports".

---

### Task 25: Sync, coordinator and container

**Files:**
- Create: `src/data/healthconnect/healthConnectSync.ts`
- Modify: `src/data/sync/syncCoordinator.ts`, `src/bootstrap/container.ts`, `src/ui/data/useAppData.ts`
- Test: `src/data/healthconnect/healthConnectSync.test.ts`, `src/data/sync/syncCoordinator.test.ts` (extend, and update existing expectations for the new result field)

**Interfaces (produces):**
```ts
// healthConnectSync.ts
export type HealthConnectNotConnectedReason = Exclude<HealthConnectAvailability, 'available'> | 'no_permission';
export type HealthConnectSyncResult =
  | { status: 'not_connected'; reason: HealthConnectNotConnectedReason }
  | { status: 'ok'; mode: 'full' | 'incremental'; from: DateKey; activityDays: number; sleepSessions: number; heartRateDays: number;
      weighIns: number; watchBodyFat: number; ignored: number }
  | { status: 'error'; message: string };
export interface HealthConnectSyncDeps { gateway: HealthConnectGateway; repository: HealthConnectRepository; syncState: SyncStateRepository; now: () => Date }
export function syncHealthConnect(deps: HealthConnectSyncDeps): Promise<HealthConnectSyncResult>;   // never throws
// syncCoordinator.ts
export interface SyncRunResult { /* existing fields */ healthConnect: HealthConnectSyncResult | { status: 'skipped' } }
// SyncCoordinatorDeps gains: syncHealthConnect: () => Promise<HealthConnectSyncResult>
// SyncCoordinator gains: resyncHealthConnect(): Promise<SyncRunResult>   // forgets the health_connect cursor, then runs
// container.ts: AppContainer gains healthConnect: HealthConnectRepository and healthConnectGateway: HealthConnectGateway
// useAppData.ts: export function useHealthConnectStatus(): AsyncState<{ connection: HealthConnectConnection; state: SyncState }>
//   HealthConnectConnection = { availability: HealthConnectAvailability; access: HealthConnectAccess | null }
```

**`syncHealthConnect` order** (the cursor is saved only at the end, so an error changes nothing):
1. `availability()` ≠ `available` → `not_connected`. `getAccess()`; `readAll` false → `not_connected` with `no_permission`. Neither records an error.
2. `today = localDateKey(now)`, cursor from `syncState.get('health_connect')`, `earliest` only when needed (a full import), `planImport`.
3. For each `chunkRange(plan.range, CHUNK_DAYS)`: the four `dailyValues`, `dailyHeartRate`, `sleepRecords`. Merge the four kinds into `ActivityDay` rows (one per date seen; unseen kinds null). Convert sleep with `summariseSleep`. Heart-rate rows come straight from `dailyHeartRate`.
4. `bodyRecords('weight')`, `bodyRecords('bodyFat')` → `buildWeighIns`.
5. `repository.applyImport({ from: plan.range.from, … })` in one transaction.
6. `syncState.recordSuccess('health_connect', nowIso, JSON.stringify({ v: 1, syncedThrough: today, history: access.history }))`.
Any thrown error: `syncState.recordError('health_connect', message, nowIso)` (a failure inside the recording itself is swallowed) and return `{ status: 'error', message }`. A clean `not_connected` leaves earlier state untouched.

**Coordinator.** `execute()` currently returns early when the Lyfta key is missing or rejected. Refactor so the Lyfta part is its own function and `execute()` always runs the Health Connect step afterwards, inside the same slot: `healthConnect = await deps.syncHealthConnect()` wrapped so a rejection becomes `{ status: 'error', … }`. `resync()` still resets only the two Lyfta cursors. `resyncHealthConnect()` is `queueRun(() => syncState.reset('health_connect'))`. `dataVersion` increments as today. Existing results gain `healthConnect`.

- [ ] **Step 1: Write the failing tests** (fake gateway, sql.js repository, real `SyncStateRepository`)

```ts
// healthConnectSync.test.ts
test('first run imports everything from the earliest record and saves a cursor with history true');
test('a second run with the same data leaves identical rows');
test('a second run replaces only the trailing 14 days and keeps older rows');
test('a session removed from Health Connect inside the window is deleted, one older than the window is kept');
test('a changed daily total inside the window is updated');
test('history granted after a run without it triggers a full import');
test('missing read permission returns not_connected/no_permission and writes nothing');
test('unavailable Health Connect returns not_connected with the reason');
test('a gateway error returns error, records it, leaves earlier data and keeps the old cursor');
test('a failure in the database write rolls back and leaves the cursor unsaved');
test('weigh-ins and watch body fat are rebuilt from the full body record lists every run');
test('long ranges are fetched in chunks of at most 92 days');
// syncCoordinator.test.ts
test('a run without a Lyfta key still syncs Health Connect');
test('a Health Connect failure does not change the Lyfta result');
test('a Lyfta failure does not stop Health Connect');
test('resyncHealthConnect forgets the cursor and queues behind a running sync');
test('wipe waits for an in-flight run and also leaves no Health Connect rows');
```

- [ ] **Step 2: Run → FAIL**, implement, wire the container (gateway from the adapter, repository from the shared `db`, `syncHealthConnect` closure with `now: () => new Date()`), add `useHealthConnectStatus`. **Run → PASS**, then the full gate.

- [ ] **Step 3: Commit**: `git add src/data src/bootstrap src/ui/data` → "Sync Health Connect through the sync coordinator".

---

### Task 26: Settings connection, permission flow and privacy

**Files:**
- Create: `src/ui/screens/settings/healthConnectText.ts`, `HealthConnectSheet.tsx`, `src/ui/screens/settings/PrivacyScreen.tsx`, `app/privacy.tsx`
- Modify: `src/ui/screens/settings/SettingsScreen.tsx`, `WipeSheet.tsx`, `AboutSheet.tsx` (copy only if it lists data sources)
- Test: `src/ui/screens/settings/healthConnectText.test.ts`

**Interfaces (produces):**
```ts
// healthConnectText.ts
export interface HealthConnectStatusInput { connection: HealthConnectConnection; state: SyncState; running: boolean; now: Date }
export function describeHealthConnectStatus(input: HealthConnectStatusInput): { text: string; tone: 'muted' | 'warning' };
export type HealthConnectCounts = Awaited<ReturnType<HealthConnectRepository['counts']>>;
export function describeHealthConnectDetails(input: HealthConnectStatusInput & { counts: HealthConnectCounts }): Array<{ text: string; tone: 'muted' | 'warning' }>;
```
Status line, first match wins:

| Condition | Text | Tone |
|---|---|---|
| availability `not_installed` | "Install Health Connect" | warning |
| `update_required` | "Update Health Connect" | warning |
| `unavailable` | "Health Connect isn't available" | warning |
| access null or `readAll` false | "Not connected" | warning |
| `running` | "Syncing…" | muted |
| `state.lastError` set | "Sync failed" + relative age | warning |
| `access.history` false | "Connected · last 30 days only" | warning |
| `lastSuccessAt` set | "Synced" + relative age | muted |
| otherwise | "Not synced yet" | muted |

Details add "Last synced …", "Last error …: <message>", the counts ("N days of activity · N nights of sleep · N weigh-ins from MovingLife · N watch body-fat checks"), and, when history is off, "Allow 'Access past data' to import everything."

**UI.**
- Settings → Connections: the "Health Connect" row becomes enabled, shows the status line, chevron, and opens `HealthConnectSheet`. It does not show before `useHealthConnectStatus` is ready (skeleton like the other rows).
- Settings → Data: two read-only rows, "Samsung Health" and "MovingLife weigh-ins", each with the count as `value` and the status line, expanding like the Lyfta rows to show `describeHealthConnectDetails`. A "Re-import from Health Connect" action row (disabled while running) calls `sync.resyncHealthConnect()`.
- `HealthConnectSheet` (a `BottomSheet`): the status, one paragraph on what is read and why, and buttons: **Allow access** (visible unless connected with history): calls `gateway.requestAccess()`; when `readAll` becomes true, run `sync.run()`; when it stays false or history stays false, show "Allow every data type, including 'Access past data'" and offer **Open Health Connect settings** (`gateway.openSettings()`), because Android stops showing the dialog after repeated denials. **Open Health Connect settings** is always available. **Privacy** navigates to `/privacy`. After any request, re-read the connection (bump a local version).
- `PrivacyScreen` (`DetailHeader` "Privacy"): plain text sections, no medical claims: what Health Hub reads (steps, distance, calories, heart rate, sleep, weight and body fat, plus past data), from which apps (Samsung Health, MovingLife), why (show your trends and build the summary you choose to export), where it lives (only on this phone, never uploaded; no analytics), what leaves the phone (only exports you start, and Lyfta requests), and how to revoke (Health Connect settings → Apps → Health Hub). Reachable from the sheet and from a "Privacy" row in Settings → About.
- `WipeSheet` copy: "Deletes all workouts, schedule, Health Connect data and sync history from this phone. Your Lyfta key, profile and settings stay. Re-sync brings the data back."

- [ ] **Step 1: Write the failing tests** (`healthConnectText.test.ts`, `it.each` over the table above plus):

```ts
test('an error outranks the history warning and a running sync outranks an error');   // per the first-match order above
test('relative ages use formatRelativeTime');
test('details list counts with correct singular and plural');
test('history off adds the past-data hint');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS**, then the gate.

- [ ] **Step 3: On-device JS check (controller).** Settings shows the Health Connect row with a real status; the sheet opens and closes (back and drag); the privacy screen opens from both entry points. Dark and light screenshots. Do not tap Wipe here.

- [ ] **Step 4: Commit**: `git add src/ui app/privacy.tsx` → "Add Health Connect connection and privacy screen".

---

### Task 27: Activity models and screens

**Files:**
- Create: `src/domain/activity/activitySeries.ts`, `sleepNights.ts`, `heartRate.ts`; `src/ui/data/useActivityData.ts`; `src/ui/screens/activity/` `ActivityScreen.tsx`, `ActivityMetricCard.tsx`, `SleepCard.tsx`, `HeartRateCard.tsx`, `ActivitySkeleton.tsx`
- Modify: `app/(tabs)/activity.tsx` (re-export the new screen), `src/domain/format/units.ts` (add `formatDistance`); remove `src/ui/screens/placeholders/ActivityScreen.tsx` once unused
- Test: `src/domain/activity/*.test.ts`, `src/domain/format/units.test.ts`

**Interfaces (produces):**
```ts
// activitySeries.ts
export type ActivityMetric = 'steps' | 'distanceM' | 'activeKcal' | 'totalKcal';
export const ACTIVITY_SPAN: Readonly<Record<RangeKind, number>> = { day: 30, week: 12, month: 12 };
export interface ActivitySeries { points: SeriesPoint[]; today: number | null; averagePerDay: number | null; bestDay: { date: DateKey; value: number } | null }
export function buildActivitySeries(days: readonly ActivityDay[], metric: ActivityMetric, range: RangeKind, today: DateKey): ActivitySeries;
// sleepNights.ts
export interface SleepNight { date: DateKey; asleepS: number; awakeS: number; lightS: number | null; deepS: number | null; remS: number | null; bedtime: string; wakeTime: string }
export function buildSleepNights(sessions: readonly SleepSessionRow[]): SleepNight[];        // one per wake date, ascending
export interface SleepConsistency { averageBedtimeMin: number; averageWakeMin: number; bedtimeSpreadMin: number; nights: number }
export function sleepConsistency(nights: readonly SleepNight[]): SleepConsistency | null;    // null under 3 nights
export function formatClock(minutes: number): string;                                          // minutes after local midnight, '23:40'
// heartRate.ts
export interface HeartRateSummary { points: SeriesPoint[]; lowest: number | null; average: number | null; highest: number | null }
export function buildHeartRateSummary(days: readonly HeartRateDay[], range: RangeKind, today: DateKey): HeartRateSummary;
// units.ts
export function formatDistance(meters: number, unit: WeightUnit): string;                      // 'lb' → miles, 'kg' → km, one decimal
// useActivityData.ts
export type ActivityData = { activity: ActivityDay[]; sleep: SleepSessionRow[]; heartRate: HeartRateDay[] };
export function useActivityData(): AsyncState<ActivityData>;   // re-read when dataVersion changes
```

**Model rules.**
- `buildActivitySeries`: **Day** range gives one point per day for the last 30 days ending today (today included, partial), gaps zero-filled with `fillEmptyBuckets`. **Week/Month** use `bucketSeries(..., 'mean')` over completed days only (date < today, value non-null), zero-filled over the last 12 weeks/months ending with the bucket that holds today (Ruling 11). `today` is today's value (null when no row). `averagePerDay` and `bestDay` cover completed days inside the visible span and are null with none.
- `buildSleepNights`: sums sessions sharing a `wakeDate`; stage columns are the sums of the sessions that have stages, or null if none has; `bedtime` is the earliest `startAt`, `wakeTime` the latest `endAt`.
- `sleepConsistency`: bedtime minutes are measured from 18:00 local so a bedtime of 23:30 and one of 00:30 differ by 60, not 1380; `bedtimeSpreadMin` is the population standard deviation; averages are returned as minutes after local midnight (`formatClock` handles wrap). Uses the visible nights (last 14).
- `buildHeartRateSummary`: line points are the daily `avgBpm` (mean per bucket for week/month, same span and zero-fill rule is **not** used: empty buckets are simply absent, since 0 bpm is meaningless); `lowest` is the minimum `minBpm`, `highest` the maximum `maxBpm`, `average` the mean of `avgBpm`, all over the visible span.

**Screen** (top to bottom; follows `docs/design/ui-guidelines.md` and the Workouts screens' structure).
1. `ScreenHeader` "Activity"; subtitle "From Samsung Health · " plus the Health Connect status line (reuse `describeHealthConnectStatus`).
2. A `SegmentedControl` Day / Week / Month with the same haptic as the Workouts range tabs; the range applies to every card.
3. **Steps** card: `StatGroup` (Today, Average per day, Best day) and a bar `TrendChart` (`highlightLast`, tooltip label "Mon 9 Nov" for day, "Week of 9 Nov" and "Nov 2026" otherwise, with "avg/day" on week and month).
4. **Distance** card, same layout with `formatDistance`.
5. **Calories** card: a two-option `SegmentedControl` "Active | Total" above the same layout. Caption notes that Total includes resting burn.
6. **Sleep** card: last night's asleep time large, a stacked stage bar (light `bar`, deep `accent`, REM `statusLow`, awake `track`) with a text legend of durations so colour is never the only signal, a bar `TrendChart` of nightly asleep hours for the range, a `StatGroup` (Average, Bedtime ±spread, Wake) from `sleepConsistency`, and a list of the last 7 nights ("Mon 9 Nov · 7h 12m · Deep 1h 20m"). Nights without stages show duration only.
7. **Heart rate** card: line `TrendChart` of daily average, `StatGroup` Lowest / Average / Highest.
- **States.** Health Connect not connected: `EmptyState` "Connect Health Connect" with an action to Settings. Connected, sync running and no rows: `ActivitySkeleton`. Connected with no rows: `EmptyState` "No Samsung Health data yet" with "Sync now". Load error: `EmptyState` with "Try again". A card with no data in its own series shows a one-line "No data yet" in place of its chart, never a NaN axis. Pull to refresh runs `sync.run()`. Every chart has an `accessibilityLabel` that states range, average and latest value.

- [ ] **Step 1: Write the failing tests**

```ts
// activitySeries.test.ts
test('day range has 30 points ending today with gaps zero-filled');
test('week and month points average completed days only and exclude today');
test('a partial current week is not lowered by today');                      // today excluded from its bucket's mean
test('averagePerDay and bestDay ignore today and null values');
test('empty input gives finite empty results');
test('a day that spans the DST change is one bucket');                       // 2026-11-01
// sleepNights.test.ts
test('two sessions ending the same day are one night with summed stages');
test('a session without stages keeps stage columns null, and mixing sums only staged ones');
test('nights are ascending and bedtime/wake come from the earliest start and latest end');
test('consistency treats 23:30 and 00:30 bedtimes as one hour apart');
test('consistency is null under three nights');
test('formatClock wraps past midnight and pads');
// heartRate.test.ts
test('lowest, highest and average come from the visible span only');
test('empty buckets are absent, not zero');
// units.test.ts
test('formatDistance shows miles for lb and kilometres for kg with one decimal');
test('formatDistance of 0 and of a sub-100 m distance does not show -0 or NaN');
```

- [ ] **Step 2: Run → FAIL**, implement the domain modules, `formatDistance`, the hook and the screens. **Run → PASS**, then the full gate.

- [ ] **Step 3: On-device JS check (controller)** after Task 25's sync has imported data: the Activity tab shows the five cards in dark and light, Day/Week/Month switch with a haptic, a long-press tooltip works on a bar, and the empty and not-connected states render when tested by temporarily revoking access in Health Connect (restore it afterwards).

- [ ] **Step 4: Commit**: `git add src/domain src/ui app` → "Add the Activity page for steps, sleep and heart rate".

---

### Task 28: On-device verification, debug and release

The controller drives the phone. Nothing here is delegated to a builder. Save screenshots to the scratchpad `shots/` folder as `t28-*`; never commit them. Read and record the current `cmd uimode night` value first.

- [ ] **Step 1: Pre-flight.** The full gate passes and `git status` is clean. The probe is **removed** in a commit made by a builder or the controller before this step: delete `app/hc-probe.tsx`, `src/ui/screens/dev/`, `src/data/healthconnect/probeSummary.ts` and its test, keep `pageThrough` and `constants`. Commit "Remove the Health Connect probe".

- [ ] **Step 2: Debug build.** `npx expo prebuild --platform android && npx expo run:android --device`. Expected: installs as an update, Settings still shows "Key saved".

- [ ] **Step 3: Functional checks.**
1. **Fresh connection.** Revoke Health Hub in Health Connect settings, restart the app, open Settings → Health Connect: "Not connected". Tap Allow access, grant everything including "Access past data". Expected: the sheet closes into "Syncing…", then "Synced just now".
2. **Counts.** Settings → Data shows non-zero counts for Samsung Health days and MovingLife weigh-ins. Record the counts in the ledger. The earliest Samsung day is older than 30 days (history works). Record whether `WEIGH_IN_MATCH` was confirmed.
3. **Correctness spot-checks (values stay on screen only, never in the ledger).** Pick one completed past day. Compare its steps, distance, active and total calories with Samsung Health's own screen: they must match within what Samsung rounds. Compare last night's sleep duration and stage split with Samsung Health. Compare the most recent weigh-in date and weight with MovingLife's own list. Record only "match" or "mismatch" per item. A mismatch is a bug: stop and debug before continuing.
4. **Idempotence.** Pull to refresh twice. The Data counts do not grow. Re-import from Health Connect gives the same counts.
5. **Incremental.** The first import takes visibly longer than a later pull-to-refresh, which finishes in a few seconds. The `incremental` mode itself is covered by Task 25's tests; there is no UI for it.
6. **Activity.** Day, Week and Month on every card; tooltips; dark and light (`cmd uimode night yes|no`, restore the recorded mode afterwards); empty and not-connected states; screenshots of all.
7. **Wipe.** Wipe local data, then confirm Workouts, Activity and the Data counts are empty and Settings rows read "Not synced yet". Re-sync from Lyfta restores 31 workouts; Health Connect syncs again by itself and the Data counts return to the step 2 values.
8. **Lyfta independence.** With Health Connect access revoked, a pull-to-refresh still syncs Lyfta and shows "Not connected" for Health Connect. Restore access afterwards.
9. **Logs.** `adb logcat -d -s ReactNativeJS:V` shows no errors. `adb logcat -d | grep -c -E 'HHPROBE'` prints 0.
10. **Rationale entry.** From Health Connect settings → Apps → Health Hub, open the privacy link. Expected: the app opens (Ruling 10); Settings → About → Privacy shows the text.

- [ ] **Step 4: Release smoke test (no Metro, Hermes bytecode).** Stop Metro, then:
```bash
cd android && ./gradlew assembleRelease && cd ..
adb -s 59180DLCQ00B36 install -r android/app/build/outputs/apk/release/app-release.apk
```
Never use `expo run:android --variant release`. Expected: install succeeds as an update (the template signs release with the debug keystore); the app opens without Metro; Activity, Workouts and Settings load with the data; a pull-to-refresh succeeds; logcat has no `ReactNativeJS` errors. If zod throws under release Hermes, apply Plan 2's `z.config({ jitless: true })` fix to the new parsers, rerun the gate, rebuild and repeat. Leave the release build installed.

- [ ] **Step 5: Owner confirmations (pending list in the report).** The normal on-phone look check of the Activity layout (the layout itself is an owner decision, see Ruling 13); whether Samsung's step total matches the watch for a day they remember; the haptics on range changes.

- [ ] **Step 6: Commit** fixes found in this task: "Fix issues found in Health Connect verification". Nothing is committed if there were none.

---

## Notes for later plans

- **Plan 4 (body).** Reads `scale_reading` and `legacy_body_value` through `listScaleReadings`; body fat for the legacy series is `legacy_body_value` metric `body_fat_pct` origin `movinglife`. The watch series is `watch_body_fat`. Day charts use the first reading of the local day. Dedupe across sources (BLE, Senssun) reuses `buildWeighIns`' match functions: lift them into a shared module then.
- **Plan 6 (export).** Distance and sleep export in the same units as the screen. Heart rate is daily min/avg/max only. Say which weeks use `same_day` dedupe if that rule is active.
- **Plan 8 (today).** Today reads `listActivityDays` and sleep nights through the same domain models.

## Done when

- `npm run typecheck && npm run lint && npm run format:check && npm test` pass on `jereenv/health-connect`.
- On the Pixel, the release build runs without Metro; Health Connect connects with the history permission; the Activity tab shows Samsung steps, distance, calories, sleep and heart rate whose spot-checks match Samsung Health; MovingLife weigh-ins are imported and Samsung body fat is kept apart; a second sync is incremental and idempotent; wipe and Re-import work.
- No health value, screenshot or capture is committed or logged, and the probe is gone.
