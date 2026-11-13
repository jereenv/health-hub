# Health Hub — Design

- **Date:** 2026-11-12
- **Status:** Draft, awaiting owner approval
- **Owner:** Jereen (product decisions). Claude builds the entire app (owner handed over all technical decisions).
- **Working name:** Health Hub (rename freely)

---

## 1. Intent and why

The owner is a few months into a weight-loss journey: lifting, a calorie deficit, daily weigh-ins, and a Galaxy Watch 7. Their data is split across three apps:

| Source | What it holds | Problem today |
|---|---|---|
| **Lyfta** (workout logger) | Every workout, set, weight, reps, schedule | Detail never leaves Lyfta |
| **MovingLife** (smart-scale app) | Weight + body composition per weigh-in | Only weight and body fat reach Health Connect; history locked in the app |
| **Samsung Health** (watch) | Sleep, steps, heart rate, workouts, watch body-fat checks | Spread across its own screens |

They regularly discuss progress with ChatGPT (Android app on the same phone). Today that means screenshots from three apps.

**Health Hub is one Android app that:**
1. Collects all three sources into one local database, including full history.
2. Reads the smart scale **directly over Bluetooth** and computes body composition itself from weight + impedance.
3. Shows everything with modern, multi-page charts (Day / Week / Month), plus explanations and healthy ranges for each metric.
4. Exports an AI-ready summary (selectable scope) straight into the ChatGPT app via Android's share sheet.

Success: the owner opens one app every morning, weighs in, sees their trends, and can hand ChatGPT an accurate briefing in two taps.

## 2. Goals, non-goals, anti-goals

**Goals**
- Full history in one place: all past Lyfta workouts, all past weigh-ins, Samsung Health activity/sleep.
- Direct scale connection replacing MovingLife.
- Our own body-composition calculation, applied to new readings and (where impedance is recoverable) to old ones.
- Per-metric detail with trend charts, healthy range bar, explanation, and a short tip.
- Export presets for ChatGPT, from a single workout up to the whole journey.
- Modern, polished, aesthetically pleasing UI.

**Non-goals**
- Nutrition / calorie-intake logging (owner tracks this mentally).
- Logging workouts (Lyfta stays the logger; Health Hub only reads).
- iOS, Play Store publishing, multiple users, accounts.
- A cloud backend (possible phase 2; the data model must not block it).
- Writing data back to Lyfta, Samsung Health or Health Connect.

**Anti-goals** (failure even if it technically works)
- Presenting rough estimates (visceral fat, metabolic age) as precise facts.
- Fake trend jumps from mixing measurement methods (scale vs watch body fat) or formulas into one line.
- Health data leaving the phone except: reading from Lyfta's API, reading from Senssun's cloud, and exports the owner explicitly triggers.
- A wall of text. Explanations are available on demand, not forced on every screen.
- Secrets (Lyfta key, Senssun credentials) in source code, logs, or git.

## 3. Constraints and verified facts

Verified on the owner's phone via adb on 2026-11-12 unless noted.

**Device:** Pixel 10 Pro XL (`mustang`), Android 16. Galaxy Watch 7 paired via Samsung Wearable.

**Health Connect** is an on-device database shared by health apps. It has no cloud API; only an on-device app with granted permissions can read it. By default an app can read only the 30 days before permission was granted; older data needs the history-read permission (`READ_HEALTH_DATA_HISTORY`).

**MovingLife** (`com.moving.movinglife` 5.13.0, targetSdk 36):
- White-label app built on Senssun's (Camry Electronic) SDK: `com.senssun.device`, `com.ss.bluetooth`. Supports ~96 rebadged products.
- BLE: custom service `0xFFF0` with characteristics `0xFFF1` / `0xFFF2`. Code also contains a broadcast-data type (`SDeviceWeightBroadcastData`), so some models send readings in advertisement packets without connecting.
- The scale sends **weight + impedance**; body composition is computed on the phone by bundled Chipsea native libraries (`libchipsea_bias_v331.so`, `libBodyFatScaleAlg.so`).
- Metrics MovingLife shows for its scales: weight, BMI, body fat %, water %, muscle %, bone %, BMR, active metabolic rate, health score (plus visceral fat on the owner's screens per the owner).
- Writes to Health Connect only `WEIGHT` and `BODY_FAT`.
- Uploads readings, including impedance, to Senssun's cloud (`SWeightUploadUnClaimImpedanceDTO`).
- `allowBackup` is off and the app is not debuggable: its local database cannot be read without root. History must come from Health Connect or Senssun's cloud.
- Code is obfuscated (ProGuard-style names).

**Owner's scale:** 4-electrode, foot-to-foot (no handle). Exact model unknown until the owner reads the label (pending).

**Lyfta** (`com.lyfta` 1.612):
- Writes only `EXERCISE` and `TOTAL_CALORIES_BURNED` to Health Connect, so sets/weights do not reach it.
- Official REST API, base `https://my.lyfta.app/api/v1`, personal key sent as `Authorization: Bearer <key>`. Free. Creating a new key revokes the old one. Limits: 60 requests/minute, 5,000/day. OpenAPI spec: `https://my.lyfta.app/openapi.json`. Sandbox (no auth): `GET /api/sandbox/v1/workouts`.
- Relevant endpoints: `GET /workouts` (`limit`, `page`, `from`, `to` as `YYYY-MM-DD` UTC), `GET /workouts/summary`, `GET /exercises`, `GET /exercises/progress`, `GET /schedule` (`from`, `to`, `include_completed`), `GET /templates`, `GET /profile`.
- Workout shape (from sandbox): `id`, `title`, `body_weight`, `workout_perform_date` (zoneless local wall time, see §18 item 12), `total_volume`, `exercises[]` → `exercise_id`, `excercise_name` (sic), `exercise_type`, `exercise_rest_time`, `sets[]` → `weight` (string), `reps` (string), `rir`, `duration`, `distance`, `set_type_id`, `is_completed`, `record_*`. Strings must be parsed defensively.

**Samsung Health** (`com.sec.android.app.shealth` 7.1.3) has Health Connect write permission for: steps, heart rate, sleep, exercise, distance, speed, power, total calories, SpO2, blood pressure, blood glucose, weight, height, body fat, BMR, nutrition. It does **not** share stress, HRV, sleep score, energy score, resting heart rate.

**Existing owner stack to build on (Lumitrail, `~/personal/lumitrail`):** Expo SDK 57, React Native 0.86, TypeScript 6, `expo-sqlite`, `zustand`, `react-native-svg`, `expo-sharing`, `expo-file-system`, Jest + Testing Library, ESLint + Prettier, prebuilt `android/` (dev build).

## 4. Approaches

| | Approach | Trade-offs |
|---|---|---|
| **A (chosen)** | **Expo / React Native app** (same stack as Lumitrail) with native modules for Health Connect and BLE | Fast; the owner can read and follow the code; reuses known tooling. Needs a development build (not Expo Go). Depends on community native libraries. |
| B | Native Android (Kotlin + Jetpack Compose) | First-class Health Connect SDK and BLE, most reliable background work. New language and toolchain for the owner; slower. |
| C | Phone app + Go backend + Grafana dashboards | Great Go/Grafana practice. Still needs the phone app from A/B (Health Connect and BLE are phone-only) plus hosting and auth. Strictly more work for the same result. Kept as optional phase 2. |

Ruled out: Mac-side scripts (data and ChatGPT live on the phone); relying only on ChatGPT connectors (Lyfta's MCP connector exists but covers only Lyfta).

**Decision:** the owner gave Claude a free hand on the how; Claude chose **A**. Data model and sync design must allow adding C later without a rewrite.

## 5. Decisions made by the owner

- Single, personal Android app; Claude builds all of it.
- Sources: Lyfta (all workouts, sets, weights, schedule), the smart scale directly over BLE, Samsung Health via Health Connect ("whatever we can pull").
- Body composition is computed by our app from weight + impedance using the best published calculations.
- Old scale history: import from Health Connect, **and** use the owner's MovingLife login to pull history (including impedance) from Senssun's cloud. Approved explicitly.
- Multi-page, modern, polished design. Graphs and trends everywhere.
- Body page: opens on the most recent weigh-in; tapping a metric opens its full trend with **Day / Week / Month** tabs like MovingLife. Day = one point per day.
- Reliability badges on every metric (approved).
- Extras approved: weekly loss rate, fat vs lean mass trend, goal projection.
- Per-metric explanation, healthy range for the owner, current value, a low/normal/high range bar (like MovingLife), and a one-line tip without overwhelming the screen.
- Export to ChatGPT with multiple scopes (whole data, a time range, a week, a day, a specific workout). Format left to Claude.
- Watch body-fat readings: Claude's recommendation (scale primary, watch as a separate second-opinion line) was presented; owner did not object.

## 6. Architecture

```
┌──────────────── Health Hub (Expo app on the phone) ────────────────┐
│                                                                    │
│  Sources (adapters)            Core                 UI             │
│  ┌───────────────┐       ┌────────────────┐   ┌───────────────┐    │
│  │ ScaleBle      │──raw─▶│                │   │ Today         │    │
│  │ HealthConnect │──────▶│  SQLite store  │◀─▶│ Body + detail │    │
│  │ LyftaApi      │──────▶│  (raw-first)   │   │ Workouts      │    │
│  │ SenssunCloud  │──────▶│                │   │ Activity      │    │
│  └───────────────┘       └───────┬────────┘   │ Export        │    │
│                                  │            │ Settings      │    │
│                    ┌─────────────┴──────┐     └───────────────┘    │
│                    │ BodyComp engine    │                          │
│                    │ (pure, versioned)  │──▶ Export engine ──▶ Share│
│                    └────────────────────┘          sheet → ChatGPT  │
└────────────────────────────────────────────────────────────────────┘
```

**Principles**
- **Raw-first storage.** Store what each source actually gave us (weight, impedance, timestamp, source, profile snapshot) and compute derived metrics from it. Derived values are tagged with a formula version so a formula change can recompute history consistently.
- **Adapters per source** behind one interface (fetch since cursor → normalized records). Each owns its own sync cursor.
- **Body-composition engine is pure functions** (inputs → outputs, no I/O), fully unit tested.
- **Everything on-device.** No analytics, no crash-reporting SDKs that send data off the phone.

**Sync behavior (Claude's calls)**
- Sync all sources on app open and on pull-to-refresh. No always-on background service in v1.
- Lyfta: first run pulls full history page by page within the rate limit; afterwards incremental by date (re-fetch the last 7 days each sync so late edits in Lyfta are picked up).
- Health Connect: first run requests history permission and imports everything available; afterwards uses Health Connect's change tokens (incremental "what changed since last time").
- Scale: scans/connects only while the app is open on the Today or Body screen (same as MovingLife). A clear "Step on the scale" state is shown.

**Library choices (Claude's calls, builder may substitute equivalents with reason)**
- Navigation: `expo-router` (file-based pages, bottom tabs + stack).
- Health Connect: `react-native-health-connect` + its Expo config plugin.
- BLE: `react-native-ble-plx`.
- Storage: `expo-sqlite`; state: `zustand` (as in Lumitrail).
- Charts: a Skia-based chart library (e.g. Victory Native) for smooth, animated charts.
- Secrets: `expo-secure-store` (Android Keystore-backed).
- Sharing: `expo-sharing` + `expo-file-system`; clipboard via `expo-clipboard`.

## 7. Data model (logical)

| Entity | Key fields | Notes |
|---|---|---|
| `profile` | height_cm, birth_date, sex, goal_weight_kg, bmi_cutoff_set, units | Needed by formulas and ranges. Changes are versioned so old readings use the profile at that time. |
| `scale_reading` | id, measured_at, weight_kg, impedance_ohm (nullable), source (`ble` / `senssun_cloud` / `health_connect`), raw_payload, device_id | One row per weigh-in. Raw bytes kept for BLE readings. |
| `legacy_body_value` | reading_id, metric, value, origin (`movinglife`) | MovingLife-computed values when no impedance exists (HC body fat; cloud values if provided). |
| `body_metrics` | reading_id, formula_version, metric → value | Derived; recomputable. |
| `watch_body_fat` | measured_at, body_fat_pct, source | Galaxy Watch BIA checks from Health Connect; never merged into scale series. |
| `workout` | lyfta_id, performed_at, title, total_volume, body_weight, raw_json | |
| `workout_exercise` / `workout_set` | exercise name/type, set order, weight_kg, reps, rir, duration, distance, set_type, completed | Parsed from Lyfta strings. |
| `scheduled_workout` | date, title, plan/template ref, completed | From `/schedule`. |
| `activity_daily` | date, steps, distance, active/total calories | Aggregated from Health Connect records. |
| `sleep_session` | start, end, stages[] | |
| `heart_rate_daily` | date, min, avg, max, resting_estimate | Resting HR estimated from HR during sleep. |
| `sync_state` | source, cursor/token, last_success, last_error | |

**Deduplication.** The same weigh-in can arrive from Health Connect (MovingLife-written), Senssun's cloud, and BLE. Treat readings within ±2 minutes with weight within 0.1 kg as one weigh-in; prefer the source with impedance. Samsung Health may also write weight/body fat into Health Connect: only records whose data origin is MovingLife count as scale history; Samsung-origin body fat goes to `watch_body_fat`.

**Day point rule.** Each day can hold several weigh-ins; all are kept. Day-level charts use the **first reading of the day** (morning is the most consistent condition). Week/Month points are averages of day points.

## 8. Body composition

**Inputs:** weight, impedance (foot-to-foot, single frequency unless the capture shows otherwise), height, age at measurement, sex.

**Outputs and reliability tiers** (shown as a badge on every metric):

| Tier | Metrics |
|---|---|
| Measured | Weight |
| Exact | BMI |
| Estimated (published research formulas) | Body fat %, fat mass, fat-free/lean mass, body water %, muscle / skeletal-muscle mass, BMR |
| Rough (vendor-style approximations) | Bone mass, protein %, visceral fat rating, metabolic age, health score |

**Requirements on formulas** (exact equations left to the builder):
- Each estimated metric uses a published, peer-reviewed BIA or metabolic equation; the source is recorded in code and in the in-app explanation.
- BMR: show one standard (e.g. Katch–McArdle from lean mass, with Mifflin–St Jeor as fallback when impedance is missing).
- Rough metrics are clearly labelled and never shown with false precision (e.g. visceral fat as a whole-number rating, not decimals).
- Engine is versioned (`formula_version`); changing a formula recomputes all readings with impedance.
- Validation: once the BLE capture exists, compare our outputs against the values MovingLife displayed for the same weigh-in and document the differences. Differences are expected; the goal is plausible, consistent values, not cloning MovingLife.

**Healthy ranges** are personalised by sex and age where the research supports it (e.g. body fat ranges by age/sex; BMI per WHO). A setting lets the owner choose standard WHO BMI cut-offs or the lower cut-offs WHO suggests for Asian populations. Every range shows its source. Rough metrics use conventional vendor ranges and say so.

**Watch body fat:** read from Health Connect (Samsung Health origin) and shown as a separate dotted "watch check" line on the body fat chart. Never blended with the scale series.

## 9. Scale integration

- Target: the owner's Senssun-family 4-electrode scale (model from label, pending).
- **Protocol discovery** (before implementing):
  1. Owner reads the model label; match it to MovingLife's product list.
  2. Enable Android's Bluetooth HCI snoop log, weigh in once with MovingLife, pull the log via `adb bugreport`, and decode in Wireshark. Record the screen values MovingLife showed.
  3. Cross-check against the decompiled Senssun SDK parsing code and openScale's existing handlers for similar scales.
- Determine: broadcast vs connected (GATT) mode; frame layout for weight, impedance, stability flag, units; any command the app must send (e.g. user profile, time sync); checksum.
- Captured frames become **test fixtures**: the parser is tested against real bytes.
- Only stable (final) readings are saved; live readings animate the UI.

## 10. History import

| Data | Source | Plan |
|---|---|---|
| Workouts, sets, schedule | Lyfta API | Full history on first sync. |
| Weigh-ins: weight + body fat (MovingLife's numbers) | Health Connect, origin MovingLife (since ~Jan 2026) | Guaranteed baseline. Imported as `scale_reading` (no impedance) + `legacy_body_value`. |
| Weigh-ins incl. impedance | Senssun cloud via owner's MovingLife login (approved) | **Best effort.** Reverse-engineer the API from the decompiled app (endpoints, auth, request signing). If impedance is available, recompute all metrics with our formulas. If it fails or breaks later, the app keeps working on the Health Connect baseline. |
| Activity, sleep, heart rate, watch body fat | Health Connect (Samsung Health origin) | Full history via history permission. |

Charts show legacy (MovingLife-computed) values distinctly (e.g. hollow points + "MovingLife" label) wherever our formula could not be applied, so a method change never looks like a real change.

Senssun credentials: the owner enters them once in Settings; store only the session token in secure storage if the API allows, otherwise the encrypted credential. Never logged.

## 11. Screens

Bottom tabs: **Today · Body · Workouts · Activity · Export**. Settings via the Today header.

**Today**
- Latest weigh-in (weight, change this week, 7-day moving average sparkline), body fat and muscle.
- Live scale state when the app is open ("Step on the scale" → live weight → saved).
- This week's workouts (done vs scheduled), last night's sleep, today's steps, resting HR.
- Goal progress and projected date.

**Body**
- Opens on the most recent weigh-in: one card per metric with value, tier badge, and status colour (low/healthy/high).
- Weekly loss rate card (kg/week and % body weight/week, with a 0.5–1%/week healthy band).
- Fat vs lean mass trend card.
- Full weigh-in history list.

**Metric detail** (tap any metric). Progressive disclosure: the essentials first, depth on demand.
1. Current value, status chip, tier badge.
2. **Range bar** (segmented Low / Healthy / High, owner's marker, numeric boundaries), personalised to the owner.
3. **Trend chart** with Day / Week / Month tabs, swipe back through all history, 7-day average overlay where meaningful, watch-check overlay for body fat, legacy points marked.
4. Stats for the visible period: average, min, max, change.
5. **"What this means"** collapsible: 2–3 sentences (what it is, what moves it, how reliable it is on a foot scale), range source.
6. **One-line tip**, shown only when the value is outside the healthy range or trending the wrong way. Rule-based, never AI-generated. Hidden otherwise.

**Workouts**
- History list grouped by week with volume and duration; calendar heat strip.
- Workout detail: exercises, every set (weight × reps, RIR), PR markers.
- Exercise progress: best weight, estimated 1-rep max (state the formula, e.g. Epley), volume over time with Day/Week/Month.
- Upcoming schedule from Lyfta.

**Activity**
- Steps, distance, calories (daily bars, D/W/M).
- Sleep: duration and stages per night, consistency.
- Heart rate: daily range and resting estimate.

**Export:** see §12.

**Settings**
- Profile (height, birth date, sex, goal weight, units, BMI cut-off set).
- Connections: Lyfta key, Senssun login, Health Connect permissions, scale pairing.
- Data: last sync per source, re-sync, recompute body metrics, wipe local data.
- About: formula sources, "not medical advice" note.

## 12. Export

**Format:** a Markdown briefing (ChatGPT reads it reliably) with three parts:
1. **Context:** goal, profile (height, age, sex), date range, what each metric means and its reliability tier, measurement method notes (foot-to-foot scale; watch checks separate).
2. **Summary:** key changes versus the previous equivalent period (weight trend, fat vs lean, training volume, sleep), adherence (workouts done vs scheduled).
3. **Detail:** tables appropriate to the scope.

**Presets**

| Preset | Contents |
|---|---|
| Weekly check-in (default) | Last 7 days daily detail + comparison to the previous 7 days |
| Month review | Last 30 days; daily body detail, weekly training summary |
| Whole journey | Weekly aggregates for all history + daily detail for the last 14 days; optional raw CSV attachment for ChatGPT's data analysis |
| Single workout | Every set of the chosen workout, that day's weigh-in, previous night's sleep, comparison to the last time those exercises were done |
| Custom | Any date range; toggle sections (body, workouts, activity, sleep, heart rate) |

**Options:** optional starter prompt at the top (e.g. "Review my week and suggest adjustments"; editable presets plus free text).

**Delivery:** Android share sheet (targeting the ChatGPT app or anything else), or copy to clipboard. A preview is shown before sharing. Files are generated into the app's cache and cleaned up after sharing.

**Size discipline:** the whole-journey export uses weekly aggregates so the text stays well within what ChatGPT reads accurately; detail lives in the optional CSV.

## 13. Design language

- Modern, card-based, generous spacing, one strong accent colour plus semantic status colours (low / healthy / high).
- Follows system light/dark theme; dark mode is first-class.
- Smooth animated charts, haptic feedback on tab and range changes, skeleton loaders during sync.
- Large, legible numbers for the primary value on each screen; secondary text subdued.
- **Visual direction approved by the owner on 2026-11-12** from mockups of Today, Body, Metric detail, Workouts, Export and Today (light): https://claude.ai/artifact/8uDe8Ymp5q2ZHK6mpSKYVH. Tokens, type, shape and the owner's UI rules are in `docs/design/ui-guidelines.md`; every screen follows that file.

## 14. Security and privacy

- Lyfta key and Senssun credentials/token live only in `expo-secure-store`. Never in code, logs, exports, or git.
- No third-party analytics or crash-reporting SDKs.
- Repository: `.gitignore` built as an allowlist (ignore everything, explicitly include project files); `.env`, keystores, credentials, raw BLE captures containing personal data, and bug reports stay excluded. Sanitised BLE fixtures (weight/impedance only, no identifiers) may be committed.
- Exports contain health data; they are only created when the owner taps Export.
- "Not medical advice" note in About and in export context.

## 15. Testing

- **Unit:** body-composition engine (known input → expected output per formula source), range classification, BLE frame parser (fixtures from the real capture), Lyfta parsing (sandbox JSON + edge cases: empty strings, units), dedupe rules, Day/Week/Month aggregation, export builder (snapshot tests per preset).
- **Integration:** sync adapters against recorded responses; SQLite migrations.
- **On-device checks:** real weigh-in end to end; Health Connect permission and history import; export into ChatGPT.
- Lint, typecheck, and tests run before any commit.

## 16. Phasing (suggested order)

1. **Foundation:** project setup (Expo dev build, navigation, theme, SQLite schema + migrations, secure storage, Settings/profile).
2. **Lyfta:** full workout history, Workouts pages.
3. **Health Connect:** Samsung activity, sleep, heart rate, watch body fat; MovingLife weight/fat baseline history; Activity pages.
4. **Body-composition engine** + Body pages + metric detail (works on legacy data first).
5. **Scale BLE** (after the owner's capture): live weigh-ins.
6. **Export.**
7. **Senssun cloud history** (best effort) + recompute.
8. **Polish:** Today page, goal projection, animations, empty/error states.

Mockups (§13) come before phase 1 UI work.

## 17. Open items

| Item | Owner | Blocking |
|---|---|---|
| Scale model label | Owner, at home | Phase 5 |
| HCI snoop capture + MovingLife screen values for the same weigh-in | Owner + Claude, at home | Phase 5 |
| Lyfta personal API key | Owner | Phase 2 |
| Senssun API feasibility | Claude (spike alongside phase 1) | Phase 7 only |
| ~~Visual direction~~ | Done 2026-11-12: approved, see §13 | — |

## 18. Clarifications from design review

Answers to a builder's review of this document. Items marked *Claude's call* were not decided by the owner and can be overridden.

1. **Senssun cloud importance.** The owner asked for the *entire* scale history recalculated with our formulas, so this matters. *Claude's call:* run a time-boxed feasibility spike (endpoints, auth, request signing) in parallel with phase 1, so we know early. The schema supports both outcomes regardless (`legacy_body_value` stays).
2. **Delivery target.** Personal sideloaded app only: development build during development, signed release APK for daily use. No Play Store. *Claude's call:* Health Connect still requires a permissions-rationale / privacy screen even when sideloaded, so the app includes one. The history-read permission is verified on the device in phase 3.
3. **History start.** MovingLife was first installed on 2026-01-24 (verified via adb), which predates the weight-loss journey. *Claude's call:* assume Health Connect history from that date covers the journey; confirm the earliest MovingLife record on the device in phase 3.
4. **Scale BLE.** Phase 5 is deliberately planned only after the capture. *Claude's call:* foreground-only scanning; Android 12+ Bluetooth permissions with `neverForLocation` unless the capture shows the scale needs location-derived scanning.
5. **Charts.** *Claude's call:* adding `@shopify/react-native-skia` and Reanimated is acceptable. Verify compatibility with Expo SDK 57 / RN 0.86 in phase 1; fall back to a `react-native-svg`-based chart library if not.
6. **Formula acceptance.** *Claude's call:* prefer equations validated for leg-to-leg (foot-pad) BIA where they exist; otherwise use standard whole-body equations and say so in the explanation. Acceptance bar: published source, physiologically plausible, consistent over time. Sanity tolerance against MovingLife's displayed values for the same weigh-in: body fat within ±4 percentage points, water and muscle within ±5. Larger gaps are investigated as possible bugs and documented either way.
7. **Units and time.** *Claude's call:* read the weight unit from Lyfta's `/profile`; store kg internally; display in the owner's chosen unit. "Day" means a local day in the phone's time zone (America/New_York, verified), with DST handled by the time library. Query Lyfta `from`/`to` with ±1 day padding, then bucket locally.
8. **Health Connect timestamps.** *Claude's call:* verify on device whether MovingLife writes the measurement time or the sync time. If sync time, dedupe on same local day + weight within 0.1 kg instead of ±2 minutes.
9. **Lyfta body weight.** Owner decision 2026-11-12: Lyfta's workout `body_weight` is manually entered and is never used; body weight comes only from the scale (BLE) and MovingLife / Health Connect / Senssun history.
10. Lyfta `total_volume` is not used; volume is computed from completed sets as Σ(weight_kg × reps) (Ruling 14).
11. The Lyfta weight unit is read from `/exercises/progress` `weight_unit` (`/profile` has no unit field).
12. Lyfta `workout_perform_date` is zoneless local (America/New_York) wall time (owner ruling 2026-11-13).

## 19. Left to the builder

- Exact body-composition equations (within §8's requirements) and range tables (with sources).
- Exact library versions and any equivalent substitutions (with reason).
- Database schema details, indexes, migrations.
- Component structure, chart styling details, animation choices within §13.
- Error, empty, and offline states.
- Estimated 1-rep max formula (state it in-app).
