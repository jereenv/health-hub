# Plan 5 — BLE Scale Implementation Plan (Tasks 44–50)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app talks to the owner's Bluetooth scale (TF-4001, advertises `IF_B2A`) by itself whenever it is in the foreground, shows the live weight on Today, and saves the final result as a `scale_reading` with `source = 'ble'`, `impedance_ohm` and `raw_payload`, so Body shows a solid point with formula metrics.

**Architecture:** Same layering as Plans 1–6. Bytes are handled by pure code in `src/domain/scale/` (frame codec, profile encoder, session reducer). A small orchestrator (`src/data/scale/scaleRunner.ts`) runs the reducer's effects against a `ScaleTransport` interface; the only file that imports `react-native-ble-manager` is `src/data/scale/expoBleScaleTransport.ts`. Saving goes through a repository that dedupes against every stored reading using match functions lifted out of `weighIns.ts`. The Today card is a presentational component fed by one hook.

**Tech Stack:** Plan 6's stack plus `react-native-ble-manager` 12.6.1 (exact), added in Task 44 with **one** dev-client rebuild.

**Spec:** `docs/superpowers/specs/2026-11-12-health-hub-design.md`, §8, §9, §11 (Today), §18 (items 4, 8). Protocol: `.superpowers/sdd/plan-5-protocol-note.md` (source of truth for bytes; the controller keeps it, builders read it). Plan 4's closing notes: `docs/superpowers/plans/2026-11-13-plan-4-body-composition.md` (Plan 5 (BLE), Rulings 3 and 7). UI follows `docs/design/ui-guidelines.md`.

**Final repo path of this file:** `docs/superpowers/plans/2026-11-13-plan-5-ble-scale.md`.

## Starting point (controller verifies before Task 44)

- Branch `jereenv/ble-scale`, from `main` at `218b451` (Plans 1–4 and 6 merged). `MIGRATIONS.length === 7`; Plan 5 adds **no** migration (`scale_reading` already has `source`, `impedance_ohm`, `raw_payload`, `device_id`, `UNIQUE (source, source_record_id)`).
- `app/(tabs)/(today)/index.tsx` re-exports `src/ui/screens/placeholders/TodayScreen.tsx` (an `EmptyState`).
- `node_modules/react-native-ble-manager` does not exist; `app.json` has no Bluetooth plugin or permission.
- `weighIns.ts` holds the weigh-in match functions privately; `WEIGH_IN_WINDOW_MS = 120_000`, `WEIGH_IN_WEIGHT_TOLERANCE_KG = 0.1` live in `src/data/healthconnect/constants.ts`.

## Research (done while writing this plan)

| Question | Finding | Evidence |
|---|---|---|
| Library | `react-native-ble-manager@12.6.1` exists on npm; peer deps `react`, `react-native` only. Chosen by the owner's controller: New Architecture TurboModule with an Expo config plugin (`app.plugin.js`). Not `react-native-ble-plx`, not 13.x. | `npm view react-native-ble-manager@12.6.1`; controller decision |
| Android 12+ permissions | `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` are runtime permissions. With `neverForLocation` on `BLUETOOTH_SCAN` scanning needs no location permission or Location switch. Runtime requests use React Native's built-in `PermissionsAndroid` (no extra package). | Android docs "Bluetooth permissions"; RN `PermissionsAndroid` |
| Plugin options, library API names | **Unknown until Task 44.** The builder reads `node_modules/react-native-ble-manager/app.plugin.js` and `lib/index.d.ts` (or the typings entry in its `package.json`) and records the real option names and function names in the ledger. | Task 44 Step 2 |

## Global Constraints

- Project root `/Users/jereenvalsson/personal/health-hub`. Expo SDK 57, React Native 0.86, React 19.2, TypeScript ~6.0.3, New Architecture. Android only; the phone is Android 12 or newer (below that the card says "not supported", Ruling 8).
- Files under `src/domain/` and `src/data/` must not import `react-native` or `expo-*`, except adapter files named `expo*.ts`. Tests run in plain Node (Jest 29, sql.js, `TZ=America/New_York`). **`react-native-ble-manager` is imported only by `src/data/scale/expoBleScaleTransport.ts`** and no test imports that file.
- Path alias `@/` → `src/`. Stored timestamps are ISO-8601 UTC strings; stored weights are kg. Never pass non-ISO strings to `new Date`.
- **Private data.** The owner's weights, impedance, user id and captured bytes never appear in code, fixtures, logs, commits or reports. Test frames are **synthetic**: built by the `buildFrame` test helper (Task 45) from invented numbers that follow the real layout (for example 80.0 kg, 500 Ω). **Never log frame bytes, weights or impedance** (no `console.*` of them, no error message that embeds them).
- **Save rule (binding):** only a fresh (`kind 0x00`) 0x82 result is ever saved, once per distinct frame per connection; `0xFF` replays are never saved. Impedance is payload offset 9 (`IMPEDANCE_OFFSET`, Plan 4 Ruling 3). The saved weight is the 0x82 value, never the live 0x80 value.
- Weigh-in dedupe is the existing `time_window` rule (±`WEIGH_IN_WINDOW_MS`, ±`WEIGH_IN_WEIGHT_TOLERANCE_KG`). Wipe keeps `source = 'ble'` rows (Plan 3 Ruling 8; unchanged).
- Design rules are Plan 2's: colours only from `src/ui/theme/tokens.ts`, Geist fonts, tabular figures, 44×44 touch targets, bottom sheets not `Modal`/`Alert`, skeletons not `ActivityIndicator`, no shadows, cards radius 20–24 with a 1px `line` border. A status colour never appears without its text.
- **Builders never run adb, never uninstall the app (SecureStore holds a key), never run `expo prebuild --clean` or `expo run:android`, never read the macOS Keychain, and never dispatch subagents.** Only the controller drives the phone (adb serial `59180DLCQ00B36`, app id `com.jereenv.healthhub`) and does native rebuilds.
- TDD: write the failing test, see it fail, implement, see it pass. Before every commit run `npx tsc --noEmit && npx eslint . && npm test` (and `npm run format:check`); eslint must show no new warnings. Check `git diff --cached` for secrets and personal data. Commit messages are imperative, under 72 characters, no AI attribution, no Co-Authored-By. Commits are SSH-signed via 1Password; if signing fails, wait 30 s and retry once, then report BLOCKED. Never bypass signing.
- Never stage `android/`, `.expo/`, `.superpowers/` or `node_modules/`. New root files need a `.gitignore` allowlist entry; prefer `src/`.
- Scope: the owner says this app is "just an exporter" for them, so do not over-engineer. Plan only what makes a real weigh-in land correctly. **Not in Plan 5:** background or notification scanning, multiple scales, a pairing screen, firmware (OAD), user profiles on the scale, Senssun cloud (Plan 7), Today content beyond the card (Plan 8).

## Rulings (made while planning)

Each is "ruling — why — cost if wrong".

- **Ruling 1 — the handshake (minimum that is likely to work).** After enabling notifications on FFF1, Health Hub writes, in order, **0x0D** (`02 00 00`), then **0x01** (the user profile), about 150 ms apart (`WRITE_GAP_MS`), all write-without-response to FFF2. It does **not** send 0x02 and does **not** re-send the profile after a fresh result. It does not wait for the 0x81 ack; the ack is decoded and ignored. *Why:* the protocol note says 0x02 only triggers 0xFF replays, which we would have to suppress; the 0x01 profile is the most likely trigger for an impedance measurement; re-sending the profile after the result only prepares the next weigh-in. *Cost if wrong:* the device check (Task 50) has an explicit ladder, each rung one constant in `src/domain/scale/protocol.ts` (`HANDSHAKE_STEPS`, `RESEND_PROFILE_AFTER_STABLE_MS`): **if no fresh 0x82 arrives within 15 s of the first stable (0xAA) live frame, (a) set `RESEND_PROFILE_AFTER_STABLE_MS = 2000` (MovingLife's behaviour); if still none, (b) add the two 0x02 writes to `HANDSHAKE_STEPS` (replays are already suppressed); if still none, (c) change `HEALTH_HUB_USER_ID` to `FALLBACK_USER_ID`.** Replays and weight-only results are never saved to make a rung "work".
- **Ruling 2 — the profile's user id.** `HEALTH_HUB_USER_ID = 0x4801` (arbitrary, not MovingLife's, which is private). The 0x82 user id is **not checked**: the scale may echo its own slot number. Fallback id `FALLBACK_USER_ID = 0x0001`, used only by ladder rung (c) of Ruling 1. *Cost if wrong:* one constant.
- **Ruling 3 — profile when data is missing.** Payload `00 00 | uid | sex | height | age | 00 00 | lastWeight`. Sex: `male` → 0x01, `female` → 0x00 (0x00 is **unverified**; the owner is male), missing → 0x01. Height: `profile.heightCm` rounded, else 175; clamped to `PROFILE_LIMITS.heightCm`, outside → 175. Age: `ageOn(birthDate, today)` clamped to `PROFILE_LIMITS.ageYears`, missing or outside → 30. Last weight: the latest stored reading's `weightKg × 10` rounded to a u16, no reading → 0. *Why:* the scale uses these only for its own body-fat figures, which we discard (the engine uses our formulas); the impedance does not depend on them. *Cost if wrong:* none expected; if the device check shows the scale refuses a profile with weight 0, use 700.
- **Ruling 4 — the frame reassembler.** `createFrameAssembler()` keeps one buffer and `push(bytes, nowMs)` returns the complete, checksum-valid frames found, in order. (a) Bytes before a header `10 00 00 C5` are dropped. (b) A header whose LEN is below 9 or above 40 (`MAX_FRAME_LEN`) drops one byte and resyncs. (c) A frame is emitted only when LEN bytes are present; a **split 0x82** therefore waits for its second piece (the piece has no header and is simply appended). (d) A **bad checksum** drops the first byte of that header and resyncs, so one corrupt frame cannot swallow the next good one. (e) A partial frame older than 1 s (`STALE_PARTIAL_MS`) is cleared before the next push. (f) An **unknown cmd** with a valid checksum is consumed and decoded as `{ type: 'unknown' }` and ignored by the session. (g) A known cmd with a payload shorter than its layout is decoded as `{ type: 'malformed' }` and ignored. The assembler never throws. *Why:* BLE notifications arrive in 20-byte pieces and a lost or glued piece must not wedge the session. *Cost if wrong:* a missed weigh-in; the person steps on again.
- **Ruling 5 — device discovery.** Scan with service filter FFF0 (`SERVICE_UUID`) for at most `SCAN_TIMEOUT_MS = 90_000` (the scale only advertises when woken by a step, so the window is long; no automatic re-scan after it ends, the card offers "Try again"). A scan result matches when `peripheral.id === rememberedId`; with nothing remembered, when `peripheral.name === 'IF_B2A'`. The first matching result stops the scan. Connect timeout `CONNECT_TIMEOUT_MS = 10_000`. The id is remembered (setting `ble.scaleDeviceId`) the first time a frame arrives from it, not at pairing. *Why:* a neighbour's scale with the same name must not be taken once ours is known; remembering after the first frame proves the device speaks the protocol. *Cost if wrong:* the card says "Can't find the scale"; a new scale needs the setting cleared by hand (accepted, Ruling 9).
- **Ruling 6 — foreground only (owner answer 1).** `AppState` `active` → start; any other state → stop the scan and disconnect, UI `idle`. A foreground always starts a fresh run, so a saved card does not survive a background. After a disconnect **before** a save the runner reconnects automatically up to `MAX_AUTO_RECONNECTS = 2` times, 1 s apart, then shows "Connection lost" with Retry. After a save a disconnect is silent (the card stays on "saved"). *Cost if wrong:* constants.
- **Ruling 7 — what is saved and when.** A fresh 0x82 with weight `MIN_BLE_WEIGHT_KG` (20) to `MAX_BLE_WEIGHT_KG` (400) is saved with: `measured_at` = the phone's time when the frame was received, `weight_kg` = payload `[3..4] / 10`, `impedance_ohm` = payload `[9..10]` or **NULL when that value is 0** (the engine then shows weight and BMI only; a zero never becomes an impedance), `source = 'ble'`, `source_record_id` = `<raw payload hex>@<measured_at>`, `raw_payload` = the whole frame as lowercase hex, `device_id` = the peripheral id. The session suppresses a repeat of the same frame hex within one connection until a live frame with the **settling** flag (0xA0) arrives (the person stepped on again). The repository (Ruling 10) is the second guard. *Why:* the result repeats every 3 s. *Cost if wrong:* a duplicate row; the DB guard makes that unlikely.
- **Ruling 8 — permission and Bluetooth-off states.** Preflight order: Android API below 31 → `off`/`unsupported`; permissions missing → `off`/`permission_needed` (one button "Allow Bluetooth", which requests); the request answered "never ask again" → `off`/`permission_blocked` (one button "Open settings"); Bluetooth off → `off`/`bluetooth_off` (one button "Turn on Bluetooth", which asks Android to enable it). Every button then runs the preflight again. No location permission is added (Android 12+ with `neverForLocation`). *Cost if wrong:* if the plugin cannot set `neverForLocation` (Task 44 Step 2), the builder stops and reports instead of adding `ACCESS_FINE_LOCATION`.
- **Ruling 9 — accepted edge cases (not built).** Another app (MovingLife) holding the connection; two scales; resetting the remembered scale; a second weigh-in with byte-identical frames inside the same connection and 2 minutes; a clock change between a BLE save and a Health Connect import; Android below 12; female profile byte unverified; no "unknown device" picker; no live weight in the background.
- **Ruling 10 — dedupe across sources.** The match functions move from `weighIns.ts` into `src/data/body/weighInMatch.ts` (`isSameWeighIn`, rule `'time_window' | 'same_day'`) and `weighIns.ts` imports them. A BLE save inside one transaction skips (reports `duplicate`) when **any** stored reading, of any source, matches. Health Connect import (`applyImport`) skips an imported weigh-in that matches a stored `source = 'ble'` reading. So whichever copy arrives second is the one dropped, and the BLE copy (with impedance) always wins. *Why:* the owner's rule that both never show. *Cost if wrong:* a rare duplicate if MovingLife timestamps drift beyond 2 minutes (accepted).
- **Ruling 11 — card placement and states (owner answer 2).** One card at the top of Today above the existing placeholder, built from the Body/Workouts card style (`Card`, `AppText`, `Button`). States: `off` (message plus the single button of Ruling 8), `searching`/`connecting` ("Looking for the scale", subtitle "Step on it to wake it up"), `waiting` ("Step on the scale"), `live` (weight in the owner's unit, tabular figures, the word "Settling…" or "Stable"), `saved` ("Saved", weight, and a link "See in Body"), `error` (message plus "Try again"). `idle` renders nothing. *Cost if wrong:* one component.
- **Ruling 12 — Body updates.** After a save the runner calls `sync.notifyDataChanged()` (new, bumps `dataVersion`), so Body and Export re-read without a sync.

## Review Focus

Most likely first; each is pinned by a test in its owning task.

1. **Replay saved as a new weigh-in.** A 0xFF result must never be saved, so connecting never duplicates the last weigh-in. → Task 45 (decode keeps `fresh: false`), Task 46 (no save effect).
2. **A 20 + 11 byte split 0x82, or stray and corrupt bytes, wedging the parser.** The next good frame must still come out. → Task 45.
3. **The same fresh result saved every 3 s, or twice across a BLE reconnect.** → Task 46 (suppression, re-arm on settling), Task 48 (DB window).
4. **BLE and Health Connect copies of one weigh-in both showing, or HC sync deleting the BLE row.** → Task 48.
5. **Dead ends and leaks:** Bluetooth off or permission refused with no way forward; scanning or a connection left open after the app is backgrounded; a zero impedance stored as a number. → Tasks 46, 47, 48, 49.

## Conventions

- **Unit test steps.** `npx jest <path>`; before implementing expect FAIL (module or export missing), after expect PASS. sql.js tests use the harness in `src/data/healthconnect/HealthConnectRepository.test.ts`.
- **Commit step.** Run the gate, `git add <the task's files>`, check `git diff --cached`, `git commit -m "<message>"`.
- **On-device checks** are the controller's alone (Task 50): `adb`, screenshots into the scratchpad `shots/`, `logcat -d -s ReactNativeJS:V` (which must show no frame bytes or values).
- **SDD ledger.** The controller records outcomes in `.superpowers/sdd/2026-11-13-plan-5-ble-scale/` (git-ignored). No per-task reviews; one whole-plan review at the end.

---

### Task 44: Library, native config and permissions

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.json`
- Test: `src/config/appConfig.test.ts`

**Interfaces:** Produces: the installed native module and a manifest with `BLUETOOTH_SCAN` (never for location) and `BLUETOOTH_CONNECT`. Nothing else imports it yet.

- [ ] **Step 1: Install.** `npm install --save-exact react-native-ble-manager@12.6.1`. `package.json` must show `"react-native-ble-manager": "12.6.1"` with no caret.
- [ ] **Step 2: Read the installed plugin.** Read `node_modules/react-native-ble-manager/app.plugin.js` and the files it requires, plus the library's typings, and write into the ledger: the plugin's option names (expected: whether it can set `neverForLocation`, `isBleRequired`, `companionDeviceEnabled`, iOS-only keys) and the exact exported names for `start`, `checkState`, `enableBluetooth`, `scan`/`stopScan`, `connect`, `retrieveServices`, `startNotification`, `writeWithoutResponse`, `disconnect` and the value-update and disconnect events (Task 47 uses them). **If the plugin cannot declare `neverForLocation`, stop and report BLOCKED** (Ruling 8).
- [ ] **Step 3: Write the failing test** `src/config/appConfig.test.ts` (reads `app.json` with `require`):
  - `test('registers the BLE plugin with neverForLocation')`: the `plugins` array has an entry `['react-native-ble-manager', options]` where `options` sets the library's never-for-location option to true and `isBleRequired` (or the plugin's equivalent) to false.
  - `test('requests no location permission')`: `expo.android.permissions` contains no `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` or `ACCESS_BACKGROUND_LOCATION`.
  - `test('keeps the Health Connect permissions')`: still contains `android.permission.health.READ_WEIGHT`.
- [ ] **Step 4: Run `npx jest src/config/appConfig.test.ts`** → FAIL (no plugin entry).
- [ ] **Step 5: Add the plugin entry to `app.json`** with the option names found in Step 2 (Android only; leave iOS keys out). Do not list `BLUETOOTH_*` in `android.permissions` if the plugin adds them; if it does not, add `android.permission.BLUETOOTH_SCAN` and `android.permission.BLUETOOTH_CONNECT`. Run the test → PASS.
- [ ] **Step 6: Gate and commit** `Add react-native-ble-manager and Bluetooth config`.
- [ ] **Step 7 (controller): native rebuild.** After the commit:
  ```bash
  export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH
  npx expo prebuild --platform android      # no --clean; restore tsconfig.json from git if it is rewritten
  (cd android && ./gradlew assembleDebug)
  adb -s 59180DLCQ00B36 install -r android/app/build/outputs/apk/debug/app-debug.apk
  ```
  Expected: install succeeds as an update, the app opens, Settings still says "Key saved". Confirm the merged manifest: `grep -E "BLUETOOTH|LOCATION" android/app/src/main/AndroidManifest.xml` shows `BLUETOOTH_SCAN` with `usesPermissionFlags="neverForLocation"` and `BLUETOOTH_CONNECT`, and no location permission. If prebuild did not apply the plugin, ask the owner before any clean prebuild.

---

### Task 45: Frame codec and profile encoder (pure)

**Files:**
- Create: `src/domain/scale/protocol.ts`, `src/domain/scale/frameCodec.ts`, `src/domain/scale/scaleProfile.ts`, `src/domain/scale/__fixtures__/frames.ts`
- Test: `src/domain/scale/frameCodec.test.ts`, `src/domain/scale/scaleProfile.test.ts`

**Interfaces (produces):**
```ts
// protocol.ts: constants only (values from the protocol note and Rulings 1, 2, 4, 5, 6, 7)
export const SERVICE_UUID: string;          // '0000fff0-0000-1000-8000-00805f9b34fb'
export const NOTIFY_CHARACTERISTIC: string; // FFF1
export const WRITE_CHARACTERISTIC: string;  // FFF2
export const SCALE_NAME = 'IF_B2A';
export const HEADER: readonly [0x10, 0x00, 0x00, 0xc5];
export const CMD = { LIVE: 0x80, PROFILE_ACK: 0x81, RESULT: 0x82, STATUS: 0x8d, HANDSHAKE: 0x0d, PROFILE: 0x01, REQUEST_RESULT: 0x02 } as const;
export const IMPEDANCE_OFFSET = 9;          // payload offset of the u16 BE impedance (Plan 4 Ruling 3)
export const KIND_FRESH = 0x00; export const KIND_REPLAY = 0xff;
export const FLAG_SETTLING = 0xa0; export const FLAG_STABLE = 0xaa;
export const MAX_FRAME_LEN = 40; export const STALE_PARTIAL_MS = 1_000;
export const HEALTH_HUB_USER_ID = 0x4801; export const FALLBACK_USER_ID = 0x0001;
export const WRITE_GAP_MS = 150; export const RESEND_PROFILE_AFTER_STABLE_MS: number | null; // null
export type HandshakeStep = 'handshake' | 'profile' | 'request_result';
export const HANDSHAKE_STEPS: readonly HandshakeStep[]; // ['handshake', 'profile']
export const SCAN_TIMEOUT_MS = 90_000; export const CONNECT_TIMEOUT_MS = 10_000;
export const MAX_AUTO_RECONNECTS = 2; export const RECONNECT_DELAY_MS = 1_000;
export const MIN_BLE_WEIGHT_KG = 20; export const MAX_BLE_WEIGHT_KG = 400;

// frameCodec.ts
export function checksum(frame: readonly number[]): number;        // sum of bytes from LEN to before CS, mod 256
export function encodeFrame(cmd: number, payload: readonly number[]): number[];
export function encodeHandshake(): number[];                         // CMD 0x0D, payload 02 00 00
export function encodeRequestResult(step: 1 | 2, userId: number): number[]; // CMD 0x02: 00 02 00 / uid_hi uid_lo 00
export type DecodedFrame =
  | { type: 'live'; weightKg: number; stable: boolean }
  | { type: 'result'; fresh: boolean; weightKg: number; impedanceOhm: number; hex: string }
  | { type: 'profile_ack' } | { type: 'status' } | { type: 'unknown' } | { type: 'malformed' };
export function decodeFrame(frame: readonly number[]): DecodedFrame;  // frame is a checksum-valid whole frame
export interface FrameAssembler { push(bytes: readonly number[], nowMs: number): number[][]; }
export function createFrameAssembler(): FrameAssembler;
export function toHex(bytes: readonly number[]): string;             // lowercase, no separators

// scaleProfile.ts
export interface ScaleProfileInput { sex: Sex | null; heightCm: number | null; birthDate: DateKey | null; lastWeightKg: number | null; today: DateKey }
export function encodeProfile(input: ScaleProfileInput, userId: number): number[]; // Ruling 3
```

**Test helper** `__fixtures__/frames.ts`: `buildFrame(cmd, payload)` (uses `encodeFrame`'s layout but is written independently: header, LEN, 0x03, cmd, payload, CS), `liveFrame(kg10, stable)`, `resultFrame({ kind, kg10, impedance, offset5?, offset7? })` (22-byte payload, zero padded, impedance at offset 9), and `split(frame, at)`. All numbers are synthetic (800 = 80.0 kg, 500 Ω).

- [ ] **Step 1: Write the failing tests** in `frameCodec.test.ts` (table-driven where it says so):
  - `test('encodeHandshake matches the documented bytes')`: `[0x10,0x00,0x00,0xc5,0x0b,0x03,0x0d,0x02,0x00,0x00,0x1d]`.
  - `test('encodeProfile for the documented synthetic example')` (in `scaleProfile.test.ts`): uid 0x4848, male, 175 cm, age 30, 80.0 kg → payload part `00 00 48 48 01 af 1e 00 00 03 20`, LEN 0x13, CS 0x98 (hand-checked: sum of LEN..payload = 0x198). Use `encodeFrame(CMD.PROFILE, [...])` to build it.
  - `test.each` over `(cmd, LEN)`: `decodeFrame` of `liveFrame` has LEN 0x0E, `resultFrame` LEN 0x1F, handshake LEN 0x0B, profile LEN 0x13, status 0x0F.
  - `test('decodes live weight and flag')`: 800/`0xAA` → `{ type: 'live', weightKg: 80, stable: true }`; `0xA0` → `stable: false`; any other flag → `stable: false`.
  - `test('decodes a fresh result with impedance at offset 9')`: kind 0x00, 805, impedance 500 → `{ type: 'result', fresh: true, weightKg: 80.5, impedanceOhm: 500 }` and `hex` equals `toHex(frame)`; `offset5` and `offset7` values different from 500 prove the right offset is read.
  - `test('a 0xFF result is a replay')`: `fresh: false`. `test('an unknown result kind is malformed')` (kind 0x07).
  - `test.each` malformed: a 0x80 and a 0x82 whose LEN is correct but payload is shorter than the layout (built with `buildFrame`) → `{ type: 'malformed' }`; cmd 0x99 → `{ type: 'unknown' }`; 0x81 → `profile_ack`; 0x8D → `status`.
  - Assembler, `test.each` of named cases, each pushing at `nowMs` values and asserting the emitted frames:
    1. `whole frame in one push`.
    2. `0x82 split 20 + 11` (second piece has no header) → nothing after the first push, the frame after the second.
    3. `two frames in one push`.
    4. `a frame split across three pushes`.
    5. `garbage before a header is dropped`.
    6. `bad checksum is dropped and the next good frame still comes out` (corrupt frame immediately followed by a good one in the same push).
    7. `header with LEN 4 or 200 is skipped and resyncs`.
    8. `stale partial (1.5 s old) is discarded: a new whole frame arrives intact`.
    9. `unknown cmd with valid checksum is emitted` (so the session can ignore it).
    10. `empty push returns []`.
    11. `a 0x82 piece that is only the 11-byte tail with no header ahead of it is dropped`.
- [ ] **Step 2: Run `npx jest src/domain/scale`** → FAIL (modules missing).
- [ ] **Step 3: Implement `protocol.ts`, `frameCodec.ts`, `scaleProfile.ts`** to the signatures above. `decodeFrame` reads u16 values big-endian; weights are `u16 / 10`. `encodeProfile` follows Ruling 3 (`ageOn` from `@/domain/time/localDate`, `PROFILE_LIMITS` from `@/domain/profile/profile`).
- [ ] **Step 4: Add `scaleProfile.test.ts` cases** (`test.each`): sex null → byte 0x01; female → 0x00; height null and 90 → 175; birthDate null and age 8 → 30; lastWeightKg null → `00 00`; 80.04 → 0x0320 (rounding of ×10); the userId is written big-endian (0x4801 → `48 01`).
- [ ] **Step 5: Run `npx jest src/domain/scale`** → PASS. **Gate and commit** `Add the scale frame codec and profile encoder`.

---

### Task 46: Session state machine (pure)

**Files:**
- Create: `src/domain/scale/scaleSession.ts`
- Test: `src/domain/scale/scaleSession.test.ts`

**Interfaces:** Consumes Task 45's `DecodedFrame`, `MAX_AUTO_RECONNECTS`, `MIN_BLE_WEIGHT_KG`, `MAX_BLE_WEIGHT_KG`. Produces:
```ts
export type OffReason = 'unsupported' | 'permission_needed' | 'permission_blocked' | 'bluetooth_off';
export type ScaleErrorKind = 'not_found' | 'connect_failed' | 'connection_lost' | 'save_failed';
export type ScaleState =
  | { kind: 'idle' } | { kind: 'off'; reason: OffReason } | { kind: 'searching' } | { kind: 'connecting' }
  | { kind: 'waiting' } | { kind: 'live'; weightKg: number; stable: boolean }
  | { kind: 'saved'; weightKg: number } | { kind: 'error'; error: ScaleErrorKind };
export interface ScaleSession { ui: ScaleState; foreground: boolean; reconnects: number; savedKey: string | null; remembered: boolean }
export interface ReadingToSave { weightKg: number; impedanceOhm: number | null; rawPayload: string; measuredAt: string }
export type ScaleEvent =
  | { type: 'foreground' } | { type: 'background' } | { type: 'retry' }
  | { type: 'preflight'; result: 'ok' | OffReason }
  | { type: 'found' } | { type: 'scanTimedOut' } | { type: 'connected' } | { type: 'connectFailed' } | { type: 'disconnected' }
  | { type: 'frame'; frame: DecodedFrame; at: string }
  | { type: 'saveDone'; outcome: 'saved' | 'duplicate' | 'failed'; weightKg: number };
export type ScaleEffect =
  | { type: 'preflight' } | { type: 'scan' } | { type: 'stopScan' } | { type: 'connect' } | { type: 'handshake' }
  | { type: 'disconnect' } | { type: 'save'; reading: ReadingToSave } | { type: 'rememberDevice' }
  | { type: 'reconnect' };                       // runner waits RECONNECT_DELAY_MS, then scans again
export const INITIAL_SESSION: ScaleSession;      // ui idle, foreground false, reconnects 0, savedKey null
export function reduceScaleSession(s: ScaleSession, e: ScaleEvent): { session: ScaleSession; effects: ScaleEffect[] };
```
Rules: `foreground` and `retry` (when foreground) → fresh session, `ui: searching`, effect `preflight`; `preflight ok` → effect `scan`; `preflight <reason>` → `off`. `found` → `connecting` + `connect`. `connected` → `waiting` + `handshake`. The first `frame` of any type after `connected` also emits `rememberDevice` once (the `remembered` flag). `frame live` → `live` (and, when `stable === false` and `savedKey !== null`, clears `savedKey`; a stable live frame while `saved` leaves the card on `saved`). `frame result` with `fresh: false` → **no effects, no state change**. `frame result` fresh with weight in range and `savedKey !== hex` → `save` effect with `impedanceOhm` mapped 0 → null, sets `savedKey`; same hex → nothing; weight out of range → nothing. `saveDone saved|duplicate` → `saved`; `failed` → `error save_failed`. `unknown`, `malformed`, `status`, `profile_ack` frames → no change. `disconnected` before a save (ui is `waiting` or `live`) → `reconnects < MAX_AUTO_RECONNECTS` ? `searching`, `reconnects + 1`, effect `reconnect` : `error connection_lost`; after `saved` or when `ui` is `idle` → no change. `scanTimedOut` → `error not_found`. `connectFailed` → `error connect_failed`. `background` → `idle`, `foreground: false`, effects `stopScan` and `disconnect`; events arriving while `foreground` is false (late frames, `saveDone` excepted) change nothing.

- [ ] **Step 1: Write the failing tests.** A small `run(events)` helper folds events from `INITIAL_SESSION` and returns the final session and the concatenated effects. Named tests:
  - `test('foreground starts a preflight and ok starts a scan')`; `test.each` for each `OffReason` → `ui: off`, no scan.
  - `test('retry from off or error starts over')` including `reconnects` reset to 0.
  - `test('found connects, connected sends the handshake')`.
  - `test('a replay result neither saves nor changes the card')`: events … `frame` fresh false → effects contain no `save`, `ui` still `waiting`. (Review Focus 1.)
  - `test('a fresh result saves once and the 3 s repeats are suppressed')`: the same fresh frame ×3 → exactly one `save` effect with `weightKg` 80.5, `impedanceOhm` 500, `rawPayload` equal to the frame hex, `measuredAt` equal to the event's `at`. (Focus 3.)
  - `test('a second, different fresh result in one connection is saved')`.
  - `test('a settling live frame re-arms saving of an identical result')`: save, `saveDone`, live settling, same fresh hex → two saves.
  - `test('impedance 0 is saved as null')`; `test('weight out of range (19.9 and 400.1 kg) is never saved')`.
  - `test('live frames drive the card: settling then stable')`; `test('a stable live frame after saved keeps the card on saved')`.
  - `test('saveDone duplicate shows saved'; 'saveDone failed shows error save_failed')`.
  - `test('a disconnect before a save retries twice then gives up')`: three `disconnected` events from `waiting` → `searching` + `reconnect` ×2 then `error connection_lost`.
  - `test('a disconnect after saved changes nothing')`.
  - `test('background stops the scan, disconnects and goes idle, and late frames are ignored')`. (Focus 5.)
  - `test('rememberDevice is emitted once, on the first frame')`.
  - `test('unknown, malformed, status and ack frames change nothing')`.
- [ ] **Step 2: Run `npx jest src/domain/scale/scaleSession.test.ts`** → FAIL.
- [ ] **Step 3: Implement `reduceScaleSession`** as a pure switch on `e.type` returning a new session each time (no mutation, no timers, no I/O).
- [ ] **Step 4: Run** → PASS. **Gate and commit** `Add the scale session state machine`.

---

### Task 47: ble-manager adapter and runner

**Files:**
- Create: `src/data/scale/ScaleTransport.ts`, `src/data/scale/discovery.ts`, `src/data/scale/scaleRunner.ts`, `src/data/scale/expoBleScaleTransport.ts`
- Modify: `src/data/settings/SettingsRepository.ts` (add `'ble.scaleDeviceId'` to `SettingKey`)
- Test: `src/data/scale/discovery.test.ts`, `src/data/scale/scaleRunner.test.ts`

**Interfaces:** Consumes Tasks 45–46. Produces:
```ts
// ScaleTransport.ts (no native imports)
export type PermissionResult = 'granted' | 'denied' | 'blocked';
export interface ScalePeripheral { id: string; name: string | null }
export interface ScaleTransport {
  /** 'unsupported' below Android 12; otherwise permission and Bluetooth state. */
  preflight(): Promise<'ok' | OffReason>;
  requestPermissions(): Promise<PermissionResult>;
  enableBluetooth(): Promise<boolean>;
  openSettings(): Promise<void>;
  /** Resolves with the first match (scan stopped) or null on timeout. Rejects never. */
  scan(match: (p: ScalePeripheral) => boolean, timeoutMs: number): Promise<ScalePeripheral | null>;
  stopScan(): Promise<void>;
  /** Connects, discovers services, enables notifications. Resolves false on failure or timeout. */
  connect(peripheralId: string, timeoutMs: number): Promise<boolean>;
  write(bytes: readonly number[]): Promise<void>;          // write-without-response to FFF2
  disconnect(): Promise<void>;
  onBytes(listener: (bytes: number[]) => void): () => void;
  onDisconnected(listener: () => void): () => void;
}
// discovery.ts
export function matchesScale(p: ScalePeripheral, rememberedId: string | null): boolean; // Ruling 5
// scaleRunner.ts
export interface ScaleRunnerDeps {
  transport: ScaleTransport;
  now: () => Date;                                           // for measuredAt
  nowMs: () => number;                                       // for the assembler
  loadProfile: () => Promise<ScaleProfileInput>;             // Ruling 3 inputs
  getRememberedId: () => Promise<string | null>;
  rememberId: (id: string) => Promise<void>;
  saveReading: (r: BleReadingInput) => Promise<'saved' | 'duplicate'>;   // Task 48
  onSaved: () => void;                                       // sync.notifyDataChanged
  delay: (ms: number) => Promise<void>;                      // injected so tests do not wait
}
export interface ScaleRunner {
  start(): void; stop(): void; retry(): void;
  /** The "Allow Bluetooth" / "Open settings" / "Turn on Bluetooth" buttons all call this. */
  fixAndRetry(reason: OffReason): Promise<void>;
  subscribe(l: () => void): () => void; getState(): ScaleState;
}
export function createScaleRunner(deps: ScaleRunnerDeps): ScaleRunner;
```
`BleReadingInput` is defined in Task 48 (`src/data/body/bleReadings.ts`); the runner imports the type only. The runner folds events through `reduceScaleSession`, runs each effect (`preflight` → `transport.preflight()` → `preflight` event; `scan` → `transport.scan(p => matchesScale(p, remembered), SCAN_TIMEOUT_MS)` → `found` or `scanTimedOut`; `connect` → `transport.connect` → `connected`/`connectFailed`; `handshake` → for each of `HANDSHAKE_STEPS` write the encoded frame with `delay(WRITE_GAP_MS)` between (profile from `loadProfile()` and `HEALTH_HUB_USER_ID`; `request_result` writes both 0x02 payloads), then, when `RESEND_PROFILE_AFTER_STABLE_MS` is not null, schedule one profile re-send after the first stable live frame; `save` → `saveReading` → `saveDone` then `onSaved()`; `rememberDevice` → `rememberId`; `reconnect` → `delay(RECONNECT_DELAY_MS)` then `scan`; `disconnect`/`stopScan` → transport). Bytes go through one `createFrameAssembler()` per connection; `onDisconnected` → `disconnected` event. A superseded run (stop then start) must ignore results of earlier async work: keep a run counter and drop events whose run id is stale. The runner never throws and logs nothing.

- [ ] **Step 1: Write failing tests.**
  - `discovery.test.ts` `test.each`: name `IF_B2A` with nothing remembered → true; another name → false; null name → false; remembered id equal → true even with a different name; remembered id different, name `IF_B2A` → false.
  - `scaleRunner.test.ts` with an in-memory fake transport (records writes, lets the test push bytes and fire disconnect) and fake deps:
    - `test('start runs preflight, scan, connect, handshake in order')`: writes are exactly `encodeHandshake()` then `encodeProfile(...)` (using the fake `loadProfile`).
    - `test('a weigh-in saves once and calls onSaved')`: push a live stable frame, then the fresh result split 20 + 11 three times → `saveReading` called once with the synthetic weight/impedance/hex, state `saved`.
    - `test('a replay after connect is never saved')`. (Focus 1.)
    - `test('stop disconnects, stops the scan and goes idle; a late scan result is ignored')`. (Focus 5.)
    - `test('start after stop begins a fresh run')`.
    - `test('scan timeout shows not_found and retry scans again')`.
    - `test('Bluetooth off then fixAndRetry calls enableBluetooth and restarts')`; `test.each` permission_needed → `requestPermissions`, permission_blocked → `openSettings`.
    - `test('the device id is remembered on the first frame')`.
    - `test('with RESEND_PROFILE_AFTER_STABLE_MS null no profile is re-sent')` (the default).
- [ ] **Step 2: Run `npx jest src/data/scale`** → FAIL.
- [ ] **Step 3: Implement `ScaleTransport.ts`, `discovery.ts`, `scaleRunner.ts`**, then run → PASS.
- [ ] **Step 4: Implement `expoBleScaleTransport.ts`** (`createExpoBleScaleTransport(): ScaleTransport`) with the function names recorded in Task 44 Step 2. Behaviour, not tested in Jest: call `BleManager.start({ showAlert: false })` once (memoised); `preflight` returns `unsupported` when `Platform.Version < 31`, `permission_needed` when `PermissionsAndroid.check` fails for `BLUETOOTH_SCAN` or `BLUETOOTH_CONNECT`, `bluetooth_off` when `checkState()` is not `on`; `requestPermissions` uses `PermissionsAndroid.requestMultiple` and maps `never_ask_again` to `blocked`; `openSettings` is `Linking.openSettings()`; `scan` filters by `SERVICE_UUID`, resolves on the first peripheral for which `match` is true, always stops the scan, and resolves null at the timeout; `connect` races `BleManager.connect` + `retrieveServices` + `startNotification(SERVICE_UUID, NOTIFY_CHARACTERISTIC)` against the timeout and disconnects on failure; `write` uses write-without-response on `WRITE_CHARACTERISTIC`; `onBytes` forwards the value-update event for `NOTIFY_CHARACTERISTIC` as `number[]`; `onDisconnected` forwards the disconnect event for the connected peripheral. No logging of bytes. Add the adapter to the lint/type gate only; no unit test.
- [ ] **Step 5: Gate and commit** `Add the scale runner and BLE adapter`.

---

### Task 48: Saving with dedupe, shared match module, wipe

**Files:**
- Create: `src/data/body/weighInMatch.ts`, `src/data/body/bleReadings.ts`
- Modify: `src/data/healthconnect/weighIns.ts`, `src/data/healthconnect/HealthConnectRepository.ts` (`applyImport`), `src/data/sync/syncCoordinator.ts` (`notifyDataChanged`), `src/bootstrap/container.ts`
- Test: `src/data/body/weighInMatch.test.ts`, `src/data/body/bleReadings.test.ts`, `src/data/healthconnect/HealthConnectRepository.test.ts` (extend), `src/data/maintenance/wipeSyncedData.test.ts` (extend), `src/data/sync/syncCoordinator.test.ts` (extend)

**Interfaces (produces):**
```ts
// weighInMatch.ts (lifted from weighIns.ts, behaviour unchanged)
export type MatchRule = 'time_window' | 'same_day';
export interface WeighInPoint { time: string; weightKg: number }       // ISO UTC
export function isSameWeighIn(a: WeighInPoint, b: WeighInPoint, rule?: MatchRule): boolean; // default WEIGH_IN_MATCH
export function isSameTime(aIso: string, bIso: string, rule: MatchRule): boolean;
// bleReadings.ts
export interface BleReadingInput { measuredAt: string; weightKg: number; impedanceOhm: number | null; rawPayload: string; deviceId: string }
export interface BleReadingRepository { saveReading(r: BleReadingInput): Promise<'saved' | 'duplicate'> }
export function createSqliteBleReadingRepository(db: SqlDatabase): BleReadingRepository;
// syncCoordinator
notifyDataChanged(): void;   // bumps dataVersion so Body and Export re-read
```
`createSqliteBleReadingRepository.saveReading` runs **one** `db.transaction` (transactions are not re-entrant: no other repository call inside): select candidate rows with `measured_at` within ±`WEIGH_IN_WINDOW_MS` of the new reading (any source), return `'duplicate'` when `isSameWeighIn` matches one, else insert with `source = 'ble'`, `source_record_id = <rawPayload>@<measuredAt>`, `raw_payload`, `device_id`, and return `'saved'`. `applyImport` loads the stored `source = 'ble'` readings inside its transaction and skips payload weigh-ins that match one (their `legacy_body_value` row is skipped with them). `weighIns.ts` imports `isSameWeighIn`/`isSameTime` and keeps its existing exports and behaviour (its tests must pass untouched). The container builds `createSqliteBleReadingRepository(db)`, exposes `bleReadings` and a `scale` runner built with `createExpoBleScaleTransport()`, `createScaleRunner` and the existing repositories (`loadProfile` from `profile.getCurrent()` and the last reading of `body.listReadings()`; remembered id from `settings`; `onSaved: () => sync.notifyDataChanged()`).

- [ ] **Step 1: Write failing tests.**
  - `weighInMatch.test.ts` `test.each`: 119 s and 0.1 kg apart → same; 121 s → different; 0.11 kg → different; `same_day` rule: 23:00 and 08:00 local the same day, same weight → same, across midnight → different.
  - `bleReadings.test.ts` (sql.js): `test('stores source ble with impedance and raw payload')` (reads the row back through `body.listReadings()` and asserts `source: 'ble'`, `impedanceOhm: 500`); `test('null impedance stays null')`; `test('the same weigh-in 3 s later is a duplicate and writes nothing')`; `test('a different weight within the window is saved')` (80.0 then 82.0 kg); `test('a health_connect reading of the same weigh-in makes the BLE save a duplicate')`; `test('a reading 3 minutes apart is saved')`; `test('save rolls back and rejects when the insert fails')` (a UNIQUE clash on `source_record_id` simulated by a pre-inserted row is **not** a duplicate: expect rejection, nothing half-written). (Focus 4.)
  - `HealthConnectRepository.test.ts`: `test('applyImport drops an imported weigh-in that matches a ble reading and its legacy body fat')`; `test('applyImport keeps a ble reading and an unmatched imported one')`. (Focus 4.)
  - `wipeSyncedData.test.ts`: `test('wipe keeps a ble reading')` (insert a `ble` row plus a `health_connect` row; after the wipe only the `ble` row remains). Existing behaviour; the test pins it.
  - `syncCoordinator.test.ts`: `test('notifyDataChanged bumps dataVersion and notifies subscribers once')`.
- [ ] **Step 2: Run the five files** → FAIL.
- [ ] **Step 3: Implement** the shared module (move the code, do not rewrite it), the repository, the `applyImport` filter, `notifyDataChanged`, and the container wiring. Run the files, then the whole `npm test` (the `weighIns.test.ts` suite must pass unchanged) → PASS.
- [ ] **Step 4: Gate and commit** `Save BLE weigh-ins with cross-source dedupe`.

---

### Task 49: Today weigh-in card and hook

**Files:**
- Create: `src/ui/screens/today/ScaleCard.tsx`, `src/ui/screens/today/scaleCardText.ts`, `src/ui/data/useScale.ts`
- Modify: `src/ui/screens/placeholders/TodayScreen.tsx` (render the card above the empty state; keep the header and settings button), `src/bootstrap/ContainerContext.tsx` only if the container type needs it
- Test: `src/ui/screens/today/scaleCardText.test.ts`, `src/ui/data/useScale.test.tsx`

**Interfaces:** Consumes `AppContainer.scale: ScaleRunner`. Produces:
```ts
// scaleCardText.ts (pure)
export interface ScaleCardModel {
  title: string; subtitle: string | null; weightText: string | null;   // weight in the owner's unit via formatWeight
  action: { label: string; kind: 'retry' | 'allow' | 'settings' | 'bluetooth' | 'body' } | null;
  secondary: { label: string; kind: 'retry' } | null;
}
export function buildScaleCardModel(state: ScaleState, unit: WeightUnit): ScaleCardModel | null; // null for idle
// useScale.ts
export function useScale(): { state: ScaleState; actions: { retry(): void; fix(reason: OffReason): void } };
```
The hook subscribes with `useSyncExternalStore`, calls `runner.start()` when `AppState.currentState === 'active'` and on every change to `active`, calls `runner.stop()` on any other state and on unmount. Copy (Ruling 11): searching/connecting → "Looking for the scale" / "Step on it to wake it up"; waiting → "Step on the scale"; live → the weight and "Settling…" or "Stable"; saved → "Saved" plus the weight and action "See in Body" (kind `body`) and secondary "Weigh again"; off/permission_needed → "Bluetooth permission needed" action "Allow Bluetooth"; off/permission_blocked → "Bluetooth permission is off" action "Open settings"; off/bluetooth_off → "Bluetooth is off" action "Turn on Bluetooth"; off/unsupported → "This phone can't connect to the scale" no action; error → not_found "Can't find the scale", connect_failed "Couldn't connect to the scale", connection_lost "Connection lost", save_failed "Couldn't save the weigh-in", each with action "Try again". No copy contains a weight in the error states.

- [ ] **Step 1: Write failing tests.** `scaleCardText.test.ts` `test.each` over every state (in kg and lb): `idle` → null; `live` stable 80.5 kg → weightText "80.5 kg" in kg and "177.5 lb" in lb with subtitle "Stable"; settling → "Settling…"; `saved` has the Body action and a "Weigh again" secondary; every `OffReason` and `ScaleErrorKind` has exactly one primary action of the right kind. `useScale.test.tsx` (React Native Testing Library, fake runner): `test('starts when the app is active and stops when it goes to the background')` (mock `AppState` change events), `test('stops on unmount')`, `test('retry and fix call the runner')`.
- [ ] **Step 2: Run both** → FAIL.
- [ ] **Step 3: Implement the text model, the hook and `ScaleCard`** (a `Card` with `AppText`, the weight in a large tabular figure, `Button` for the primary action, `PressableScale` link for the secondary; skeleton not needed; dark and light via `useTheme` tokens only; actions map: `retry` → `actions.retry`, `allow`/`settings`/`bluetooth` → `actions.fix(reason)`, `body` → `router.navigate('/body')`). Render it in `TodayScreen` above the existing empty state; the screen must not render the card's space when the model is null.
- [ ] **Step 4: Run the tests** → PASS; render `ScaleCard` for each state in dark and light in a test (`renders every state in both schemes without throwing`). **Gate and commit** `Add the Today weigh-in card`.

---

### Task 50: Device check and release build (controller, with the owner)

**Files:** none (the controller records results in the ledger; any fix goes back to a builder task, or is the one-constant change of Ruling 1).

- [ ] **Step 1: Install a debug build** (Task 44 Step 7 commands after every JS-native change; JS-only changes need only Metro with `adb reverse tcp:8081 tcp:8081`). Open the app on Today with Bluetooth on and the permission not yet granted: the card shows "Bluetooth permission needed". The owner taps "Allow Bluetooth" and accepts the system dialog (the controller never taps it). Confirm the card moves to "Looking for the scale".
- [ ] **Step 2: Real weigh-in.** The owner steps on the scale. Expected: "Step on the scale" → live weight updating, "Settling…" then "Stable" → "Saved" with the weight and "See in Body". Logcat (`adb logcat -d -s ReactNativeJS:V`) shows no frame bytes or values.
- [ ] **Step 3: Ladder (Ruling 1).** If "Saved" never arrives within 15 s of "Stable", apply rung (a), rebuild JS, retry; then (b); then (c). Record the rung that worked in the ledger and keep it (one constant, one commit `Tune the scale handshake`). If no rung works, stop and report with the card state and the sequence of frame types (never values).
- [ ] **Step 4: Body.** Open Body: the new reading is a **solid** point, the formula metrics (body fat, water, muscle and the rest, tiers shown) are present, and the weight matches what the scale displayed. Compare body fat and muscle with the MovingLife values for the same weigh-in against the §18 item 6 tolerance (±4 body fat, ±5 water and muscle), recording only differences, not values, in the ledger; outside tolerance goes to the owner (Plan 4 Ruling 2).
- [ ] **Step 5: No duplicates.** Background and reopen the app, then leave it connected through two more 3 s repeats: Body still shows one new reading, not two. Run a pull-to-refresh sync (Health Connect import): still one. Wipe synced data in Settings: the BLE reading is still there.
- [ ] **Step 6: Failure paths.** Turn Bluetooth off: "Bluetooth is off" with its button works. With the scale asleep, wait out the scan (or shorten `SCAN_TIMEOUT_MS` temporarily on the controller's machine only): "Can't find the scale" and "Try again" works. Send the app to the background, confirm via `adb shell dumpsys bluetooth_manager` that no scan is active and no GATT connection is held.
- [ ] **Step 7: Release build.** `cd android && ./gradlew assembleRelease` then `adb -s 59180DLCQ00B36 install -r android/app/build/outputs/apk/release/app-release.apk`. Never `expo run:android --variant release`. Expected: install as an update, the app opens without Metro, Today connects to the scale and a weigh-in saves. If zod throws under release Hermes, apply Plan 2's `z.config({ jitless: true })` fix.
- [ ] **Step 8: Close out.** Record the decisions in the ledger; the whole-plan review runs next.

---

## Self-review notes

- Spec §9: connected mode, only stable final readings saved (Task 46), live animates the UI (Task 49), parser tested against synthetic frames in the real layout (Task 45; real bytes stay private by the owner's rule), foreground-only scanning and `neverForLocation` (Task 44, Ruling 6). §11 Today live state: Task 49. §8: impedance feeds the existing engine unchanged (Ruling 7). §18 item 8 (HC timestamp drift): Ruling 10 and the accepted list.
- Types used across tasks: `DecodedFrame`, `ScaleState`, `OffReason`, `ScaleErrorKind`, `ReadingToSave`/`BleReadingInput`, `ScaleTransport`, `ScaleRunner` are each defined once above.
