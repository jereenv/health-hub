# Plan 6 — Export to ChatGPT Implementation Plan (Tasks 37–43)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the stored data into an accurate Markdown briefing the owner can hand to the ChatGPT Android app in two taps. Five presets (Weekly check-in, Month review, Whole journey with an optional CSV, Single workout, Custom), an optional starter question, a preview, and delivery by the Android share sheet or the clipboard. **Export is the reason the app exists**, so correctness of every number and every provenance label outranks polish.

**Architecture:** Same layering as Plans 1–4. The briefing is built by pure TypeScript in `src/domain/export/` from rows the repositories already return; nothing new is stored and there is no migration. A small adapter (`src/data/export/expoExportDelivery.ts`) is the only code that touches the share sheet, the clipboard and the cache directory. The screen follows the Body and Activity screens' pattern (`src/ui/screens/export/*`, a pure form model plus presentational components). The briefing leaves the phone only when the owner taps Share or Copy.

**Tech Stack:** Plan 4's stack plus three Expo packages (`expo-sharing`, `expo-clipboard`, `expo-file-system`), added in Task 41 with **one** dev-client rebuild.

**Spec:** `docs/superpowers/specs/2026-11-12-health-hub-design.md`, §2, §5, §7, §8, §11 (Export), §12, §14, §18. UI follows `docs/design/ui-guidelines.md`. The owner approved the **Export** mockup (`Export.dc.html`; chrome in `Main.dc.html`); the screen must match it. The controller keeps a copy under the scratchpad `hh-mockups/project/` folder.

**Final repo path of this file:** `docs/superpowers/plans/2026-11-13-plan-6-export.md`.

## Starting point (controller verifies before Task 37)

- Branch `jereenv/export`, from `main` at `c309f2b` (Plans 1, 2a, 2b, 3 and 4 merged).
- `MIGRATIONS.length === 7`. Plan 6 adds **no** migration.
- `app/(tabs)/export.tsx` re-exports the placeholder `src/ui/screens/placeholders/ExportScreen.tsx`.
- `package.json` has none of `expo-sharing`, `expo-clipboard`, `expo-file-system` (the last exists only as a nested dependency of `expo`, so it cannot be imported yet).
- The phone holds: 31 Lyfta workouts, 63 schedule items, about 321 days of Samsung activity (distance on about half the days, no active calories), 326 sleep sessions, 309 heart-rate days, about 95 MovingLife weigh-ins since 2026-05-14 with **no impedance**, and 18 watch body-fat checks. The weekly check-in for the current week must read sensibly with this data (Task 43).

## Research (done while writing this plan)

| Question | Finding | Evidence |
|---|---|---|
| Share **text** to another app | React Native's built-in `Share.share({ message, title }, { dialogTitle })` sends an `ACTION_SEND` `text/plain` intent with the text in `EXTRA_TEXT`. No native module, no rebuild. It cannot send files. On Android the promise always resolves; there is no "dismissed" result. | https://reactnative.dev/docs/share |
| Share a **file** | `expo-sharing` `shareAsync(fileUri, { mimeType, dialogTitle })` builds an `ACTION_SEND` intent with **only** `EXTRA_STREAM` (a `content://` URI from its own `FileProvider`, whose paths include the app cache). It never sets `EXTRA_TEXT`, so text and a file cannot travel in one intent. It accepts only `file://` URIs the app may read. The promise resolves when the chooser closes, which is **when the target app is launched**, not when it has finished reading the file. | `expo-sharing@57.0.26` source: `android/src/main/java/expo/modules/sharing/SharingModule.kt`, `src/Sharing.ts` |
| Where to write the file | `expo-file-system@57.0.7` (the new `File` / `Directory` / `Paths` API): `Paths.cache` is the cache directory, `new File(dir, name)` with `create`, `write(text)`, `delete()`. | `expo-file-system@57.0.7` source: `src/Paths.ts`, `src/File.types.ts` |
| Clipboard | `expo-clipboard@57.0.2`: `setStringAsync(text)`. Text only is needed. | `expo-clipboard@57.0.2` source: `src/Clipboard.ts` |
| SDK 57 versions | `expo-sharing 57.0.26`, `expo-clipboard 57.0.2`, `expo-file-system 57.0.7`: the versions in `expo/bundledNativeModules.json` and the npm `sdk-57` line. No config plugin is needed (`expo-sharing`'s plugin only adds a *receiving* share extension, which we do not want). All three autolink; the `FileProvider` and the `queries` entry arrive through manifest merging, hence one native rebuild. | `node_modules/expo/bundledNativeModules.json`; `npm view <pkg>@~57 version` |
| Does ChatGPT's Android app accept shares? | **Not confirmed by any official source.** A user report says the app accepts images and files through `ACTION_SEND` and opens a generic new-chat composer; OpenAI's help lists CSV and TXT among supported uploads through the in-app attach menu. Nothing found states whether shared `text/plain` arrives as message text or as an attachment, or whether `text/csv` is accepted. A community thread reports `.txt` uploads failing in the web and desktop apps while `.csv` works. **Treat all of it as unknown until Task 43 tries it.** | https://community.openai.com/t/feature-request-publish-individual-chatgpt-conversations-as-android-direct-share-targets/1395542 ; https://www.androidauthority.com/chatgpt-custom-share-sheet-and-more-3654439/ ; https://community.openai.com/t/issue-unable-to-upload-txt-files-an-unknown-error-occurred-web-and-app/1280670 |

**Conclusion.** Text goes through RN's `Share` (no native code); the optional CSV goes through `expo-sharing`; the clipboard is the guaranteed fallback (paste into the ChatGPT composer). Because the ChatGPT behaviour is unknown, the Share action reads one constant (`SHARE_BRIEFING_AS`, Task 42) that can be flipped from "text" to "file" (the briefing sent as `health-hub-briefing.md` with `text/plain`) in one line if Task 43 shows ChatGPT drops shared text.

## Global Constraints

- Project root `/Users/jereenvalsson/personal/health-hub`. Expo SDK 57, React Native 0.86, React 19.2, TypeScript ~6.0.3, New Architecture.
- Files under `src/domain/` and `src/data/` must not import `react-native` or `expo-*`, except adapter files named `expo*.ts`. Tests run in plain Node (Jest 29, sql.js, `TZ=America/New_York`).
- Path alias `@/` → `src/`. Stored timestamps are ISO-8601 UTC strings; stored weights are kg; a `DateKey` is a `'YYYY-MM-DD'` day in the phone's zone. Weeks start Monday. Never pass non-ISO strings to `new Date`.
- **Private data.** The owner's weights, impedance, MovingLife values, birth date and workouts never appear in the plan, code, test fixtures, golden files, commit messages or committed screenshots. Committed tests use the **synthetic fixtures** in Task 37 only (a synthetic man; the dates are real calendar dates, the numbers are invented). **Never log briefing content** (no `console.*` of the text, the CSV, or any value inside them, and no error message that embeds them).
- **Export correctness rules (binding, from Plans 1–4 and the owner):**
  1. **A day with no data is NULL, never 0.** Averages, totals and extremes skip NULL days and say how many were skipped. A section with no data says so in one line. Never compute from the zero-filled chart buckets of the Activity charts (`buildBucketedSeries`, `fillEmptyBuckets` and `buildActivitySeries.points` are not used by the export). A zero is allowed only for a genuine count of logged events (workouts logged).
  2. **Body trends use averages** (the mean of the daily points in the period), never a single day's point. A day's point is the **first reading of that local day that has the metric** (Plan 4 Ruling 12). The "latest" value is the latest single reading and is labelled so. The briefing states which is which.
  3. **Strength.** Volume = Σ weight × reps over every logged set (`isScoredSet`), ignoring Lyfta's tick (spec §18 item 13). Estimated 1-rep max is Epley from sets of 1–12 reps only (`estimateOneRepMaxKg`). Exercises whose best logged weight is 0 (bodyweight) get **no** e1RM line and **no** PR line. Weights are shown in the owner's unit.
  4. **Heart rate** is the daily minimum, average and maximum only. There is no resting or asleep-average figure (owner decision); the briefing says so.
  5. **Units.** `lb` → pounds, miles; `kg` → kilograms, kilometres (`kgToUnit`, `formatDistance`'s rule). The CSV follows the same unit and names it in the header.
  6. **Sleep.** A session belongs to the day it ends on and naps are included (Plan 3 Ruling 6): use `buildSleepNights`.
  7. **Provenance.** Every body metric line carries its tier (`TIER_LABEL`) and origin. MovingLife's own body fat and everything derived from it are labelled as such. Watch body-fat checks are listed separately and never blended into scale numbers. Impedance-only metrics are absent for legacy readings (and the briefing says they are unavailable, once). The briefing names `FORMULA_VERSION`.
  8. **Adherence** ("workouts done vs scheduled") uses the stored Lyfta schedule (`scheduled_workout`). Weigh-in dedupe is `time_window`; nothing here handles `same_day`.
  9. **Today is partial.** Today's steps, distance, calories and heart rate are left out of every average, total and extreme and are marked in the daily table. Today's sleep (the night that just ended) is complete and counts.
- Design rules are Plan 2's: colours only from `src/ui/theme/tokens.ts`, Geist fonts (Geist Mono for the preview), tabular figures, 44×44 touch targets, bottom sheets instead of `Modal`/`Alert`, skeletons instead of `ActivityIndicator`, no shadows, cards radius 20–24 with a 1px `line` border. A status colour never appears without its text.
- Before every commit, run `npm run typecheck && npm run lint && npm run format:check && npm test` and check `git diff --cached` for secrets and personal data. Commit messages are imperative, under 72 characters, no AI attribution, no Co-Authored-By. Commits are SSH-signed via 1Password; if signing fails, stop and report. Never bypass signing.
- Never stage `android/`, `.expo/`, `.superpowers/` or `node_modules/`. New root files need a `.gitignore` allowlist entry; prefer `src/`.
- Routes live in `app/` and only re-export a screen from `src/ui/screens/`. Never create `src/app/`.
- **Builders never run adb, never uninstall the app (SecureStore holds a key), never run `expo prebuild --clean`, never read the macOS Keychain.** Only the controller drives the phone (adb serial `59180DLCQ00B36`, app id `com.jereenv.healthhub`).
- Android build env: `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, `PATH` gains `$JAVA_HOME/bin:$ANDROID_HOME/platform-tools`.
- Scope: the owner says this app is "just an exporter" for them, so do not over-engineer. Plan only what makes the briefing correct and the approved Export page work. **Not in Plan 6:** BLE (Plan 5), Senssun cloud (Plan 7), Today page and goal projection (Plan 8), saved/scheduled exports, export history, any format other than Markdown and the one CSV.

## Rulings (made while planning)

Each is "ruling — why — cost if wrong".

- **Ruling 1 — Markdown, three parts, one file of text.** `# title`, then the starter question as a `>` quote, then `## Context`, `## Summary`, `## Detail`. *Why:* spec §12 and the approved preview (title line, quote line, `## Summary`, `## Daily detail`). *Cost if wrong:* template strings in one module per section; goldens show the change.
- **Ruling 2 — windows.** Weekly check-in = the 7 days ending **today** (today included), compared with the 7 days before. Month review = 30 days ending today, compared with the 30 days before. Custom = the chosen inclusive range, compared with the same number of days immediately before. Whole journey = the first day any included source has data through today, with **no** previous period; its comparison is "journey start" (first 7 days) against "now" (last 7 days). Single workout has no period. *Why:* matches the mockup's "6–12 Nov" on Thursday 12 Nov and spec §12. *Cost:* constants in `period.ts`.
- **Ruling 3 — one detail rule.** `detailLevel(preset, days)`: `full` for week and for custom ≤ 14 days; `medium` for month and custom 15–62 days; `long` for journey and custom > 62 days. `full`: daily body table, every set of every workout, one daily table for activity/sleep/heart rate. `medium`: daily body table, a weekly training table plus one line per workout (no sets), weekly table for activity/sleep/heart rate. `long`: one weekly-aggregates table for everything, then daily rows for the **last 14 days only** (body, and activity/sleep/heart rate). *Why:* spec §12 size discipline; the whole-journey text must stay far below anything ChatGPT reads unreliably (about 120 characters per week keeps even five years under 40,000 characters). *Cost:* thresholds in `period.ts`.
- **Ruling 4 — method mixing in the briefing.** For each body metric the period mean uses the day points of the **same method as the latest day point in the period** (solid = `scale`/`formula`, hollow = `movinglife`/`movinglife_derived`; Plan 4 Ruling 7). Days of the other method are counted in a note ("2 earlier days of another method not averaged"). The comparison with the previous period is printed only when the previous period's points are of the same method; otherwise the line says "previous period used a different method; not compared". *Why:* spec anti-goal "fake trend jumps". *Cost:* one transition week reads with a note.
- **Ruling 5 — what the numbers mean, said in the briefing.** Context states: each day's value is that day's first weigh-in; averages are means of those daily values; "latest" is the latest single reading; a single reading can swing by several points on a foot-to-foot scale, so averages beat single readings. *Why:* the owner's rule. *Cost:* none.
- **Ruling 6 — adherence.** A scheduled item dated before today is **done** when Lyfta marks it `completed` **or** a workout was logged on the same local day (the owner logs without ticking; spec §18 item 13). An item dated today that is not done is reported as "scheduled today, not yet done", never as missed. An item dated before today and not done is **missed**. Items are counted from the stored schedule only; if there are none in the period the line says so. The rule is stated in Context. *Why:* the owner's schedule ticks are unreliable and today's session may still happen. *Cost:* `adherence()` in one file.
- **Ruling 7 — personal records and strength lines.** PR lines come from `computePersonalRecords` for workouts inside the period. Top-lift lines: for each exercise performed in the period, the best Epley e1RM in the period against the best of **all earlier** workouts, printed as `first time logged`, `new best +x`, `no change` or `below earlier best y`. An exercise is **bodyweight** when its best logged weight over all history is 0 (or it has no scored set); it gets neither line. *Why:* correctness rule 3. *Cost:* none.
- **Ruling 8 — body-fat provenance wording.** Origin text in a metric line: `scale` → "scale"; `formula` → "Health Hub formula v{FORMULA_VERSION}"; `movinglife` → "MovingLife's own figure"; `movinglife_derived` → "derived from MovingLife body fat". Tier text is `TIER_LABEL`. Example: `Body fat (Estimated, MovingLife's own figure)`. Once, if any legacy reading is in the period, one line lists the unavailable metrics (body water, muscle, bone mass, protein, visceral fat, metabolic age, health score) and why (they need scale impedance). *Why:* correctness rule 7. *Cost:* none.
- **Ruling 9 — the weekly loss rate and fat-vs-lean lines are reused, not recomputed.** `weeklyLossRate(weightDayPoints, windowEnd)` (28-day least squares, Plan 4 Ruling 15) and `fatVsLean` are called with the period's end as "today". They print only when they return a value; otherwise nothing is printed (no "n/a" noise). *Why:* one definition of each number across app and export. *Cost:* none.
- **Ruling 10 — delivery.** Text: RN `Share.share` (no native module). File (CSV, and the optional briefing-as-file fallback): `expo-sharing`. Copy: `expo-clipboard`. The Share action calls `SHARE_BRIEFING_AS` (`'text'` by default). *Why:* see Research. *Cost if wrong:* flip the constant after Task 43.
- **Ruling 11 — cache files are swept, not deleted on return.** `shareAsync` resolves when the chooser closes, i.e. when ChatGPT is *launched*, so deleting the file at that moment can race with ChatGPT reading it. Instead: files live in `Paths.cache/health-hub-export/`, and **every file in that folder is deleted** (a) when the Export screen mounts, (b) before each new file is written, and (c) when the screen unmounts only if no share is pending. Stale files are therefore gone by the next visit, and the OS may also clear the cache. *Why:* spec §12 "cleaned up after sharing" without breaking the share. *Cost:* a file can live until the owner next opens the Export tab. Task 43 checks the folder.
- **Ruling 12 — Whole journey + CSV needs two shares.** One `ACTION_SEND` carries either text or a file (Research). So the Share button sends the briefing text, and when the CSV chip is on, a plain "Share CSV" button appears inside the Preview card footer and sends the CSV through `expo-sharing`. The CSV is one row per day (from the first day with data to today), unit in the header names, **empty cells for missing values**, today's partial figures left empty. *Why:* the only way with these APIs; the extra control appears only for that preset. *Cost if wrong:* if the owner prefers one step, the fallback is sharing the CSV alone (owner question 1).
- **Ruling 13 — chips per preset.** The mockup's five chips (Body, Workouts, Activity, Sleep, Heart rate) toggle sections for Weekly, Month, Journey and Custom. Whole journey adds a sixth chip, "CSV" (default on). Single workout shows only **Body** (that day's weigh-in) and **Sleep** (the night before); the workout itself is always included. Turning every chip off disables Share and Copy and the preview says "Choose at least one section." *Why:* spec §12 content per preset. *Cost:* none.
- **Ruling 14 — starter question.** The input is pre-filled with the preset's default question (Weekly: "Review my week and suggest changes"; Month: "Review my month and suggest changes"; Journey: "Look at my whole journey and tell me what is working"; Workout: "Review this workout and tell me what to adjust"; Custom: "Review this period and suggest changes"). It is editable free text; switching preset replaces it **only if the owner has not edited it**; clearing it removes the quote line. These are the "editable presets plus free text" of spec §12. It is never stored. *Cost:* none.
- **Ruling 15 — custom range input.** A bottom sheet with a **From** and a **To** row; each row shows the date and has `−7`, `−1`, `+1`, `+7` day buttons (44×44, 8px apart). Bounds: `To` ≤ today, `From` ≤ `To`, `From` ≥ the first day any source has data. No native date picker (it would be another native module). *Why:* avoids a library for a rare action. *Cost:* many taps for a far-back date (owner question 2).
- **Ruling 16 — preview.** The Preview card shows the first 12 lines of the real briefing (headings in `accentInk`, table lines in `muted`, rest `ink`, Geist Mono), "… N more lines", and the size ("About 1,900 characters", rounded to the nearest 100; `+ CSV` for the journey). Tapping the card opens a bottom sheet with the whole text (scrollable, selectable). *Why:* "a preview is shown before sharing" must mean the real thing. *Cost:* none.
- **Ruling 17 — no size cap, no truncation.** Weekly aggregation bounds the long levels; the Android intent limit (about 1 MB through Binder) is two orders of magnitude away. *Cost if wrong:* none expected.
- **Ruling 18 — refresh.** The Export screen re-reads all data when `dataVersion` changes **and** whenever the tab regains focus (profile edits in Settings must show), like Body (Plan 4 Ruling 14). The briefing is rebuilt with `useMemo` on (data, form, unit, today).
- **Ruling 19 — routes.** `app/(tabs)/export.tsx` stays a single route and re-exports `src/ui/screens/export/ExportScreen.tsx`; the placeholder is deleted.

## Review Focus

1. **NULL never 0.** Every average, total and extreme; every table cell for a missing value. → Tasks 37–40.
2. **Averages, not single points.** Body lines use period means; the latest reading is labelled. → Task 37.
3. **Provenance.** Tier and origin on every body line; watch checks separate; legacy-unavailable line; formula version. → Task 37.
4. **Strength rules.** Bodyweight exclusion, Epley 1–12, volume ignoring the tick, unit conversion. → Task 38.
5. **Sleep and today.** Wake-day assignment, naps, partial today excluded. → Task 39.
6. **Method mixing and units.** Ruling 4 and the lb goldens. → Tasks 37, 40.
7. **No leakage.** No briefing text in logs, fixtures synthetic, cache folder swept, clipboard and share only on tap. → Tasks 41, 42.
8. **Size.** Journey stays small; CSV has one row per day. → Task 40.

## Conventions

- **Unit test steps.** Run `npx jest <path>`. Before implementing, expect FAIL (module or export missing); after, PASS.
- **Golden tests.** `src/test-support/golden.ts` (Task 37) exports `expectGolden(name: string, actual: string)`. It compares with `src/domain/export/__golden__/<name>.md` (or `.csv`), normalising nothing. A missing or different file **fails**; running with `UPDATE_GOLDEN=1` rewrites it. The builder generates a golden once with `UPDATE_GOLDEN=1`, then **reads it line by line against the hand-computed assertions in the task** (each task lists them with `toContain`), and only then commits. The `toContain` assertions are the independent check; the golden pins the full layout. Goldens contain synthetic values only.
- **Commit step.** Run the pre-commit gate, `git add <the task's files>`, check `git diff --cached`, then `git commit -m "<message>"`.
- **sql.js tests.** Use the harness in `src/data/healthconnect/HealthConnectRepository.test.ts`.
- **Number formats** reuse existing helpers: `formatMetricValue`, `formatMetricChange`, `formatWeightNumber`, `formatVolume`, `formatDistance`, `formatDuration`, `formatInteger`, `formatSignedDelta`, `formatDayMonth`, `formatClock`. The true minus `−` is used everywhere (never a hyphen) so goldens are stable. A "mean of N days" line always names N.
- **On-device JS check** (controller only): as in Plan 4's Conventions (`adb reverse`, Metro on 8081, `am start`, screenshots into the scratchpad `shots/`, `logcat -d -s ReactNativeJS:V`).
- **SDD ledger.** The controller records outcomes in `.superpowers/sdd/2026-11-13-plan-6-export/` (git-ignored). **No per-task reviews:** each task's tests carry its verification; one whole-plan review runs at the end.

### The synthetic fixture (used by every export test)

`src/domain/export/__fixtures__/synthetic.ts` exports `syntheticWeek()` and `syntheticJourney()`. Today is `2026-11-12` (a Thursday, week starts Monday 2026-11-09); the test sets nothing global, the builders receive `today` as an argument.

- **Profile (one version, effective 2026-01-01):** male, 175 cm, born 1995-06-15 (31 on 2026-11-12), goal weight 75 kg, `who`.
- **Weigh-ins (all MovingLife-style: no impedance, body fat given; times are 07:00 local unless noted).** Day (weight kg / body fat %): Oct 16 87.0/27.0, Oct 20 86.4/26.4, Oct 25 85.8/25.8; **previous period** Oct 30 85.0/25.0, Nov 1 84.8/24.8, Nov 3 84.6/24.6, Nov 4 84.4/24.4; **period** Nov 6 84.0/24.0, Nov 8 83.8/23.8 (a second reading at 21:00 of 84.6/24.6 that must be ignored), Nov 9 83.6/23.6, Nov 10 83.4/23.4, Nov 12 83.2/23.2. No reading on Nov 7 or Nov 11.
- **Watch body-fat checks:** Nov 8 26.1 % and 26.5 % (one day, two checks), Nov 11 26.0 %.
- **Workouts** (`Workout` objects through `workoutBuilders.ts`; times 18:00 local): Oct 19 "Upper Strength": Bench Press (id 1) 85×5, 85×5. Nov 2 "Upper Strength": Bench 80×5, 80×5, 85×3. **Period:** Nov 7 (Sat) "Upper Strength", 58 min: Bench 80×5, 85×5, 90×3 and Pull-up (id 2) 0×8, 0×8; Nov 9 (Mon) "Lower Strength": Squat (id 3) 100×5, 100×5, 105×3; Nov 11 (Wed) "Pull": Barbell Row (id 4) 70×8, 70×8, 70×7. Sets are logged with `completed: false` (the owner does not tick).
- **Schedule:** previous period Nov 2 "Upper Strength", Nov 4 "Lower Strength" (neither ticked). Period: Nov 7 "Upper Strength", Nov 9 "Lower Strength", Nov 10 "Cardio", Nov 11 "Pull", Nov 12 "Upper Strength" (none ticked).
- **Activity (steps / distance m):** period Nov 6 8000/6000, Nov 7 6000/–, Nov 8 no row, Nov 9 10000/8000, Nov 10 7000/–, Nov 11 9000/7000, Nov 12 (today) 2500/–. Previous period Oct 30 5000/–, Oct 31 6000/5000, Nov 1 no row, Nov 2 7000/–, Nov 3 8000/–, Nov 4 9000/6000, Nov 5 6000/–. No active calories anywhere; total calories absent.
- **Sleep sessions (wake date / asleep):** period Nov 7 6h 30m, Nov 8 7h, Nov 10 7h 30m **plus** a 30 min nap that ends the same day, Nov 11 6h, Nov 12 7h 15m; none for Nov 6 and Nov 9. Previous period: Nov 1, Nov 3, Nov 4, each 7h.
- **Heart rate (min / avg / max):** Nov 6 52/68/140, Nov 8 50/66/120, Nov 10 54/70/150, Nov 11 51/67/130, Nov 12 (today) 55/72/160. Previous period: Oct 31 53/69/135, Nov 3 52/68/138.
- **`syntheticJourney()`:** 120 consecutive days ending 2026-11-12 generated from a fixed formula (weight 90.0 falling 0.05 kg/day with every 5th day missing, body fat 28.0 falling 0.02 points/day, steps `5000 + (day % 7) * 700` with every 9th day null, a workout every second day with one bench exercise, sleep every day except every 11th, heart rate every day except every 13th), enough to exercise weekly aggregation and the CSV.

---

### Task 37: Export foundations and the Body section

**Files:**
- Create: `src/domain/export/types.ts`, `period.ts`, `markdown.ts`, `prepare.ts`, `bodySection.ts`, `__fixtures__/synthetic.ts`, `src/test-support/golden.ts`
- Test: `src/domain/export/period.test.ts`, `markdown.test.ts`, `bodySection.test.ts`

**Interfaces (produces):**
```ts
// types.ts
export type PresetId = 'week' | 'month' | 'journey' | 'workout' | 'custom';
export type SectionId = 'body' | 'workouts' | 'activity' | 'sleep' | 'heartRate';
export const SECTION_IDS: readonly SectionId[];                       // in this order
export const SECTION_LABEL: Readonly<Record<SectionId, string>>;      // Body, Workouts, Activity, Sleep, Heart rate
export interface DateWindow { from: DateKey; to: DateKey }           // inclusive
export interface ExportData {
  workouts: Workout[]; schedule: ScheduledWorkout[]; readings: BodyReading[]; versions: Profile[];
  watch: WatchBodyFat[]; activity: ActivityDay[]; sleep: SleepSessionRow[]; heartRate: HeartRateDay[];
}
export interface ExportRequest {
  preset: PresetId; sections: Readonly<Record<SectionId, boolean>>; starter: string;
  workoutId: number | null; custom: DateWindow | null; includeCsv: boolean;
}
export type DetailLevel = 'full' | 'medium' | 'long';
export interface PeriodView {
  window: DateWindow; previous: DateWindow | null; days: number; level: DetailLevel; today: DateKey;
  unit: WeightUnit; preset: PresetId; includesToday: boolean;
  /** Journey only: the first 7 days stand in for "previous". */
  comparisonLabel: 'previous period' | 'journey start';
}
export interface SectionText { context: string[]; summary: string[]; detail: string[] }   // Markdown lines, no trailing newline
// period.ts
export function detailLevel(preset: PresetId, days: number): DetailLevel;          // Ruling 3
export function resolvePeriod(i: { request: ExportRequest; today: DateKey; unit: WeightUnit; firstDataDate: DateKey | null }): PeriodView | null;   // null for 'workout'
export function periodTitle(preset: PresetId, window: DateWindow): string;         // '# Weekly check-in · 6–12 Nov 2026'
export function earliestDataDate(data: ExportData): DateKey | null;
// markdown.ts
export function mdTable(headers: readonly string[], rows: readonly (readonly string[])[]): string[];   // header, '|---|…', rows
export const MISSING = '–';                                                         // en dash: "no data"
export function dayLabel(date: DateKey, today: DateKey): string;                    // 'Fri 6 Nov', 'Thu 12 Nov*' for today
export function mean(values: readonly number[]): number | null;                    // null for empty (never 0)
// prepare.ts — computed once per export
export interface Prepared { readings: ReadingMetrics[]; versions: Profile[]; profile: Profile | null; data: ExportData }
export function prepareExportData(data: ExportData): Prepared;                      // computeReadings once; profile = latest version
// bodySection.ts
export function buildBodySection(prep: Prepared, view: PeriodView): SectionText;
export function bodyWeeklyColumns(prep: Prepared, view: PeriodView): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> };   // for Task 40's weekly table: Weigh-in days, Weight, Body fat
// golden.ts
export function expectGolden(name: string, actual: string): void;
```

**Behaviour.**
- `resolvePeriod`: week → `from = today − 6`; month → `today − 29`; custom → the request's window, clamped to `to ≤ today`; journey → `firstDataDate .. today`. `previous` is the same number of days immediately before (null for journey, whose `comparisonLabel` is `'journey start'` and whose comparison window is the first 7 days; `buildBodySection` receives it through `view.previous`, set to `firstDataDate .. firstDataDate+6`). `days = daysBetween(from, to) + 1`. `includesToday = to === today`. A journey with no data at all (`firstDataDate` null) gives `window = today..today`.
- `periodTitle`: Weekly check-in, Month review, Whole journey, Custom export; Single workout is built in Task 40. Date part: `6–12 Nov 2026` when the month is the same, `14 Oct–12 Nov 2026` across months, `20 Dec 2025–12 Jan 2026` across years.
- `buildBodySection` produces, in order (all lines use Ruling 8 provenance text; absent pieces print nothing):
  - **context:** the lines of the Body block of the Context template (Task 40 lists the exact text; this function owns these four: *daily-value rule* (Ruling 5), *tier meanings*, *MovingLife provenance* (only when a legacy origin appears in the period or comparison), *formula version* line `- Body-composition formulas: Health Hub version {FORMULA_VERSION} ({short names of the sources used, from FORMULA_SOURCES})` printed only when a `formula` origin appears; when none appears it prints `- Body-composition formulas: Health Hub version {FORMULA_VERSION}; no value in this briefing was computed by them (all body fat is MovingLife's own).` — the version is named either way) and the *watch separation* line.
  - **summary** (`### Body`): per metric in `ROW_ORDER` that has at least one day point in the period, a line
    `- {Label} ({Tier}, {origin text}): {mean} {unit} mean of {n} weigh-in days; {previous|journey start} {value} ({m} days); change {Δ}.`
    with `{mean}` from `formatMetricValue` of `mean(dayPoints in window of the latest point's method)`; the change from `formatMetricChange(metric, meanNow − meanBefore)`; when the previous mean is absent: `no weigh-ins in the previous period`. Then, once each and only when they apply: `- Latest weigh-in: {weight} on {Thu 12 Nov} (a single reading, not an average).`; `- Loss rate: {kg|lb}/week ({x} % of body weight per week, last 28 days, healthy band 0.5–1 %) — {Gaining|Steady|Slow|Healthy|Fast}.`; `- Fat vs lean over the last 30 days: fat {Δ}, lean {Δ}{ (MovingLife-derived)}.`; `- Goal: {x} above goal weight ({latest} vs {goal}).` (or `below`/`at` per sign; only with a goal and a latest weight); the Ruling 8 unavailable-metrics line; the Ruling 4 notes; `- Watch body-fat checks (Galaxy Watch, separate from the scale; not blended): {n} checks on {d} days, mean of the checks {x} %.` when checks exist in the window. No weigh-in at all in the window: the single line `- No weigh-ins in this period.`
  - **detail** (`### Body — daily (each day's first weigh-in)` for levels `full` and `medium`; for `long` only the last 14 days under the heading `### Body — last 14 days (each day's first weigh-in)`): table `Date | Weight ({unit}) | Body fat (%) | Fat mass ({unit}) | Lean mass ({unit}) | Body-fat source`, plus `Body water (%)` and `Muscle (%)` columns **only if** some day in the table has them. One row per calendar day in the window (so gaps are visible); a missing value is `–`. Body-fat source: `Health Hub formula`, `MovingLife`, or `–`. Then, when watch checks exist in the window: `### Watch body-fat checks (Galaxy Watch; separate from the scale)` with `Date | Body fat (%)`, one row per day with the mean of that day's checks. The `*` footnote is Task 40's.
- `bodyWeeklyColumns`: for each Monday-start week touching the window, `Weigh-in days` (count of day points, `–` if none), `Weight ({unit})` and `Body fat (%)` (mean of that week's day points of the latest method, `–` if none).

- [ ] **Step 1: Write the failing tests**

```ts
// period.test.ts
test('week is the 7 days ending today with the 7 days before as previous; today included');       // 2026-11-06..2026-11-12 and 2026-10-30..2026-11-05
test('month is 30 days ending today with the 30 days before as previous');                         // 2026-10-14..2026-11-12
test('custom keeps its range, clamps a future end to today, previous is the same length before');
test('journey runs from the first data day to today, has no previous, compares first 7 days with now');
test('a journey with no data at all is today..today and does not throw');
test('detailLevel: week and custom up to 14 days are full, month and 15–62 are medium, journey and over 62 are long');
test('periodTitle formats same-month, cross-month and cross-year ranges');                          // '6–12 Nov 2026', '14 Oct–12 Nov 2026', '20 Dec 2025–12 Jan 2026'
test('earliestDataDate is the minimum over readings, workouts, activity, sleep wake dates and heart rate, null with no data');
// markdown.test.ts
test('mdTable pads nothing, escapes pipes in cells, and emits the separator row');
test('mean of an empty list is null, never 0 or NaN');
test('dayLabel is "Fri 6 Nov" and gets a trailing * for today');
test('expectGolden fails on a missing file and on a difference, and rewrites with UPDATE_GOLDEN=1');   // run against a temp name
// bodySection.test.ts (syntheticWeek, kg, window = week)
test('weight line: mean 83.6 of 5 weigh-in days, previous 84.7 (4 days), change −1.1 kg, tier Measured, origin scale');
// expected text: "- Weight (Measured, scale): 83.6 kg mean of 5 weigh-in days; previous period 84.7 kg (4 days); change −1.1 kg."
test('a day with two readings uses the first one only (Nov 8 is 83.8, not 84.6)');
test('body fat line is labelled Estimated and MovingLife\'s own figure: 23.6 % mean, previous 24.7 %, change −1.1 pts');
test('fat mass and lean mass are labelled "derived from MovingLife body fat": fat 19.7 kg (previous 20.9, change −1.2 kg), lean 63.9 kg');
test('the latest weigh-in line gives 83.2 kg on Thu 12 Nov and says it is a single reading');
test('water, muscle, bone, protein, visceral, metabolic age and health score never appear as metric lines and one line says why');
test('a loss-rate line appears (the fixture spans more than 14 days) and has the form "kg/week (… % of body weight per week, last 28 days"');
test('the goal line says the latest weight is 8.2 kg above the 75.0 kg goal');
test('watch checks are listed separately: 3 checks on 2 days, mean of the checks 26.2 %, the table shows day means 26.3 (Nov 8) and 26.0 (Nov 11), and no scale line mentions them');
test('the daily table has 7 rows for Nov 6–12, Nov 7 and Nov 11 show – in every value column, and no cell is 0');
test('Nov 12 is labelled with a trailing * (today)');
test('lb unit: the weight line reads "184.3 lb mean … previous period 186.7 lb … change −2.4 lb" and the table header says (lb)');
test('a period with no weigh-ins prints exactly "- No weigh-ins in this period." and no table');
test('the previous period with a different method prints "previous period used a different method; not compared"');   // build a variant fixture: previous = scale/formula readings
test('formula-origin readings (impedance 500 ohm, person M) are labelled "Health Hub formula v1" and add water and muscle columns');
test('journey view compares the first 7 days with now and says "journey start"');
test('the formula version line names version 1 in both the formula and the all-MovingLife cases');
test('missing profile (no height, sex, birth date): weight still prints, BMI and ranges-dependent lines are absent, nothing throws');
test('weekly columns: the week of 2026-11-09 has 3 weigh-in days (Nov 9, 10, 12), weight mean 83.4 and body fat mean 23.4');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Generate nothing golden yet (Task 40 does). Then the full gate.
- [ ] **Step 3: Commit**: `git add src/domain/export src/test-support/golden.ts` → "Add export period model and body briefing section".

---

### Task 38: The Training section

**Files:**
- Create: `src/domain/export/trainingSection.ts`, `adherence.ts`
- Test: `src/domain/export/trainingSection.test.ts`, `adherence.test.ts`

**Interfaces (produces):**
```ts
// adherence.ts
export interface Adherence { scheduled: number; done: number; missed: number; openToday: number }
export function adherence(schedule: readonly ScheduledWorkout[], workouts: readonly Workout[], window: DateWindow, today: DateKey): Adherence | null;   // null when no schedule item is in the window (Ruling 6)
// trainingSection.ts
export function buildTrainingSection(prep: Prepared, view: PeriodView): SectionText;
export function trainingWeeklyColumns(prep: Prepared, view: PeriodView): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> };   // Sessions, Volume ({unit}), Scheduled, Done
export function isBodyweightExercise(workouts: readonly Workout[], exerciseId: number): boolean;   // best logged weight over all history is 0, or no scored set
```

**Behaviour.**
- Workouts in a window are those whose `localDateKey(performedAt)` falls inside it. Volume is `workoutVolumeKg` (every scored set; `completed` is never read). Weights print with `formatWeightNumber`/the unit; volumes with `formatVolume`.
- **summary** (`### Training`):
  - `- Workouts logged: {n} (previous period {m}); volume {V} (previous {W}).` For journey: `- Workouts logged: {n} over {weeks} weeks ({x} per week); total volume {V}.` and no previous. Zero workouts: `- No workouts logged in this period.` (a genuine zero count).
  - `- Adherence: {done} of {scheduled} scheduled sessions done; {missed} missed{; {openToday} scheduled today, not yet done}.` followed by ` Previous period: {d} of {s}.` when it has data. No schedule items: `- Adherence: no scheduled sessions are stored for this period.`
  - `- Personal records this period: {Exercise} weight {w} (previous best {p}) on {Sat 7 Nov}; …` one entry per PR from `computePersonalRecords` whose workout is in the window, `kind` `weight` or `e1rm` (`{Exercise} estimated 1RM {x} (previous best {p})`), skipping bodyweight exercises. None: no line.
  - `- Best estimated 1-rep max (Epley, sets of 1–12 reps) this period vs all earlier: {Exercise} {x} {unit} ({state}); …` states per Ruling 7 (`first time logged`, `new best +{d}`, `no change`, `below earlier best {y}`), ordered by exercise name, bodyweight and no-e1RM exercises skipped. None: no line.
  - Journey adds `- Most-trained lifts: {Exercise} ({sessions} sessions, e1RM {first} → {now} {unit}, best weight {w} {unit}); …` for up to 5 non-bodyweight exercises with the most sessions.
- **detail** (`### Workouts`): `full`: for each workout, oldest first, a heading `#### {Sat 7 Nov} · {title} · {58 min} · volume {1.1 t}` (duration omitted when null) and one bullet per exercise, in performed order: `- {name}: 80×5, 85×5, 90×3 (PR)`. A set is printed when `isScoredSet`; weight-0 sets print `BW×8`; a set that set a PR (`prSetKeys`) gets ` (PR)` unless the exercise is bodyweight. An exercise with sets but none scored: `- {name}: no weight × reps sets logged`. `medium`: a table `Week of | Sessions | Volume ({unit}) | Scheduled | Done` (one row per Monday-start week touching the window, `–` for a week with no schedule items) followed by one line per workout `- {Sat 7 Nov} · {title} · {58 min} · {1.1 t}`. `long`: nothing here (the weekly table is Task 40's).
- `trainingWeeklyColumns`: sessions (a real count, so `0` is allowed), volume (`–` when 0 sessions), scheduled and done counts per week (`–` when none).

- [ ] **Step 1: Write the failing tests** (synthetic week; kg unless noted)

```ts
// adherence.test.ts
test('period: 5 scheduled, 3 done (Nov 7, 9 and 11 each have a logged workout), 1 missed (Nov 10), 1 open today (Nov 12)');
test('a ticked schedule item with no logged workout counts as done');
test('an untouched item dated today is open, never missed');
test('previous period: 2 scheduled, 1 done (Nov 2), 1 missed (Nov 4)');
test('no schedule items in the window returns null');
// trainingSection.test.ts
test('summary: 3 workouts, previous 1, volume 4.0 t vs 1.1 t');     // 1095+1315+1610 = 4020 kg; 1055 kg
test('adherence line reads "3 of 5 scheduled sessions done; 1 missed; 1 scheduled today, not yet done. Previous period: 1 of 2."');
test('volume ignores the tick: sets with completed false still count');
test('weight PR line: Bench Press weight 90 kg (previous best 85 kg) on Sat 7 Nov, and no PR line for Squat or Barbell Row (first sessions) or for the Pull-up');
test('e1RM line: Bench Press 99.2 kg (no change), Squat 116.7 kg (first time logged), Barbell Row 88.7 kg (first time logged); Pull-up absent');   // Epley 85×5 = 99.17, 100×5 = 116.67, 70×8 = 88.67
test('a new best prints "new best +x" and a lower one "below earlier best y" (variant fixture)');
test('Epley counts only sets of 1–12 reps: a 15-rep set gives no e1RM and an exercise with only such sets has no e1RM line');
test('isBodyweightExercise is true for the Pull-up (0 kg) and false for Bench; true for an exercise with no scored set');
test('full detail: three headings oldest first; Upper Strength bullets "- Bench Press: 80×5, 85×5, 90×3 (PR)" and "- Pull-up: BW×8, BW×8"');
test('a workout title and duration: "#### Sat 7 Nov · Upper Strength · 58 min · volume 1.1 t"; duration omitted when null');
test('lb unit: bench 80, 85 and 90 kg print as 176.4×5, 187.4×5, 198.4×3 (one decimal, trailing .0 dropped) and 4,020 kg prints as "8.9k lb"');
test('medium detail: weekly table has the week of 2026-11-09 with 2 sessions (Nov 9, Nov 11) and the week of 2026-11-02 … and one line per workout without sets');
test('a journey summary has no previous period and lists the most-trained lifts without the Pull-up');
test('no workouts in the window: exactly "- No workouts logged in this period." and no detail heading');
test('a workout with null weight or reps sets does not break the line and null sets are not shown');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Full gate.
- [ ] **Step 3: Commit**: `git add src/domain/export` → "Add export training section and adherence".

---

### Task 39: Activity, Sleep and Heart rate sections

**Files:**
- Create: `src/domain/export/activitySection.ts`, `sleepSection.ts`, `heartRateSection.ts`, `dailyTable.ts`
- Test: `activitySection.test.ts`, `sleepSection.test.ts`, `heartRateSection.test.ts`, `dailyTable.test.ts` (all under `src/domain/export/`)

**Interfaces (produces):**
```ts
export function buildActivitySection(prep: Prepared, view: PeriodView): SectionText;
export function buildSleepSection(prep: Prepared, view: PeriodView): SectionText;
export function buildHeartRateSection(prep: Prepared, view: PeriodView): SectionText;
export function activityWeeklyColumns(prep: Prepared, view: PeriodView): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> };   // Steps/day, Distance/day
export function sleepWeeklyColumns(...): same shape;            // Sleep/night
export function heartRateWeeklyColumns(...): same shape;        // Heart rate avg
// dailyTable.ts — one table for the three sections
export function buildDailyActivityTable(prep: Prepared, view: PeriodView, days: DateWindow): string[];   // columns follow the toggled sections
export function buildPeriodTable(prep: Prepared, view: PeriodView): string[];                          // weekly (medium) table of the three sections
```
`SectionText.detail` of these three builders is **empty**; the combined table is added by Task 40 through `buildDailyActivityTable` / `buildPeriodTable` so the three sections share one table.

**Behaviour.**
- Helper in `dailyTable.ts`: `completedDays(window, today)` = the window without today; a day "has data" when the field is non-null.
- **Activity summary** (`### Activity`): `- Steps: mean {x} per day over {n} completed days with data ({k} days without data skipped); total {t}; previous period {y} per day ({m} days); change {Δ}.` Distance (unit rule): `- Distance: mean {d} {mi|km} per day over {n} days with data (recorded on {n} of {N} completed days); total {t} {mi|km}; previous period …`. Total calories only if any day has `totalKcal`: `- Total calories (all-day burn, not active calories): mean …`. **Active calories are never printed** (the data has none). All-null for a metric: `- Steps: no data in this period.` The journey uses `journey start` in place of previous. Today is excluded from every mean and total (rule 9).
- **Sleep summary** (`### Sleep`): `- Sleep: mean {6h 57m} per night over {n} nights with data ({k} days without data skipped); previous period {7h} ({m} nights); change {−3 min}.` Plus, with ≥ 3 nights (`sleepConsistency`): `- Typical bedtime {23:10}, wake {06:40}, bedtime spread ±{25} min.` Plus, when any night has stages: `- Average stages per night: light {x}, deep {y}, REM {z}.` (only nights with stages). Sleep for today counts. Nights come from `buildSleepNights` filtered by `date` in the window.
- **Heart rate summary** (`### Heart rate`): `- Heart rate (daily min / avg / max only; no resting heart rate is available): lowest {50} bpm, highest {150} bpm, mean of daily averages {68} bpm over {n} completed days with data; previous period {…}.` Today excluded.
- **Context lines** (owned here): `- Sleep: a night belongs to the day it ends on; naps are included.`; `- Heart rate: daily minimum, average and maximum only. No resting or asleep heart rate is available.`; `- Today ({date}) is partial: its steps, distance and heart rate are marked * and left out of averages and totals.` (only when `view.includesToday` and one of those sections is on).
- **`buildDailyActivityTable`** columns: `Date`, then `Steps` and `Distance ({mi|km})` (activity on), `Sleep (night ending that day)` (sleep on), `Heart rate min / avg / max` (heart rate on). Heading `### Activity, sleep and heart rate — daily` (the builder of Task 40 supplies the heading; this function returns the table lines). One row per day; `–` for a missing value; today's `Steps`, `Distance` and heart-rate cells are printed (with the row's `*`) so the owner sees them, though they are excluded from the summary. A footnote line `* today: steps, distance and heart rate so far.` follows when the window includes today.
- **`buildPeriodTable`** (medium level and the weekly table of long): rows per Monday-start week: `Week of | Steps/day | Distance/day ({mi|km}) | Sleep/night | Heart rate avg` using completed days with data only (`–` when none; the current partial week's cells use only completed days and the row label gets ` (to date)`).

- [ ] **Step 1: Write the failing tests** (synthetic week)

```ts
// activitySection.test.ts
test('steps: mean 8,000 per day over 5 completed days with data (1 day skipped), total 40,000; previous 6,833 per day (6 days); change +1,167');   // days 6,7,9,10,11; Nov 8 has no row; today 2,500 excluded
test('the null day is skipped, not counted as 0: the mean of [8000, 6000, null, 10000, 7000, 9000] is 8000 not 6667');
test('distance in km: mean 7.0 km over 3 days with data (recorded on 3 of 6 completed days), total 21.0 km');
test('distance in miles for lb: mean 4.3 mi, total 13.0 mi');
test('active calories are never printed and no total-calorie line appears when no day has it');
test('a metric that is null on every day prints "no data in this period"');
test('journey says "journey start" instead of previous');
// sleepSection.test.ts
test('mean 6h 57m per night over 5 nights with data (2 days skipped); previous 7h over 3 nights; change −3 min');
test('the nap on Nov 10 is added to that night: 8h, not 7h 30m');
test('a session ending Nov 12 counts today; a night is dated by its wake day');
test('consistency line appears with at least 3 nights and not with 2');
test('no sleep in the window prints "- Sleep: no data in this period."');
// heartRateSection.test.ts
test('lowest 50, highest 150, mean of daily averages 68 over 4 completed days; today (160 max) excluded');
test('the line says there is no resting heart rate');
test('no heart-rate rows prints "no data in this period"');
// dailyTable.test.ts
test('daily table has 7 rows; Nov 8 has no steps (–) but has sleep and heart rate; Nov 9 has steps and no sleep');
test('today row is Thu 12 Nov* and the footnote line is present only when the window includes today');
test('columns follow the toggles: with activity off there is no Steps or Distance column');
test('period table: the week of 2026-11-09 is labelled "(to date)" and uses completed days only');
test('no cell in any table is 0 for a missing value');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Full gate.
- [ ] **Step 3: Commit**: `git add src/domain/export` → "Add export activity, sleep and heart rate sections".

---

### Task 40: The briefing assembler, presets, journey aggregates and CSV

**Files:**
- Create: `src/domain/export/buildBriefing.ts`, `singleWorkout.ts`, `csv.ts`, `starterPrompts.ts`
- Create goldens: `src/domain/export/__golden__/week-kg.md`, `week-lb.md`, `month.md`, `journey.md`, `journey.csv`, `workout.md`, `custom-subset.md`, `empty.md` (generated with `UPDATE_GOLDEN=1`, then reviewed)
- Test: `src/domain/export/buildBriefing.test.ts`, `singleWorkout.test.ts`, `csv.test.ts`, `starterPrompts.test.ts`

**Interfaces (produces):**
```ts
// starterPrompts.ts
export const DEFAULT_STARTER: Readonly<Record<PresetId, string>>;      // Ruling 14 texts
// buildBriefing.ts
export interface Briefing { title: string; markdown: string; csv: string | null; csvFileName: string | null; characters: number; lineCount: number }
export interface BriefingContext { today: DateKey; unit: WeightUnit }
export function buildBriefing(data: ExportData, request: ExportRequest, context: BriefingContext): Briefing;
export function sectionsEnabled(request: ExportRequest): SectionId[];      // honours Ruling 13 (single workout: body and sleep only)
export function sizeLabel(b: Briefing): string;                            // 'About 1,900 characters', ' + CSV' suffix for journey with csv
// singleWorkout.ts
export function buildSingleWorkout(prep: Prepared, request: ExportRequest, ctx: BriefingContext): SectionText & { title: string } | null;   // null when the workout id is unknown
// csv.ts
export function buildJourneyCsv(prep: Prepared, view: PeriodView): { fileName: string; content: string };
```

**The Markdown template (exact).** Lines in `{}` come from the section builders; a section the owner turned off contributes nothing anywhere.

```
# {periodTitle}                                  e.g. "# Weekly check-in · 6–12 Nov 2026"

> {starter question}                              omitted when the starter is empty

## Context
- Period: {Fri 6 Nov} – {Thu 12 Nov 2026} ({7} days). Compared with {Fri 30 Oct} – {Thu 5 Nov 2026}.      journey: "Period: {first day} – {today} ({n} days). Compared: first 7 days of the journey against the last 7 days."
- Person: {male}, {31} years, {175} cm. Goal weight {75.0} kg.        only the fields that are set; omitted when none
- Units: weights in {kg|lb}, distances in {km|mi}.
- Missing data: "–" means no data for that day. A missing day is missing, not zero, and is left out of every average and total; each line says how many days it used.
- Generated by Health Hub on {2026-11-12} from the owner's own data. This is not medical advice.
{context lines from the enabled sections, in order Body, Workouts, Activity, Sleep, Heart rate}

## Summary
{### Body …}  {### Training …}  {### Activity …}  {### Sleep …}  {### Heart rate …}      each only if enabled

## Detail
{Body daily/weekly tables}  {### Workouts …}  {### Activity, sleep and heart rate — daily|weekly}     per detail level (Ruling 3)
```
- The Workouts context lines (owned here): `- Strength: volume = sum of weight × reps over every logged set (Lyfta's tick is ignored). Estimated 1-rep max uses Epley, only from sets of 1–12 reps. Bodyweight exercises (best weight 0) have no 1-rep max or PR lines.` and `- Adherence: a scheduled session counts as done when Lyfta marks it complete or a workout was logged that day. A session scheduled today and not yet done is "not yet done", not missed.`
- `long` detail order: `### Weekly aggregates` (table: `Week of` as ISO date, then the columns of the enabled sections in order: body weigh-in days / weight / body fat; training sessions / volume / scheduled / done; activity steps/day / distance/day; sleep/night; heart rate avg; one row per Monday-start week from the first to the current week, the current week suffixed ` (to date)`), then `### Last 14 days` containing the body last-14-days table and the daily activity/sleep/heart-rate table for those 14 days.
- Weekly aggregate rows are produced by zipping each section's `…WeeklyColumns` by week key (a section with no entry for a week contributes `–` cells). It never reads zero-filled series.
- **Single workout** (`workout` preset) replaces Context/Summary/Detail with: title `# Single workout · {title} · {Sat 7 Nov 2026}`; the starter quote; `## Context` (period line replaced by `- Workout: {title} on {date} ({58 min}, volume {1.1 t}).`, the person/units/missing-data/not-medical lines, and the Strength lines above); `## Summary` with `- Volume {…}; {n} sets logged; {k} personal records.` and, with Body on, `- Weigh-in that day: {83.8 kg} ({Measured, scale}); body fat {23.8 %} ({Estimated, MovingLife's own figure}) — the first reading of the day.` (or `- No weigh-in that day.`), with Sleep on `- Sleep the night before: {7h} (night ending {Sat 7 Nov}); naps included.` (or `- No sleep recorded for that night.`); `## Detail` with `### Every set` (per exercise `- {name}: 80×5 (RIR 2), 85×5 (RIR 1), 90×3 (PR)`; RIR shown only when set; unscored sets summarised as in Task 38) and `### Last time` (per non-bodyweight exercise the previous session: `- {name}: last time {Mon 2 Nov}, top set {85×3}, best estimated 1RM {93.5} {unit}; today best estimated 1RM {99.2} {unit} ({state})`; `first time logged` when none; bodyweight exercises list only `last time {date}, best set BW×{reps}` and carry **no** 1RM text). Unknown `workoutId` → the briefing is the title plus `- This workout is no longer stored.`.
- **CSV** (`journey` + `includeCsv`): file name `health-hub-journey.csv`; header exactly (kg): `date,weight_kg,body_fat_pct,body_fat_source,fat_mass_kg,lean_mass_kg,bmi,bmr_kcal,watch_body_fat_pct,workouts,volume_kg,steps,distance_km,asleep_hours,hr_min,hr_avg,hr_max`; for `lb`: `weight_lb`, `fat_mass_lb`, `lean_mass_lb`, `volume_lb`, `distance_mi` in place of the kg/km names. One row per calendar day from the first day with data to today, ascending; numbers with up to 2 decimals and no thousands separators; **an empty cell for every missing value** (`,,`), `workouts` is the count (0 on a day without workouts) and `volume_*` is empty when there were none; `body_fat_source` is `formula`, `movinglife` or empty; fat and lean mass follow the body-fat source; `watch_body_fat_pct` is the day's mean of checks; today's steps, distance and heart-rate cells are empty (partial). `bmi` and `bmr_kcal` use the day point rule. No quoting is needed because no cell contains a comma, quote or newline.
- `sizeLabel`: `About {round(characters/100)*100 with thousands separator} characters`, `—` for zero sections, suffixed ` + CSV` when `csv !== null`.

- [ ] **Step 1: Write the failing tests**

```ts
// starterPrompts.test.ts
test('every preset has a non-empty default starter question');
// buildBriefing.test.ts — each golden test also asserts the lines listed here with toContain
test('week-kg golden: the full briefing for syntheticWeek, kg, today 2026-11-12');
//   contains: "# Weekly check-in · 6–12 Nov 2026", "> Review my week and suggest changes", "## Context", "## Summary", "## Detail",
//   "Period: Fri 6 Nov – Thu 12 Nov 2026 (7 days). Compared with Fri 30 Oct – Thu 5 Nov 2026.",
//   "- Weight (Measured, scale): 83.6 kg mean of 5 weigh-in days; previous period 84.7 kg (4 days); change −1.1 kg.",
//   "- Workouts logged: 3 (previous period 1); volume 4.0 t (previous 1.1 t).",
//   "- Steps: mean 8,000 per day over 5 completed days with data", "- Sleep: mean 6h 57m per night over 5 nights with data",
//   "lowest 50 bpm, highest 150 bpm", "Body-composition formulas: Health Hub version 1", "### Body — daily (each day's first weigh-in)", "### Workouts", "### Activity, sleep and heart rate — daily"
test('week-lb golden: same data in lb and miles; weight 184.3 lb, distance in mi, volume "8.9k lb", table headers say (lb)');
test('month golden: 30 days; daily body table has 30 rows; training section has a weekly table and one line per workout and no sets; activity/sleep/heart rate are a weekly table; level medium');
test('journey golden (syntheticJourney): weekly aggregates table has one row per Monday-start week (18 rows for 120 days ending Thu 2026-11-12), the current week ends with "(to date)", "### Last 14 days" has 14 daily body rows and 14 daily activity rows, no per-workout lines and no sets, characters under 20,000');
test('journey comparison text says "journey start" and the Period line names the first and last 7 days');
test('custom-subset golden: custom range 2026-11-09..2026-11-11 with workouts and heart rate off: no Training or Heart rate text anywhere, no context line about strength or heart rate, 3-day daily tables');
test('custom 20 days uses medium detail; custom 70 days uses long');
test('an empty request (all sections off) still returns a title and a single "Choose at least one section." line, and sectionsEnabled is []');
test('empty data golden: every enabled section says it has no data, there are no tables and no 0 or NaN or undefined anywhere in the text');
test('the starter line is omitted when empty and present as a quote when set; the quote is the second block');
test('no occurrence of "NaN", "undefined", "Infinity", "[object" in any golden');
test('the Markdown has no trailing spaces and ends with exactly one newline');
test('active calories never appear in the text');
test('privacy: building a briefing writes nothing to console (spy on console.log/warn/error)');
test('sizeLabel rounds to 100 and appends " + CSV" for a journey with the CSV');
test('sectionsEnabled for single workout is body and sleep only when toggled, ignoring the other three');
// singleWorkout.test.ts (workout of Sat 7 Nov)
test('golden workout.md (Sat 7 Nov): every set of Bench Press 80×5, 85×5, 90×3 (PR) and Pull-up BW×8, BW×8; volume 1.1 t; 5 sets logged; 1 personal record; "No weigh-in that day."');
test('the Mon 9 Nov workout uses that day\'s first reading: 83.6 kg and body fat 23.6 %, labelled; with Body off the weigh-in line is absent');
test('previous night = the sleep ending that day: 6h 30m for Sat 7 Nov; "No sleep recorded for that night." for Mon 9 Nov; a night with a nap adds the nap (Nov 10)');
test('last time: Bench Press last Mon 2 Nov, top set 85×3, best e1RM 93.5 kg; today 99.2 kg; "new best +5.7 kg"');   // 99.17 − 93.5 = 5.67
test('first-time exercise says "first time logged"; the Pull-up has no 1RM or PR text anywhere');
test('RIR appears only where set');
test('an unknown workout id returns the "no longer stored" briefing');
// csv.test.ts (syntheticJourney, kg and lb)
test('header line is exactly the kg header and exactly the lb header for lb');
test('one row per day from the first day with data to today: 120 rows plus the header');
test('a missing value is an empty cell and never 0: a null-steps day has ",," in the steps column; the workouts column is 0 on a day without workouts while volume is empty');
test('today\'s steps, distance and heart rate cells are empty');
test('body_fat_source is movinglife for legacy readings; the weight of a day with two readings is the first one');
test('every row has the same number of fields as the header and no field contains a comma, quote or newline');
test('journey.csv golden');
```

- [ ] **Step 2: Run → FAIL**, implement, generate goldens with `UPDATE_GOLDEN=1 npx jest src/domain/export`, **read every golden against the assertions above** (any mismatch is a bug in the code, not in the golden), **Run → PASS** without the flag. Full gate.
- [ ] **Step 3: Commit**: `git add src/domain/export` → "Add export briefing builder, presets and journey CSV".

---

### Task 41: Delivery adapter, dependencies and the data hook

**Files:**
- Create: `src/data/export/ExportDelivery.ts`, `src/data/export/expoExportDelivery.ts`, `src/ui/data/useExportData.ts`, `src/data/export/exportCache.ts`
- Modify: `package.json`, `package-lock.json`, `src/bootstrap/container.ts` (add `exportDelivery`)
- Test: `src/data/export/exportCache.test.ts`, `src/ui/data/useExportData.test.ts` (loader function only)

**Dependencies.** From the project root: `npm install --save-exact expo-sharing@57.0.26 expo-clipboard@57.0.2 expo-file-system@57.0.7`, then `npx expo install --check` must report nothing to change (those are the SDK 57 versions in `expo/bundledNativeModules.json`). No `app.json` plugin entries.

**Interfaces (produces):**
```ts
// ExportDelivery.ts — no expo imports
export interface ExportFile { name: string; content: string; mimeType: 'text/csv' | 'text/plain' }
export interface ExportDelivery {
  /** Opens the Android share sheet with the text as the message. */
  shareText(text: string, dialogTitle: string): Promise<void>;
  /** Sweeps the export cache, writes the file there, opens the share sheet for it. The file is left for the next sweep (Ruling 11). */
  shareFile(file: ExportFile, dialogTitle: string): Promise<void>;
  copyText(text: string): Promise<void>;
  /** Deletes every file in the export cache folder. */
  sweep(): Promise<void>;
}
// exportCache.ts — pure
export const EXPORT_CACHE_DIR = 'health-hub-export';
export function safeExportFileName(name: string): string;     // keeps [A-Za-z0-9._-], anything else becomes '-', never empty, never starts with '.'
// expoExportDelivery.ts — adapter, the only importer of react-native Share, expo-sharing, expo-clipboard, expo-file-system
export function createExpoExportDelivery(): ExportDelivery;
// useExportData.ts
export async function loadExportData(c: Pick<AppContainer, 'workouts' | 'schedule' | 'body' | 'profile' | 'healthConnect'>): Promise<ExportData>;   // schedule.listBetween('2000-01-01', '2100-12-31')
export function useExportData(): AsyncState<ExportData>;      // re-read on dataVersion and on focus, like useBodyData
```

**Behaviour.**
- `shareText` calls `Share.share({ message: text, title: dialogTitle }, { dialogTitle })`. `shareFile` calls `sweep()`, writes `new File(Paths.cache, EXPORT_CACHE_DIR/<safeName>)` (creating the directory, `overwrite`), then `Sharing.shareAsync(file.uri, { mimeType, dialogTitle })`; if `Sharing.isAvailableAsync()` is false it throws an `Error('Sharing is not available on this device')`. `copyText` calls `Clipboard.setStringAsync(text)`. `sweep` deletes the export directory if it exists and recreates nothing. None of these functions logs or embeds text in an error message.
- The container gains `exportDelivery: ExportDelivery` (built once, stateless).
- The data hook keeps `useBodyData`'s focus-refresh pattern and returns raw rows only; building the briefing is the screen's job.

- [ ] **Step 1: Write the failing tests**

```ts
// exportCache.test.ts
test('safeExportFileName keeps letters, digits, dot, dash and underscore and replaces everything else with -');
test('safeExportFileName never returns an empty string or a leading dot, and never contains a slash');
test('EXPORT_CACHE_DIR is a plain folder name');
// useExportData.test.ts (sql.js repositories or in-memory fakes)
test('loadExportData returns workouts, a wide schedule range, readings, profile versions, watch checks, activity, sleep and heart rate');
test('loadExportData on an empty database returns empty arrays and does not throw');
```
There is no unit test for `expoExportDelivery.ts` (a thin adapter over four native calls; Task 43 verifies it on the phone). Lint rule check: `grep -rn "console\." src/data/export src/domain/export src/ui/screens/export` must print nothing.

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Full gate.
- [ ] **Step 3: Commit**: `git add package.json package-lock.json src/data/export src/ui/data src/bootstrap` → "Add export delivery adapter and data hook".
- [ ] **Step 4 (controller): native rebuild, once.** This plan adds three native modules, so the installed dev client lacks them. Run:
```bash
cd /Users/jereenvalsson/personal/health-hub
npx expo prebuild --platform android          # never --clean
cd android && ./gradlew assembleDebug && cd ..
adb -s 59180DLCQ00B36 install -r android/app/build/outputs/apk/debug/app-debug.apk
```
Expected: the build succeeds, the install is an update (data and SecureStore key survive), the app still opens on the Today tab. Check `git status`: `android/` is untracked and stays unstaged. If `prebuild` reports a plugin problem, stop and report; never use `--clean`.

---

### Task 42: The Export screen

**Files:**
- Create: `src/ui/screens/export/ExportScreen.tsx`, `exportForm.ts`, `PresetList.tsx`, `SectionChips.tsx`, `StarterInput.tsx`, `PreviewCard.tsx`, `ShareBar.tsx`, `WorkoutSheet.tsx`, `RangeSheet.tsx`, `FullPreviewSheet.tsx`, `ExportSkeleton.tsx`, `previewLines.ts`, `shareMode.ts`
- Modify: `app/(tabs)/export.tsx` (re-export the new screen)
- Delete: `src/ui/screens/placeholders/ExportScreen.tsx`
- Test: `src/ui/screens/export/exportForm.test.ts`, `previewLines.test.ts`

**Interfaces (produces):**
```ts
// shareMode.ts
/** What the Share button sends. Flip to 'file' if ChatGPT drops shared text (Plan 6, Task 43). */
export const SHARE_BRIEFING_AS: 'text' | 'file' = 'text';
// exportForm.ts — pure state model, the one place the screen's rules live
export interface ExportForm {
  preset: PresetId; sections: Record<SectionId, boolean>; starter: string; starterEdited: boolean;
  workoutId: number | null; custom: DateWindow | null; includeCsv: boolean;
}
export function initialForm(latestWorkoutId: number | null): ExportForm;                // week, all five sections on, starter = DEFAULT_STARTER.week, csv on
export type FormAction =
  | { type: 'preset'; preset: PresetId; today: DateKey; firstDataDate: DateKey | null }
  | { type: 'toggleSection'; section: SectionId } | { type: 'toggleCsv' }
  | { type: 'starter'; text: string } | { type: 'workout'; id: number }
  | { type: 'customRange'; window: DateWindow };
export function formReducer(form: ExportForm, action: FormAction): ExportForm;
export function visibleChips(preset: PresetId): Array<SectionId | 'csv'>;                // Ruling 13
export function canShare(form: ExportForm): boolean;                                     // at least one visible chip on (a single workout needs a workout id too)
export function toRequest(form: ExportForm): ExportRequest;
export function stepDate(window: DateWindow, edge: 'from' | 'to', days: number, bounds: { first: DateKey; today: DateKey }): DateWindow;   // Ruling 15
export function presetSubtitle(preset: PresetId, i: { workoutLabel: string | null; firstDataDate: DateKey | null; today: DateKey; custom: DateWindow | null }): string;
// previewLines.ts
export interface PreviewLine { text: string; tone: 'heading' | 'muted' | 'ink' }
export function previewLines(markdown: string, max: number): { lines: PreviewLine[]; more: number };   // '#' lines heading, '|' lines muted
```

**Screen (match `Export.dc.html`).** Header: `ScreenHeader` with subtitle "Brief ChatGPT in two taps" and title "Export". Preset radio card (Card, five rows, 62px min height, title 15/600 and subtitle 12 muted, a 22px radio ring whose selected state is a 7px `accent` border, `accessibilityRole="radio"`, `accessibilityState.checked`; dividers `line`). Subtitles: Weekly "Last 7 days vs the week before"; Month "Last 30 days"; Journey "Weekly averages since {Month Year}, plus a CSV" (the first data month); Single workout the chosen workout's "{title} · {Today|Fri 6 Nov}" when selected, else "Every set, plus that day's body and sleep"; Custom "Pick dates and sections" or the chosen range. Section label "INCLUDE" and wrapping chips (`min-height 44`, pill; on = `ink` fill with `bg` text and a check icon, off = transparent with `line` border and `muted` text; `accessibilityState.selected`; selection haptic). Section label "START WITH A QUESTION" and the single-line input (52px, radius 16, `card` fill, `line` border, Geist 15). Preview card (`Card`, 16 padding): "Preview" 15/600 and the size label right; a `bg` box radius 14 with the preview lines in `AppText variant="mono"`, headings `accentInk`, table lines `muted`, a trailing muted "… {n} more lines"; for the journey with CSV on, a footer row with a `plain` "Share CSV" button. Tapping the preview box opens `FullPreviewSheet`. Bottom bar (sticky above the tab bar, absolute, `left/right 20`, bottom = tab bar inset + 12): primary pill "Share to ChatGPT" (56px, `accent`, share icon `export`) and a 56px round copy button (`raised`, `line` border, a clipboard icon added to `iconPaths.ts`, `accessibilityLabel="Copy to clipboard"`). Both disabled (opacity 0.4) when `!canShare`. After Copy the caption "Copied to clipboard" shows for 2 s above the bar; a failed share shows "Couldn't open the share sheet. Try Copy instead." in `statusHigh`. Choosing "Single workout" opens `WorkoutSheet` ("Choose a workout", the 20 newest workouts as rows: title, `{Today|Wed 11 Nov} · {58 min} · {12.4 t}` via `formatRelativeDay`, `formatDuration`, `formatVolume`; the newest is preselected); choosing "Custom range" opens `RangeSheet` (two rows From / To with `−7 −1 +1 +7` buttons and a "Done" `primary` button). Loading shows `ExportSkeleton`; a data error shows `EmptyState` "Couldn't load your data" with a retry; no data at all (`earliestDataDate` null) shows `EmptyState` "Nothing to export yet" with an "Open Settings" action. Light and dark come from tokens only.

**Behaviour.** The screen holds `useReducer(formReducer)`, `useExportData()`, `usePreferences()`, and builds `briefing = useMemo(() => buildBriefing(data, toRequest(form), { today, unit }), …)`. Share: `SHARE_BRIEFING_AS === 'text'` → `exportDelivery.shareText(briefing.markdown, title)`; `'file'` → `shareFile({ name: 'health-hub-briefing.md', content, mimeType: 'text/plain' }, title)`. "Share CSV" → `shareFile({ name: briefing.csvFileName, content: briefing.csv, mimeType: 'text/csv' }, …)`. Copy → `copyText`. `useEffect` calls `exportDelivery.sweep()` on mount (Ruling 11). No call logs the text; errors are caught and shown as the fixed strings above. The tab re-reads on focus through the hook.

- [ ] **Step 1: Write the failing tests**

```ts
// exportForm.test.ts
test('initialForm is the weekly preset with all five sections on, the weekly starter, csv on and the latest workout selected');
test('switching preset replaces the starter only when the owner has not edited it');
test('editing the starter marks it edited and a later preset switch keeps the text; clearing it leaves an empty starter');
test('toggleSection flips one section; toggleCsv flips csv');
test('visibleChips: week, month, custom show the five section chips; journey adds csv; workout shows body and sleep only');
test('canShare is false when every visible chip is off, and false for a single workout without a workout id');
test('turning off a chip that is hidden for the current preset does not affect canShare');
test('toRequest passes the form through unchanged and drops csv for presets other than journey');
test('selecting custom without a range seeds it to the last 14 days, clamped to the first data date');
test('stepDate moves From and To by ±1 and ±7 days, never past today, never before the first data date, never lets From pass To (it moves To with it)');
test('presetSubtitle: weekly, month, journey ("Weekly averages since May 2026, plus a CSV"), workout with and without a choice, custom with and without a range');
// previewLines.test.ts
test('headings are lines starting with #, table lines start with |, everything else is ink');
test('max lines are returned and "more" counts the rest; short input has more 0');
test('blank lines are kept as spacing but are not counted twice');
```
Manual checks by the builder (no device, no adb): `npm run typecheck`, `npm run lint`, and a read-through of `iconPaths.ts` for the new clipboard icon (24×24 viewBox, 1.8 stroke like its neighbours).

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Full gate; `grep -rn "console\." src/ui/screens/export` prints nothing.
- [ ] **Step 3: Commit**: `git add src/ui/screens/export src/ui/components/iconPaths.ts "app/(tabs)/export.tsx" src/ui/screens/placeholders` → "Add the Export screen".

---

### Task 43: On-device verification, debug and release (controller)

The controller drives the phone. Nothing here is delegated to a builder. Save screenshots to the scratchpad `shots/` folder as `t43-*`; never commit them (they show personal data). Read and record the current `cmd uimode night` value first.

- [ ] **Step 1: Pre-flight.** The full gate passes, `git status` is clean, Task 41 Step 4's rebuilt dev client is installed, Settings holds the profile (height, birth date, sex, goal).
- [ ] **Step 2: Debug app.** Start Metro per the on-device JS check procedure and open the Export tab.
- [ ] **Step 3: Briefing correctness against the phone's data** (values stay on screen; the ledger records only "match", "mismatch" or "n/a"). Open the Weekly check-in preview (full-text sheet) and verify:
  1. **Body.** The latest weigh-in equals MovingLife's own list for that day; the period weight mean equals the mean of the Body tab's Day points for the period (spot-check by hand with 3 days); body fat is labelled "MovingLife's own figure"; fat and lean mass say "derived from MovingLife body fat"; the unavailable-metrics line is present; **no** water, muscle, bone, protein, visceral, metabolic age or health score value appears; the formula-version line names version 1; the 18 watch checks appear only in their own "Watch body-fat checks" block and no scale line mentions them.
  2. **NULL not 0.** Days without a weigh-in, steps, distance (about half the days), sleep or heart rate show `–`; no `0` stands in for a missing value; "days skipped" counts match the number of `–` cells; active calories appear nowhere.
  3. **Training.** Workout count and volume equal the Workouts tab's week totals; a bodyweight exercise (if any was done this week) has no e1RM or PR line; weights are in the owner's unit.
  4. **Adherence** matches the Upcoming/schedule data in the Workouts tab; a session scheduled today and not done is "not yet done".
  5. **Activity, sleep, heart rate** match the Activity tab for the same days (steps, sleep totals including a nap day if any; heart-rate min/avg/max; no resting figure); today's row has `*` and is excluded from the means.
  6. **Presets.** Month review (medium level, about 30 body rows), Whole journey (weekly table, last-14-days tables, size well under 20,000 characters, "+ CSV"), Single workout (pick one; every set; same-day weigh-in; previous night's sleep; "Last time" lines), Custom (open the range sheet; step the dates; turn sections off; the text loses them). The size label under the Preview title matches the length shown in the full-text sheet.
  7. **Units.** Switch the display unit in Settings to the other unit and back: weights, volumes, distances and the CSV header follow.
- [ ] **Step 4: Delivery.**
  1. **Copy.** Tap the copy button, paste into any note field, confirm the text equals the preview.
  2. **Share into ChatGPT (the point of the app).** Tap "Share to ChatGPT", choose ChatGPT in the chooser, and check what arrives: **as message text or as an attachment, and whether it is truncated.** Send it with the starter question and let ChatGPT answer. **The owner confirms that ChatGPT read the weekly check-in correctly** (it quotes the right weight mean, workouts and adherence, does not treat `–` as zero, and does not mention a resting heart rate or MovingLife's numbers as Health Hub's). Record the result in the ledger.
  3. **If ChatGPT is missing from the chooser, ignores the text, or shows an error,** set `SHARE_BRIEFING_AS = 'file'` in `src/ui/screens/export/shareMode.ts`, rerun the checks in 2, and keep whichever mode ChatGPT reads correctly. If neither works, the supported path is Copy then paste; record that and tell the owner.
  4. **CSV.** Select Whole journey, tap "Share CSV", choose ChatGPT, and ask it a data question ("what was my average weekly weight change in the last 8 weeks?"); confirm it parses the file and treats empty cells as missing.
  5. **Cache cleanup.** `adb -s 59180DLCQ00B36 shell run-as com.jereenv.healthhub ls cache/health-hub-export` lists the CSV after sharing; leave the Export tab, return to it (mount sweep), run the command again: the folder is empty or absent.
  6. **No leakage.** `adb logcat -d -s ReactNativeJS:V | grep -ci "weigh-in\|Weekly check-in"` prints 0 (no briefing text in logs), and the log has no errors.
- [ ] **Step 5: Look.** Export matches the approved mockup in dark and light (`cmd uimode night yes|no`; restore the recorded mode afterwards): preset card, chips, input (also with the keyboard open: the bar must not cover the input), preview colours, bottom bar above the tab bar, the workout sheet, the range sheet. Loading skeleton on a cold start. Empty state after Settings → Wipe local data (then re-sync restores everything).
- [ ] **Step 6: Release build (no Metro, Hermes bytecode).** Stop Metro, then:
```bash
cd android && ./gradlew assembleRelease && cd ..
adb -s 59180DLCQ00B36 install -r android/app/build/outputs/apk/release/app-release.apk
```
Never use `expo run:android --variant release`. Expected: install succeeds as an update; the app opens without Metro; repeat steps 3.1, 3.2, 4.1 and 4.2 on the release build, including **an actual share of a weekly check-in into the ChatGPT app and the owner confirming ChatGPT read it correctly**; logcat has no `ReactNativeJS` errors. Leave the release build installed.
- [ ] **Step 7: Owner confirmations (pending list in the report).** The Export screen against the mockup; whether the briefing wording is what they want ChatGPT to see; the answer to the open questions below.
- [ ] **Step 8: Commit** fixes found in this task (including a flipped `SHARE_BRIEFING_AS`): "Fix issues found in export verification". Nothing is committed if there were none.

---

## Notes for later plans

- **Plan 5 (BLE).** When readings carry impedance, `computeReadings` yields `formula` origins and the briefing switches to the "Health Hub formula v{n}" wording and adds the water and muscle columns automatically (Task 37 covers it with an impedance variant). Nothing in export changes.
- **Plan 7 (Senssun cloud).** Historical readings upgraded with impedance change method partway through the journey; Ruling 4 already prints the one-time transition note.
- **Plan 8 (Today).** Reuse `buildBriefing`'s Body and Training sections if Today needs a "this week" digest; goal projection can start from the `Loss rate` figure.
- If the owner later wants a different `ACTION_SEND` shape (briefing text and CSV together), that needs a small native module (`ACTION_SEND_MULTIPLE` with `EXTRA_TEXT` and `EXTRA_STREAM`); it is deliberately not built here.

## Questions for the owner (recommended defaults are what this plan builds)

1. **Whole journey + CSV needs two shares** (Android sends text or a file per share; Ruling 12). Default: Share sends the briefing, a small "Share CSV" button sends the file. Alternative: drop the text for the journey and share the CSV alone.
2. **Custom range input** is a sheet with `−7 −1 +1 +7` day buttons (Ruling 15), not a calendar, to avoid another native library. Default: as built. Alternative: add a date-picker package (one more rebuild).
3. **Adherence** counts a scheduled session as done when Lyfta ticks it or a workout was logged that day (Ruling 6). Default: as built.

## Done when

- `npm run typecheck && npm run lint && npm run format:check && npm test` pass on `jereenv/export`.
- On the Pixel, the release build runs without Metro; the Export tab matches the approved mockup in dark and light; all five presets produce a briefing whose numbers match the app's own tabs; missing days read `–`, never 0; MovingLife's numbers are labelled as MovingLife's, watch checks are separate, the formula version is named; Copy puts the exact preview text on the clipboard; a weekly check-in has been shared into the ChatGPT app and the owner confirmed ChatGPT read it correctly; the optional journey CSV shares and parses; the cache folder is swept; no briefing content is in logs, fixtures use synthetic values only.
