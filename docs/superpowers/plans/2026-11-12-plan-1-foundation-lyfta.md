# Plan 1 — Foundation and Lyfta Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Expo app with a tested local database, a Lyfta API client and a resumable sync that stores the owner's complete workout history on the phone, verified on the Pixel through a temporary developer screen.

**Architecture:** Pure TypeScript domain and data layers (no React Native imports outside adapter files) so they test in Node. A small `SqlDatabase` interface has two adapters: `expo-sqlite` on the device and `sql.js` (SQLite compiled to WebAssembly) in Jest, so the real SQL is tested. Lyfta access is split into client (HTTP, errors, rate limit) → parser (validation, units) → repository (SQLite) → sync service (backfill, incremental, deletions).

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript ~6.0, expo-router, expo-sqlite, expo-secure-store, zod, Jest (jest-expo), sql.js (tests only), tsx (scripts).

**Spec:** `docs/superpowers/specs/2026-11-12-health-hub-design.md`

**Where this plan sits.** The spec is delivered as a series of plans, each producing working, tested software:

| Plan | Scope | Waits on |
|---|---|---|
| **1 (this)** | Project foundation, database, Lyfta workout sync, Lyfta response probe, Senssun cloud feasibility spike | Lyfta API key (Tasks 8–9) |
| 2 | Mockups → UI foundation (tabs, theme, charts), Workouts pages, Settings/profile, Lyfta schedule | Owner reacts to mockups |
| 3 | Health Connect: Samsung activity/sleep/HR/watch body fat; MovingLife weight/fat baseline; Activity pages | — |
| 4 | Body-composition engine, Body pages, metric detail | — |
| 5 | Scale over Bluetooth | Scale label + HCI capture |
| 6 | Export | — |
| 7 | Senssun cloud history import + recompute | Task 10 verdict |
| 8 | Polish: Today page, goal projection, animations, empty/error states | — |

## Global Constraints

- Project root: `/Users/jereenvalsson/personal/health-hub` (already contains `docs/`).
- Expo SDK 57, React Native 0.86, React 19.2, TypeScript ~6.0.3, matching `~/personal/lumitrail`. Install native packages with `npx expo install <pkg>` so versions match the SDK.
- Files under `src/domain/` and `src/data/` must not import `react-native` or `expo-*`, except adapter files named `expo*.ts`. Tests must run in plain Node.
- Path alias `@/` → `src/`.
- All stored timestamps are ISO-8601 UTC strings (`toISOString()` format). All stored weights are kilograms.
- Lyfta: base URL `https://my.lyfta.app`, auth header `Authorization: Bearer <key>`, limits 60 requests/minute and 5,000/day, exercise name field is spelled `excercise_name`.
- Secrets: the Lyfta key lives only in `expo-secure-store` on the phone, or the macOS Keychain item `health-hub-lyfta` for the probe script. Never in code, logs, test fixtures, commits, or chat.
- No analytics or crash-reporting SDKs.
- Before every commit: `npm run typecheck && npm run lint && npm test` all pass, and `git diff --cached` is checked for secrets and personal data.
- Commit messages: imperative mood, under 72 characters, no AI attribution lines.
- Android build environment (from Lumitrail's SETUP.md):
  `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`,
  `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`.

## Review Focus

1. **Key revoked mid-use** (the owner regenerates their Lyfta key): sync returns `invalid_key`, records it in sync state, and leaves stored workouts untouched. → Task 7, `returns invalid_key and keeps data on 401`.
2. **Backfill interrupted** (app closed or network lost on page 2 of 5): the next sync resumes at page 2 without duplicates. → Task 7, `resumes backfill from saved cursor`.
3. **Workout deleted or edited in Lyfta after it was synced:** edits are picked up and deletions removed within the 7-day incremental window. → Task 7, `deletes workouts removed in Lyfta within window`; Task 5, `upsert replaces exercises and sets`.
4. **Malformed or unusual sets** (empty strings, `"abc"`, cardio sets with duration and no weight, a workout with a bad date): parsing never crashes; a bad workout is skipped and counted, not the whole page. → Task 3, `skips invalid workouts and counts them`, `parses empty and non-numeric strings as null`.
5. **Double-tap on Sync** (two syncs at once): only one runs; both callers get the same result. → Task 7, `concurrent runs share one sync`.

---

### Task 1: Project scaffold and tooling

**Files:**
- Create (from template): `package.json`, `app.json`, `tsconfig.json`, `assets/`
- Create: `.gitignore`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `jest.setup.ts`, `app/_layout.tsx`, `app/index.tsx`, `src/smoke.test.ts`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `start`, `android`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `lyfta:probe` (script file created in Task 8). The `@/` alias works in app code, Jest and tsx.

- [ ] **Step 1: Generate the SDK 57 template outside the repo**

Run:
```bash
cd /private/tmp/claude-501/-Users-jereenvalsson-personal/a171047d-208a-4e7c-8069-cf7aad7e0aaa/scratchpad
npx create-expo-app@latest hh-template --template blank-typescript@sdk-57 --no-install
rsync -a --exclude .git --exclude node_modules --exclude App.tsx --exclude index.ts \
  hh-template/ /Users/jereenvalsson/personal/health-hub/
```
Expected: `health-hub/` contains `package.json`, `app.json`, `tsconfig.json`, `assets/`, plus the existing `docs/`.

- [ ] **Step 2: Configure the app identity and router**

In `package.json`: set `"name": "health-hub"`, `"main": "expo-router/entry"`. In `app.json`: `name` `"Health Hub"`, `slug` `"health-hub"`, `scheme` `"healthhub"`, `android.package` `"com.jereenv.healthhub"`, `plugins` `["expo-router", "expo-sqlite", "expo-secure-store"]`, `userInterfaceStyle` `"automatic"`.

Run:
```bash
cd /Users/jereenvalsson/personal/health-hub
npm install
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-sqlite expo-secure-store
npm install zod
npm install -D jest jest-expo @types/jest @types/node @testing-library/react-native sql.js @types/sql.js tsx eslint eslint-config-expo eslint-config-prettier prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```
Expected: installs complete with no peer-dependency errors.

- [ ] **Step 3: Copy Lumitrail's tooling conventions**

- `tsconfig.json`: same as `~/personal/lumitrail/tsconfig.json` (`strict`, `paths` `@/*` → `./src/*`, `noImplicitOverride`, `types: ["jest", "node"]`).
- `eslint.config.js`: same as Lumitrail's (Expo flat config + Prettier, `no-console` warn allowing `warn`/`error`, `scripts/**` exempt).
- `.prettierrc`: `{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }`.
- `jest.setup.ts`: Lumitrail's Node `TextDecoder`/`TextEncoder` restore (sql.js's WebAssembly glue needs the full Node implementation).
- `package.json` `scripts`: as listed in Interfaces (`"android": "expo run:android"`, `"lyfta:probe": "tsx scripts/lyfta-probe.ts"`). `jest` block: `preset: "jest-expo"`, `setupFilesAfterEnv`, `moduleNameMapper` `^@/(.*)$`, `testMatch` `<rootDir>/src/**/*.test.ts(x)`.
- `app/_layout.tsx`: a `Stack` from `expo-router`. `app/index.tsx`: a screen rendering the text `Health Hub`. Task 9 replaces both.

- [ ] **Step 4: Write the allowlist `.gitignore`**

```gitignore
# Allowlist: ignore everything at the root, then re-include project files.
/*
!/.gitignore
!/.prettierrc
!/.prettierignore
!/app.json
!/eslint.config.js
!/jest.setup.ts
!/package.json
!/package-lock.json
!/tsconfig.json
!/README.md
!/app/
!/assets/
!/docs/
!/scripts/
!/src/

# Never commit, even inside allowed folders.
.env
.env.*
*.jks
*.keystore
*.p8
*.p12
*.pem
*.key
*.apk
*.aab
*.hprof
btsnoop*
bugreport*
*.log
.DS_Store
```
Generated native folders (`android/`, `ios/`), `node_modules/`, `.expo/` and `expo-env.d.ts` stay ignored by the root `/*` rule.

- [ ] **Step 5: Write the smoke test**

```ts
// src/smoke.test.ts
import { z } from 'zod';
test('tooling runs TypeScript tests with the @/ alias available', () => {
  expect(z.number().parse(1)).toBe(1);
});
```

- [ ] **Step 6: Verify the toolchain**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass; Jest reports 1 passing test.

- [ ] **Step 7: Initialise git and commit**

```bash
git init -b main
git add -A && git status --short   # confirm only allowlisted files are staged
git commit -m "Scaffold Health Hub Expo app with tooling"
git switch -c jereenv/foundation-lyfta
```

---

### Task 2: Database interface, adapters and migrations

**Files:**
- Create: `src/data/db/SqlDatabase.ts`, `src/data/db/migrate.ts`, `src/data/db/schema.ts`, `src/data/db/expoSqlDatabase.ts`, `src/test-support/sqljsDatabase.ts`
- Test: `src/data/db/migrate.test.ts`

**Interfaces:**
- Produces:
```ts
// SqlDatabase.ts
export type SqlValue = string | number | null;
export interface RunResult { changes: number; lastInsertRowId: number }
export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
// migrate.ts
export function migrate(db: SqlDatabase, migrations: readonly string[]): Promise<number>; // returns final user_version
// schema.ts
export const DATABASE_NAME = 'health-hub.db';
export const MIGRATIONS: readonly string[];
// expoSqlDatabase.ts
export function openExpoSqlDatabase(name: string): Promise<SqlDatabase>;
// test-support/sqljsDatabase.ts
export function openTestDatabase(): Promise<SqlDatabase>; // in-memory, migrated to latest MIGRATIONS
export function openEmptyTestDatabase(): Promise<SqlDatabase>; // in-memory, no migrations
```

- [ ] **Step 1: Write the failing tests**

```ts
// src/data/db/migrate.test.ts
test('applies all migrations to a fresh database', async () => {
  const db = await openEmptyTestDatabase();
  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
  const tables = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  expect(tables.map((t) => t.name)).toEqual(
    expect.arrayContaining(['setting', 'sync_state', 'workout', 'workout_exercise', 'workout_set']),
  );
});
test('is a no-op when already at the latest version', async () => {
  const db = await openTestDatabase();
  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
});
test('rolls back a failing migration and keeps the previous version', async () => {
  const db = await openEmptyTestDatabase();
  await expect(migrate(db, [...MIGRATIONS, 'CREATE TABLE broken (;'])).rejects.toThrow();
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  expect(row?.user_version).toBe(MIGRATIONS.length);
});
test('deleting a workout cascades to its exercises and sets', async () => {
  const db = await openTestDatabase();
  await db.run(
    "INSERT INTO workout VALUES (1, '2026-08-20T17:05:00.000Z', 'A', NULL, NULL, '{}', '2026-11-12T00:00:00.000Z')",
  );
  await db.run("INSERT INTO workout_exercise VALUES (10, 1, 0, 2, 'Bench Press', 'weight_reps', 180)");
  await db.run('INSERT INTO workout_set VALUES (100, 10, 0, 80, 5, 2, NULL, NULL, NULL, 1)');
  await db.run('DELETE FROM workout WHERE lyfta_id = 1');
  expect(await db.first('SELECT * FROM workout_set')).toBeNull();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/data/db`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

- `schema.ts` `MIGRATIONS[0]` (v1), exactly this column order (Task 2's tests insert positionally):
```sql
CREATE TABLE workout (
  lyfta_id INTEGER PRIMARY KEY NOT NULL, performed_at TEXT NOT NULL, title TEXT NOT NULL,
  total_volume_kg REAL, body_weight_kg REAL, raw_json TEXT NOT NULL, synced_at TEXT NOT NULL);
CREATE INDEX idx_workout_performed_at ON workout (performed_at);
CREATE TABLE workout_exercise (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workout (lyfta_id) ON DELETE CASCADE,
  position INTEGER NOT NULL, exercise_id INTEGER NOT NULL, name TEXT NOT NULL,
  exercise_type TEXT NOT NULL, rest_time_s INTEGER);
CREATE INDEX idx_workout_exercise_workout ON workout_exercise (workout_id);
CREATE INDEX idx_workout_exercise_exercise ON workout_exercise (exercise_id);
CREATE TABLE workout_set (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercise (id) ON DELETE CASCADE,
  position INTEGER NOT NULL, weight_kg REAL, reps INTEGER, rir REAL,
  duration REAL, distance REAL, set_type TEXT, completed INTEGER NOT NULL);
CREATE TABLE sync_state (
  source TEXT PRIMARY KEY NOT NULL, cursor TEXT, last_success_at TEXT,
  last_error TEXT, last_error_at TEXT);
CREATE TABLE setting (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
```
`duration` and `distance` keep Lyfta's own units until Task 8's probe confirms them.
- `migrate`: Lumitrail's `user_version` ladder, except each step and its `PRAGMA user_version = N` run **inside the same transaction**, so a failed step leaves the version unchanged.
- Both adapters run `PRAGMA foreign_keys = ON` on open (the expo adapter also sets `PRAGMA journal_mode = WAL`). `transaction` uses `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`-on-throw, serialised through an internal promise-chain lock so two concurrent transactions never interleave.
- `sqljsDatabase.ts`: `initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })`; `lastInsertRowId` from `SELECT last_insert_rowid()`, `changes` from `db.getRowsModified()`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/data/db`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/data/db src/test-support
git commit -m "Add SQLite interface, adapters and migration runner"
```

---

### Task 3: Workout types and Lyfta parser

**Files:**
- Create: `src/domain/workouts/types.ts`, `src/data/lyfta/LyftaError.ts`, `src/data/lyfta/parseNumeric.ts`, `src/data/lyfta/parseWorkouts.ts`, `src/data/lyfta/__fixtures__/sandbox-workouts.json`
- Test: `src/data/lyfta/parseNumeric.test.ts`, `src/data/lyfta/parseWorkouts.test.ts`

**Interfaces:**
- Produces:
```ts
// domain/workouts/types.ts
export type WeightUnit = 'kg' | 'lb';
export interface WorkoutSet { position: number; weightKg: number | null; reps: number | null; rir: number | null;
  duration: number | null; distance: number | null; setType: string | null; completed: boolean }
export interface WorkoutExercise { position: number; exerciseId: number; name: string; exerciseType: string;
  restTimeS: number | null; sets: WorkoutSet[] }
export interface Workout { lyftaId: number; performedAt: string; title: string; totalVolumeKg: number | null;
  bodyWeightKg: number | null; exercises: WorkoutExercise[] }
// LyftaError.ts
export type LyftaErrorKind = 'unauthorized' | 'rate_limited' | 'bad_request' | 'server' | 'network' | 'invalid_response';
export class LyftaError extends Error { readonly kind: LyftaErrorKind; readonly status?: number;
  constructor(kind: LyftaErrorKind, message: string, status?: number) }
// parseNumeric.ts
export function parseNumeric(value: unknown): number | null;
// parseWorkouts.ts
export const LB_TO_KG = 0.45359237;
export interface ParsedWorkout { workout: Workout; rawJson: string }
export interface ParsedWorkoutPage { workouts: ParsedWorkout[]; skipped: number; currentPage: number; totalPages: number }
export function parseWorkoutPage(json: unknown, unit: WeightUnit): ParsedWorkoutPage;
```

- [ ] **Step 1: Save the public sandbox fixture**

Run: `curl -sS https://my.lyfta.app/api/sandbox/v1/workouts > src/data/lyfta/__fixtures__/sandbox-workouts.json`
Expected: JSON with `"sandbox": true` and 2 workouts (ids 1001, 1002). This is Lyfta's public sample data, safe to commit.

- [ ] **Step 2: Write the failing tests**

```ts
// parseNumeric.test.ts
test.each([
  ['80', 80], ['82.5', 82.5], ['82,5', 82.5], [' 7 ', 7], [12, 12],
  ['', null], ['abc', null], [null, null], [undefined, null], [Number.NaN, null],
])('parseNumeric(%p) = %p', (input, expected) => expect(parseNumeric(input)).toBe(expected));

// parseWorkouts.test.ts
const sandbox = require('./__fixtures__/sandbox-workouts.json');
test('parses the sandbox page in kg', () => {
  const page = parseWorkoutPage(sandbox, 'kg');
  expect(page).toMatchObject({ skipped: 0, currentPage: 1, totalPages: 1 });
  const upper = page.workouts[0].workout;
  expect(upper).toMatchObject({ lyftaId: 1001, title: 'Upper Strength',
    performedAt: '2026-08-20T17:05:00.000Z', totalVolumeKg: 12400, bodyWeightKg: 82 });
  expect(upper.exercises[0]).toMatchObject({ position: 0, exerciseId: 2, name: 'Bench Press',
    exerciseType: 'weight_reps', restTimeS: 180 });
  expect(upper.exercises[0].sets).toEqual([
    { position: 0, weightKg: 80, reps: 5, rir: 2, duration: null, distance: null, setType: '1', completed: true },
    { position: 1, weightKg: 90, reps: 3, rir: 1, duration: null, distance: null, setType: '1', completed: true },
  ]);
  expect(JSON.parse(page.workouts[0].rawJson).id).toBe(1001);
});
test('converts pounds to kilograms', () => {
  const set = parseWorkoutPage(sandbox, 'lb').workouts[0].workout.exercises[0].sets[0];
  expect(set.weightKg).toBeCloseTo(80 * LB_TO_KG, 6);
});
test('parses empty and non-numeric strings as null', () => {
  const json = structuredClone(sandbox);
  Object.assign(json.workouts[0].exercises[0].sets[0], { weight: '', reps: 'abc', rir: '' });
  const set = parseWorkoutPage(json, 'kg').workouts[0].workout.exercises[0].sets[0];
  expect(set).toMatchObject({ weightKg: null, reps: null, rir: null });
});
test('skips invalid workouts and counts them', () => {
  const json = structuredClone(sandbox);
  json.workouts[1].workout_perform_date = 'not a date';
  const page = parseWorkoutPage(json, 'kg');
  expect(page.workouts.map((w) => w.workout.lyftaId)).toEqual([1001]);
  expect(page.skipped).toBe(1);
});
test('treats a workout without exercises as empty', () => {
  const json = structuredClone(sandbox);
  delete json.workouts[0].exercises;
  expect(parseWorkoutPage(json, 'kg').workouts[0].workout.exercises).toEqual([]);
});
test('rejects a response without a workouts array', () => {
  expect(() => parseWorkoutPage({}, 'kg')).toThrow(expect.objectContaining({ kind: 'invalid_response' }));
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx jest src/data/lyfta`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement**

- `parseNumeric`: finite numbers pass through; strings are trimmed, a single `,` becomes `.`, then `Number()`; anything empty or non-finite is `null`.
- `parseWorkoutPage`: a zod schema for the page envelope (`workouts` array required; `current_page`/`total_pages` default to 1). Each workout is validated separately with `safeParse`; failures (including an unparseable `workout_perform_date`) increment `skipped`. `reps` is rounded to an integer. `weight`, `total_volume`, `body_weight` are multiplied by `LB_TO_KG` when `unit === 'lb'`. `performedAt` is `new Date(value).toISOString()`. `rawJson` is `JSON.stringify` of that workout's original object. Positions are array indexes.

- [ ] **Step 5: Run to verify they pass**

Run: `npx jest src/data/lyfta`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/domain/workouts src/data/lyfta
git commit -m "Parse Lyfta workouts with validation and unit conversion"
```

---

### Task 4: Lyfta HTTP client

**Files:**
- Create: `src/data/lyfta/LyftaClient.ts`
- Test: `src/data/lyfta/LyftaClient.test.ts`

**Interfaces:**
- Consumes: `LyftaError` (Task 3).
- Produces:
```ts
export const LYFTA_BASE_URL = 'https://my.lyfta.app';
export interface LyftaClientDeps {
  fetchFn: typeof fetch;
  getApiKey: () => Promise<string | null>;
  baseUrl?: string;                       // default LYFTA_BASE_URL
  now?: () => number;                     // default Date.now
  sleep?: (ms: number) => Promise<void>;  // default setTimeout-based
  minIntervalMs?: number;                 // default 1100 (keeps under 60/min)
  maxRetries?: number;                    // default 3 (for 429 only)
  timeoutMs?: number;                     // default 30000
}
export interface LyftaClient {
  listWorkouts(p: { page: number; limit: number; from?: string; to?: string }): Promise<unknown>;
  listSchedule(p: { from?: string; to?: string; includeCompleted?: boolean }): Promise<unknown>;
  getProfile(): Promise<unknown>;
  getExerciseProgress(): Promise<unknown>;
}
export function createLyftaClient(deps: LyftaClientDeps): LyftaClient;
```

- [ ] **Step 1: Write the failing tests**

Use a fake `fetchFn` (a `jest.fn` returning `new Response(...)`), a fake clock (`now` returns a mutable number) and a recording `sleep` that advances the clock.

```ts
test('sends the bearer key and query parameters', async () => {
  // listWorkouts({ page: 2, limit: 100, from: '2026-11-01', to: '2026-11-14' })
  // expect URL 'https://my.lyfta.app/api/v1/workouts?page=2&limit=100&from=2026-11-01&to=2026-11-14'
  // expect headers.Authorization === 'Bearer test-key'; resolves to the parsed JSON body
});
test('fails as unauthorized without a key and makes no request');      // getApiKey → null
test('maps 401 to unauthorized');                                       // kind 'unauthorized', status 401
test('maps 500 to server and a thrown fetch to network');
test('maps a non-JSON body to invalid_response');
test('waits for Retry-After on 429 then succeeds');                     // sleep called with 5000 for 'Retry-After: 5'
test('backs off 2s, 4s, 8s then fails as rate_limited');                // 4 × 429, no header
test('spaces consecutive requests by minIntervalMs');                    // 2 calls at t=0 → sleep(1100)
test('never includes the key in error messages');                       // error.message does not contain 'test-key'
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/data/lyfta/LyftaClient`
Expected: FAIL.

- [ ] **Step 3: Implement `createLyftaClient(deps)` in `src/data/lyfta/LyftaClient.ts`**

Paths: `/api/v1/workouts`, `/api/v1/schedule` (`include_completed=true|false`), `/api/v1/profile`, `/api/v1/exercises/progress`. Omit undefined query params. Timeout via `AbortController` + `setTimeout`. Rate spacing: remember the last request start time; wait `minIntervalMs − elapsed` before the next request. Retries apply only to 429 (Retry-After seconds, else 2000 ms doubling). 400 → `bad_request`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/data/lyfta/LyftaClient`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/data/lyfta/LyftaClient.ts src/data/lyfta/LyftaClient.test.ts
git commit -m "Add Lyfta API client with rate limiting and retries"
```

---

### Task 5: Workout repository

**Files:**
- Create: `src/data/workouts/WorkoutRepository.ts`, `src/data/workouts/sqliteWorkoutRepository.ts`
- Test: `src/data/workouts/sqliteWorkoutRepository.test.ts`

**Interfaces:**
- Consumes: `SqlDatabase`, `openTestDatabase` (Task 2); `Workout`, `ParsedWorkout`, `parseWorkoutPage` (Task 3).
- Produces:
```ts
export interface WorkoutRepository {
  upsertMany(items: readonly ParsedWorkout[], syncedAt: string): Promise<{ inserted: number; updated: number }>;
  deleteMissingInRange(fromIso: string, toIso: string, keepIds: readonly number[]): Promise<number>;
  count(): Promise<number>;
  list(p: { limit: number; beforePerformedAt?: string }): Promise<Workout[]>; // newest first
  get(lyftaId: number): Promise<Workout | null>;
}
export function createSqliteWorkoutRepository(db: SqlDatabase): WorkoutRepository;
```

- [ ] **Step 1: Write the failing tests** (sandbox fixture parsed in kg)

```ts
test('inserts workouts with exercises and sets', async () => {
  // upsertMany(sandbox) → { inserted: 2, updated: 0 }; count() → 2
  // get(1001) deep-equals the parsed Workout for 1001
});
test('upsert replaces exercises and sets', async () => {
  // upsert sandbox, then upsert a copy where 1001's first set weight is 85
  // → { inserted: 0, updated: 1 }; get(1001).exercises[0].sets[0].weightKg === 85; sets length still 2
});
test('lists newest first and pages with beforePerformedAt', async () => {
  // list({ limit: 1 }) → [1002]; list({ limit: 1, beforePerformedAt: '2026-08-22T16:30:00.000Z' }) → [1001]
});
test('deleteMissingInRange removes only absent workouts inside the range', async () => {
  // range 2026-08-21T00:00:00.000Z .. 2026-08-23T23:59:59.999Z, keepIds [] → returns 1; get(1002) null; get(1001) kept
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/data/workouts`
Expected: FAIL.

- [ ] **Step 3: Implement `createSqliteWorkoutRepository(db)`**

Each `upsertMany` runs in one `db.transaction`. Per workout: check existence, `INSERT ... ON CONFLICT(lyfta_id) DO UPDATE` the row, delete its `workout_exercise` rows (sets cascade), reinsert exercises and sets in position order. `get`/`list` read with ordered queries (`position ASC`) and assemble nested objects. `completed` is stored as 0/1.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/data/workouts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/data/workouts
git commit -m "Store Lyfta workouts in SQLite"
```

---

### Task 6: Sync state, settings and secret storage

**Files:**
- Create: `src/data/sync/SyncStateRepository.ts`, `src/data/settings/SettingsRepository.ts`, `src/data/secrets/SecretStore.ts`, `src/data/secrets/expoSecretStore.ts`, `src/test-support/InMemorySecretStore.ts`
- Test: `src/data/sync/SyncStateRepository.test.ts`, `src/data/settings/SettingsRepository.test.ts`

**Interfaces:**
- Consumes: `SqlDatabase`, `openTestDatabase` (Task 2).
- Produces:
```ts
// SyncStateRepository.ts — later plans widen SyncSource
export type SyncSource = 'lyfta';
export interface SyncState { source: SyncSource; cursor: string | null; lastSuccessAt: string | null;
  lastError: string | null; lastErrorAt: string | null }
export interface SyncStateRepository {
  get(source: SyncSource): Promise<SyncState>;              // all-null state when no row
  saveCursor(source: SyncSource, cursor: string | null): Promise<void>;
  recordSuccess(source: SyncSource, at: string, cursor: string | null): Promise<void>; // clears lastError
  recordError(source: SyncSource, message: string, at: string): Promise<void>;        // keeps lastSuccessAt
}
export function createSqliteSyncStateRepository(db: SqlDatabase): SyncStateRepository;
// SettingsRepository.ts
export type SettingKey = 'lyfta.weightUnit';
export interface SettingsRepository { get(key: SettingKey): Promise<string | null>; set(key: SettingKey, value: string): Promise<void> }
export function createSqliteSettingsRepository(db: SqlDatabase): SettingsRepository;
// SecretStore.ts
export const SECRET_KEYS = { lyftaApiKey: 'lyfta_api_key' } as const;
export interface SecretStore { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; delete(key: string): Promise<void> }
// expoSecretStore.ts
export function createExpoSecretStore(): SecretStore;  // expo-secure-store wrapper
// test-support/InMemorySecretStore.ts
export class InMemorySecretStore implements SecretStore {}
```

- [ ] **Step 1: Write the failing tests**

```ts
test('returns an empty state for a source never synced');
test('recordSuccess stores time and cursor and clears the last error');
test('recordError keeps the last success time');
test('saveCursor updates only the cursor');
test('settings round-trip and return null when unset');
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/data/sync src/data/settings`
Expected: FAIL.

- [ ] **Step 3: Implement** the three repositories with `INSERT ... ON CONFLICT ... DO UPDATE` upserts, `createExpoSecretStore` over `getItemAsync`/`setItemAsync`/`deleteItemAsync`, and the in-memory store over a `Map`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/data/sync src/data/settings`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/data/sync src/data/settings src/data/secrets src/test-support/InMemorySecretStore.ts
git commit -m "Add sync state, settings and secure key storage"
```

---

### Task 7: Lyfta sync service

**Files:**
- Create: `src/data/lyfta/lyftaSync.ts`
- Test: `src/data/lyfta/lyftaSync.test.ts`

**Interfaces:**
- Consumes: `LyftaClient`, `LyftaError` (Tasks 3–4); `WorkoutRepository` (Task 5); `SyncStateRepository`, `SettingsRepository`, `SecretStore`, `SECRET_KEYS` (Task 6); `parseWorkoutPage` (Task 3).
- Produces:
```ts
export const LYFTA_PAGE_SIZE = 100;
export type LyftaSyncResult =
  | { status: 'not_configured' }
  | { status: 'invalid_key' }
  | { status: 'ok'; mode: 'backfill' | 'incremental'; inserted: number; updated: number; deleted: number; skipped: number }
  | { status: 'error'; message: string };
export interface LyftaSyncDeps { client: LyftaClient; workouts: WorkoutRepository; syncState: SyncStateRepository;
  settings: SettingsRepository; secrets: SecretStore; now: () => Date }
export function incrementalWindow(lastSuccessAt: Date, now: Date): { from: string; to: string };
export function syncLyfta(deps: LyftaSyncDeps): Promise<LyftaSyncResult>;
export function createLyftaSyncRunner(deps: LyftaSyncDeps): { run(): Promise<LyftaSyncResult> };
```

- [ ] **Step 1: Write the failing tests**

Use a fake `LyftaClient` whose `listWorkouts` serves pages built from the sandbox workouts (vary `id` and `workout_perform_date` to make N workouts across P pages), real SQLite repositories on `openTestDatabase()`, `InMemorySecretStore` holding `'test-key'`.

```ts
test('incrementalWindow pads 8 days back and 1 day forward in UTC', () => {
  expect(incrementalWindow(new Date('2026-11-12T10:00:00Z'), new Date('2026-11-13T09:00:00Z')))
    .toEqual({ from: '2026-11-04', to: '2026-11-14' });
});
test('returns not_configured without a key and calls nothing');
test('backfills every page, then clears the cursor and records success');
  // 3 pages → listWorkouts called with page 1, 2, 3 (limit 100, no from/to); mode 'backfill'; count = all
test('resumes backfill from saved cursor');
  // page 2 throws network once → result 'error', cursor '2'; next run calls pages 2, 3 only; no duplicates
test('runs incrementally after a successful backfill using the window');
  // listWorkouts called with from/to from incrementalWindow(lastSuccessAt, now); mode 'incremental'
test('deletes workouts removed in Lyfta within window');
  // stored workout inside window absent from response → deleted: 1; workout outside window kept
test('does not delete anything when an incremental page fails');
test('returns invalid_key and keeps data on 401');
  // syncState.lastError === 'invalid_key'; workouts.count() unchanged
test('reports skipped workouts from the parser');
test('uses the lyfta.weightUnit setting, defaulting to kg');
test('concurrent runs share one sync');
  // runner.run() twice without awaiting → same promise result; listWorkouts page 1 called once
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/data/lyfta/lyftaSync`
Expected: FAIL.

- [ ] **Step 3: Implement**

- No key → `not_configured`.
- `lastSuccessAt === null` → **backfill**: start at `Number(cursor ?? 1)`; for each page: fetch, parse, upsert, `saveCursor(String(page + 1))`; stop after `page >= totalPages` or an empty page; then `recordSuccess(now, null)`.
- Otherwise → **incremental**: fetch every page of the `incrementalWindow`, upsert, then `deleteMissingInRange(from + 'T00:00:00.000Z', to + 'T23:59:59.999Z', allReturnedIds)`; then `recordSuccess`.
- `LyftaError` `unauthorized` → `recordError('invalid_key')`, return `invalid_key`. Any other error → `recordError(message)`, return `error` (cursor left as saved). Deletion runs only after every page in the window succeeded.
- `createLyftaSyncRunner`: holds the in-flight promise; `run()` returns it while pending.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/data/lyfta/lyftaSync`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/data/lyfta/lyftaSync.ts src/data/lyfta/lyftaSync.test.ts
git commit -m "Sync Lyfta history with resumable backfill"
```

---

### Task 8: Lyfta response-shape probe

Lyfta documents the workout shape but not `/profile`, `/schedule` or `/exercises/progress`, and not the weight unit. This task records their **shapes only** (field names and types, never values) so Plan 2 can parse them.

**Files:**
- Create: `src/data/lyfta/describeShape.ts`, `scripts/lyfta-probe.ts`, `docs/research/lyfta-api-shapes.md`
- Test: `src/data/lyfta/describeShape.test.ts`

**Interfaces:**
- Consumes: `createLyftaClient` (Task 4).
- Produces: `export function describeShape(value: unknown): unknown;` and the research doc Plan 2 reads.

- [ ] **Step 1: Write the failing test**

```ts
test('describes structure without values', () => {
  expect(describeShape({ a: 'secret', b: [{ c: 1 }], d: null, e: true, f: [] }))
    .toEqual({ a: 'string', b: [{ c: 'number' }], d: 'null', e: 'boolean', f: [] });
});
test('merges keys across array items', () => {
  expect(describeShape([{ a: 1 }, { b: 'x' }])).toEqual([{ a: 'number', b: 'string' }]);
});
```

- [ ] **Step 2: Run to verify it fails**, then **implement** `describeShape` (recursive; arrays merge item shapes; primitives become their type name), then **run to verify it passes**.

Run: `npx jest src/data/lyfta/describeShape`
Expected: FAIL, then 2 passing after implementing.

- [ ] **Step 3: Write `scripts/lyfta-probe.ts`**

Reads the key with `execFileSync('security', ['find-generic-password', '-s', 'health-hub-lyfta', '-w'])`, builds `createLyftaClient({ fetchFn: fetch, getApiKey })`, calls `getProfile()`, `listSchedule({ includeCompleted: true })`, `listWorkouts({ page: 1, limit: 1 })`, `getExerciseProgress()`, and prints `describeShape` of each as labelled JSON. It never prints the key or any raw response.

- [ ] **Step 4: Owner stores the key (owner action, in their own Terminal app, not in chat)**

```bash
security add-generic-password -a "$USER" -s health-hub-lyfta -w
```
macOS prompts for the key and stores it in the Keychain.

- [ ] **Step 5: Run the probe**

Run: `npm run lyfta:probe`
Expected: four labelled shapes, no values.

- [ ] **Step 6: Write `docs/research/lyfta-api-shapes.md`**

Record the four shapes, and answer: which field gives the weight unit; units of `duration` and `distance`; what `set_type_id` values mean if discoverable; the schedule item fields. Before committing, read the file and confirm it contains no personal values or key material.

- [ ] **Step 7: Commit**

```bash
git add src/data/lyfta/describeShape.ts src/data/lyfta/describeShape.test.ts scripts/lyfta-probe.ts docs/research/lyfta-api-shapes.md
git commit -m "Add Lyfta response-shape probe and record findings"
```

If the probe shows the weight unit comes from the API, set `lyfta.weightUnit` from it in Task 9's container instead of defaulting to `kg`.

---

### Task 9: App wiring, developer screen and on-device check

A temporary developer screen proves the whole pipeline on the phone. Plan 2 replaces it with the real UI.

**Files:**
- Create: `src/app/container.ts`, `src/app/ContainerContext.tsx`
- Modify: `app/_layout.tsx`, `app/index.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces:
```ts
export interface AppContainer { workouts: WorkoutRepository; syncState: SyncStateRepository;
  settings: SettingsRepository; secrets: SecretStore; lyftaSync: { run(): Promise<LyftaSyncResult> } }
export function createAppContainer(): Promise<AppContainer>; // opens + migrates health-hub.db
export function ContainerProvider(props: { children: React.ReactNode }): React.JSX.Element;
export function useContainer(): AppContainer;
```

- [ ] **Step 1: Implement the container and provider**

`createAppContainer` opens `DATABASE_NAME` via `openExpoSqlDatabase`, runs `migrate(db, MIGRATIONS)`, creates the repositories, `createExpoSecretStore()`, a client whose `getApiKey` reads `SECRET_KEYS.lyftaApiKey`, and `createLyftaSyncRunner`. `ContainerProvider` creates it once, shows a loading state until ready and an error message if opening fails.

- [ ] **Step 2: Build the developer screen in `app/index.tsx`**

- Lyfta key field (`secureTextEntry`) with **Save** (stores in SecretStore, clears the field) and **Remove**. Shows "Key saved" / "No key", never the key.
- kg / lb toggle bound to `lyfta.weightUnit`.
- **Sync Lyfta** button (disabled while running) showing the `LyftaSyncResult`.
- Workout count, `lastSuccessAt`, `lastError`.
- The 5 newest workouts: date, title, exercise count, set count.

- [ ] **Step 3: Verify the app still builds and tests pass**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 4: Build and install on the Pixel**

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
adb devices            # expect 59180DLCQ00B36  device
npx expo run:android --device
```
Expected: the app opens on the phone showing the developer screen.

- [ ] **Step 5: On-device checks (owner taps, Claude watches `adb logcat` for errors)**

1. Paste the Lyfta key into the field on the phone, tap Save → "Key saved".
2. Tap Sync → `ok`, `backfill`, inserted = the owner's workout count in Lyfta (owner confirms against the Lyfta app).
3. Tap Sync again → `ok`, `incremental`, inserted 0.
4. Force-stop and reopen the app → count unchanged.
5. Newest workout's sets match what Lyfta shows (owner spot-checks one).
6. `adb logcat` shows no key material.

- [ ] **Step 6: Commit**

```bash
git add src/app app
git commit -m "Wire Lyfta sync into a developer screen"
```

---

### Task 10: Senssun cloud feasibility spike (research only)

Decides whether Plan 7 (old scale history with impedance) is possible. Static analysis only: no requests to Senssun's servers and no credentials in this task.

**Files:**
- Create: `docs/research/senssun-cloud-feasibility.md`
- Decompiled code and the APK stay in the scratchpad, never in the repo.

- [ ] **Step 1: Get the APK and decompiler**

```bash
SP=/private/tmp/claude-501/-Users-jereenvalsson-personal/a171047d-208a-4e7c-8069-cf7aad7e0aaa/scratchpad
mkdir -p "$SP/movinglife-apk"
[ -f "$SP/movinglife-apk/base.apk" ] || adb pull "$(adb shell pm path com.moving.movinglife | sed 's/package://')" "$SP/movinglife-apk/base.apk"
brew install jadx
jadx -d "$SP/movinglife-src" "$SP/movinglife-apk/base.apk"
```
Expected: decompiled sources under `$SP/movinglife-src/sources/`.

- [ ] **Step 2: Trace the cloud API**

Starting from `com/senssun/net/`, `com/senssun/auth/` and classes referencing `SWeightUploadUnClaimImpedanceDTO`, find: base URLs; login request (endpoint, fields, password hashing); how the session token is stored and sent; any request signing (keys, HMAC, timestamps); the endpoint(s) returning weigh-in history and whether impedance is in the response; pagination.

- [ ] **Step 3: Write `docs/research/senssun-cloud-feasibility.md`**

Contents: verdict (**feasible / feasible with caveats / not feasible**), the call sequence, the history record's fields, risks (signing keys embedded in the app, API changes), and exactly what a live test needs from the owner. Do **not** copy embedded signing secrets or API keys into the document; describe where they are instead.

- [ ] **Step 4: Commit**

```bash
git add docs/research/senssun-cloud-feasibility.md
git commit -m "Document Senssun cloud history feasibility"
```

---

## Done when

- `npm run typecheck && npm run lint && npm test` pass on `jereenv/foundation-lyfta`.
- On the Pixel, the developer screen shows the owner's full Lyfta history, and a second sync is incremental with no duplicates.
- `docs/research/lyfta-api-shapes.md` and `docs/research/senssun-cloud-feasibility.md` exist, with no secrets or personal values.
