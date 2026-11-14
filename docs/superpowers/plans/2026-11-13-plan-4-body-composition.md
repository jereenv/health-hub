# Plan 4 — Body Composition Implementation Plan (Tasks 29–36)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute every body metric the available inputs allow, with a versioned, citable engine; show them on the Body tab and the metric detail screen with range bars, Day/Week/Month charts, explainers and tips. It works today on the MovingLife history (weight plus MovingLife's body-fat %) and is ready, unchanged, for readings that carry impedance (Plans 5 and 7).

**Architecture:** Same layering as Plans 1–3. The engine and every screen model are pure TypeScript in `src/domain/body/`, tested in Node with synthetic inputs and published literature values. One small repository reads the stored readings. **Nothing derived is stored**: metrics are computed on read from `scale_reading`, `legacy_body_value` and the profile versions (Ruling 5). The Body screens follow the Activity screen's pattern (`src/ui/screens/activity/*`).

**Tech Stack:** Plan 3's stack. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-health-hub-design.md`, §1–§3, §5, §7, §8, §10, §11 (Body, Metric detail), §13, §17, §18. UI follows `docs/design/ui-guidelines.md`. The owner approved the **Body** and **Body fat** mockups (`Body.dc.html`, `BodyFat.dc.html`); screens must match them. The controller keeps a copy under the scratchpad `hh-mockups/project/` folder.

**Final repo path of this file:** `docs/superpowers/plans/2026-11-13-plan-4-body-composition.md`.

## Starting point (controller verifies before Task 29)

- Branch `jereenv/body-composition`, from `main` at `31b6885` (Plans 1, 2a, 2b and 3 merged).
- `MIGRATIONS.length === 7`. Plan 4 adds **no** migration.
- `app/(tabs)/body.tsx` re-exports the placeholder `src/ui/screens/placeholders/BodyScreen.tsx`.
- The owner has entered their birth date in Settings (height and sex are already there). If not, builders still work (synthetic data), but Task 36 cannot finish.
- The phone holds the Health Connect import: `scale_reading` rows with source `health_connect` (weight only, no impedance), `legacy_body_value` rows (`body_fat_pct`, origin `movinglife`), and `watch_body_fat` rows.

## Research (done while writing this plan)

Every equation below was checked against at least two independent sources (the paper's abstract or a secondary table, and openScale's `StandardImpedanceLib.kt`, a GPL-3.0 science-based BIA library whose **coefficients** we use; we copy no code). Builders must not "improve" a coefficient.

| Metric | Equation (H cm, W kg, Z ohm, age years, `male` = 1 or 0) | Citation |
|---|---|---|
| Fat-free mass (FFM), kg | male `−10.68 + 0.65·(H²/Z) + 0.26·W + 0.02·Z`; female `−9.53 + 0.69·(H²/Z) + 0.17·W + 0.02·Z` | Sun SS, Chumlea WC, Heymsfield SB, et al. *Am J Clin Nutr* 2003;77(2):331–340. doi:10.1093/ajcn/77.2.331. Developed in 1,829 adults against a multicomponent model; resistance only, no reactance. |
| Total body water (TBW), litres | male `1.20 + 0.45·(H²/Z) + 0.18·W`; female `3.75 + 0.45·(H²/Z) + 0.11·W`; kg = litres × 0.99513 (water density at 36.5 °C, as openScale does) | Sun et al. 2003 (same paper). |
| Skeletal muscle mass (SMM), kg | `0.401·(H²/Z) + 3.825·male − 0.071·age + 5.102` | Janssen I, Heymsfield SB, Baumgartner RN, Ross R. *J Appl Physiol* 2000;89(2):465–471. doi:10.1152/jappl.2000.89.2.465. MRI-referenced, 388 adults; r² 0.86, SEE 2.7 kg; tends to underestimate in Asians. |
| BMR with lean mass | `370 + 21.6·FFM` | Katch–McArdle, in McArdle, Katch & Katch, *Exercise Physiology*. |
| BMR without lean mass | male `10·W + 6.25·H − 5·age + 5`; female `… − 161` | Mifflin MD, St Jeor ST, et al. *Am J Clin Nutr* 1990;51(2):241–247. doi:10.1093/ajcn/51.2.241. |
| Body-fat ranges | Healthy / overweight / obese cut-offs by sex and age band (Ruling 10) | Gallagher D, et al. *Am J Clin Nutr* 2000;72(3):694–701. doi:10.1093/ajcn/72.3.694 (PubMed 10966886). Derived from WHO BMI limits, not from outcome data. |
| BMI cut-offs | WHO 18.5 / 25 / 30; Asian action points 23 and 27.5 | WHO Technical Report 894 (2000); WHO Expert Consultation, *Lancet* 2004;363:157–163. doi:10.1016/S0140-6736(03)15268-3. |
| Muscle share ranges | below 37 % (male) or 28 % (female) of body weight is low; below 31 % / 22 % is very low | Janssen I, Heymsfield SB, Ross R. *J Am Geriatr Soc* 2002;50(5):889–896. doi:10.1046/j.1532-5415.2002.50216.x. **The cut-points were read from secondary sources only; the controller checks them against the paper in Task 36 (Ruling 10).** |
| Loss-rate band | 0.5–1 % of body weight per week | Helms ER, et al. *J Int Soc Sports Nutr* 2014;11:20. |

**What the open-source scale libraries use (checked on GitHub).** openScale's `MiScaleLib.kt` (Xiaomi, reverse engineered) estimates body fat from an `H·9.058`-style lean-mass regression and visceral fat from weight, height and age only. It put the owner's visceral rating far above what MovingLife shows, so it is **not** used. openScale's `StandardImpedanceLib.kt` is the only library built from the published equations above, and it states that for a man near 180 cm "the scale should report an impedance of around 500 ± 100". openScale's `ChipseaBleLib.kt` is the Chipsea frame format (it has no impedance field), so it does not help with the Senssun offset. For bone mass, `StandardImpedanceLib` uses `0.057·FFM` (male) and `0.05·FFM` (female); we use the same heuristic and label it Rough. Visceral rating, protein share, metabolic age and health score have **no published foot-to-foot equation**; Ruling 8 defines them and says so in the app.

## Global Constraints

- Project root `/Users/jereenvalsson/personal/health-hub`. Expo SDK 57, React Native 0.86, React 19.2, TypeScript ~6.0.3, New Architecture.
- Files under `src/domain/` and `src/data/` must not import `react-native` or `expo-*`, except adapter files named `expo*.ts`. Tests run in plain Node (Jest 29, sql.js, `TZ=America/New_York`).
- Path alias `@/` → `src/`. Stored timestamps are ISO-8601 UTC strings; stored weights are kg; a `DateKey` is a `'YYYY-MM-DD'` day in the phone's zone. Weeks start Monday. Never pass non-ISO strings to `new Date`.
- **Private data.** The owner's weights, impedance values, MovingLife values and birth date never appear in the plan, code, test fixtures, commit messages or committed screenshots. Committed tests use the synthetic people in Task 29 and published literature values only. The calibration test (Task 35) reads the owner's reference file at run time, writes only to the git-ignored ledger, and contains no values itself.
- Design rules are Plan 2's: colours only from `src/ui/theme/tokens.ts`, Geist fonts, tabular figures, 44×44 touch targets, bottom sheets instead of `Modal`/`Alert`, skeletons instead of `ActivityIndicator`, no shadows, cards radius 20–24 with a 1px `line` border. Chart rules: 2px lines, rounded bar ends, one accent series per chart, an `accessibilityLabel` summarising the data. A status colour never appears without its text label.
- Before every commit, run `npm run typecheck && npm run lint && npm run format:check && npm test` and check `git diff --cached` for secrets and personal data. Commit messages are imperative, under 72 characters, no AI attribution, no Co-Authored-By. Commits are SSH-signed via 1Password; if signing fails, stop and report. Never bypass signing.
- Never stage `android/`, `.expo/`, `.superpowers/` or `node_modules/`. New root files need a `.gitignore` allowlist entry; prefer `src/`.
- Routes live in `app/` and only re-export a screen from `src/ui/screens/`. Never create `src/app/`.
- **Builders never run adb, never uninstall the app (SecureStore holds a key), never run `expo prebuild --clean`, never read the macOS Keychain.** Only the controller drives the phone (adb serial `59180DLCQ00B36`, app id `com.jereenv.healthhub`).
- Android build env: `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, `PATH` gains `$JAVA_HOME/bin:$ANDROID_HOME/platform-tools`.
- Scope: the owner says this app is "just an exporter" for them, so do not over-engineer. Plan only what makes the numbers correct and the approved screens work; rare edge cases are accepted. **Not in Plan 4:** BLE (Plan 5), export (Plan 6), Senssun cloud (Plan 7), Today page content and goal projection (Plan 8).

## Rulings (made while planning)

Each is "ruling — why — cost if wrong".

- **Ruling 1 — equations.** Sun 2003 for FFM and TBW, Janssen 2000 for skeletal muscle, Katch–McArdle (lean known) or Mifflin–St Jeor (lean unknown) for BMR, exactly as in the table above. *Why:* they are the only peer-reviewed equations that use resistance, height, weight, age and sex without reactance, which a foot scale does not measure. *Cost if wrong:* change constants in `formulas.ts`, bump `FORMULA_VERSION`; nothing is stored, so nothing needs migrating.
- **Ruling 2 — no fudge factors.** The published equations are applied unmodified. They were developed on hand-to-foot BIA, and the scale is foot-to-foot, so values will differ from MovingLife (spec §8 expects this; §18 item 6 sets ±4 percentage points for body fat and ±5 for water and muscle as the sanity bar). The explainers say "foot-to-foot scales differ from the whole-body method these equations were built on". *Why:* a hidden calibration offset would be an unpublished formula. *Cost if wrong:* if Task 35 shows a gap beyond tolerance that is consistent, the owner decides in Plan 5 whether to add a documented offset.
- **Ruling 3 — which scale number is the impedance.** The engine takes one number, `impedanceOhm`. The scale's final frame (cmd 0x82) carries three u16 values at payload offsets 5, 7 and 9 (the captured pre-checks are in the controller's `movinglife-reference.json`). **Provisional ruling: offset 9 is the BIA impedance.** *Evidence (qualitative; the numbers are private):* (a) the offset-5 value is so low that every equation above makes the fat-free mass larger than body weight, so it cannot be a whole-body resistance; (b) between the owner's two back-to-back weigh-ins only the offset-7 value changed, and MovingLife's body fat, water, muscle and lean mass were bit-identical while only visceral fat and body age moved, so offset 7 feeds those two numbers, not the composition; (c) with offset 9, our body fat and skeletal muscle land inside the §18 tolerance of MovingLife's and the value sits inside openScale's 500 ± 100 Ω expectation; with offset 7 the body fat is outside tolerance. *Calibration step:* Task 35 recomputes all three candidates and writes the comparison; the controller confirms or overturns this ruling in Task 36 and records the result for Plan 5. *Cost if wrong:* one constant in Plan 5's frame parser; the engine and screens do not change.
- **Ruling 4 — an unusable impedance is ignored, not trusted.** Impedance counts only when `200 ≤ Z ≤ 1200` Ω **and** the resulting body fat is between 3 % and 60 %. Otherwise the reading is treated as having no impedance (it falls back to legacy body fat if any, else to BMI and Mifflin BMR). *Why:* a bad contact on the pads must not put a physically impossible number in the export. *Cost:* none.
- **Ruling 5 — metrics are computed on read; no `body_metrics` table; no "Recompute body metrics" row (owner-confirmed 2026-11-13).** Spec §7 sketches a stored `body_metrics` table and §16 puts "Recompute body metrics" in Plan 8. With a few hundred readings, computing in memory takes microseconds, a profile edit or a `FORMULA_VERSION` bump applies instantly everywhere, and there is nothing to go stale. `FORMULA_VERSION` still exists (shown in Settings → About and used by Plan 6's export). *Cost if wrong:* a stored table is only a cache of `computeReadings`; Plan 6 or 8 can add it without changing callers.
- **Ruling 6 — what a legacy reading gets (owner-confirmed 2026-11-13: impedance-only metrics are never shown for legacy readings).** A reading with no usable impedance but with MovingLife's body fat gets: weight, BMI, body fat % (origin `movinglife`), fat mass and lean mass (origin `movinglife_derived`), BMR by Katch–McArdle from that lean mass (origin `movinglife_derived`). A reading with neither gets weight, BMI and Mifflin BMR. Water, muscle, bone, protein, visceral, metabolic age and health score need impedance and are **absent** (not shown), never filled from MovingLife-derived numbers. *Why:* honest provenance (§2 anti-goals).
- **Ruling 7 — mixing methods.** Each point is `solid` (origin `scale` or `formula`) or `hollow` (origin `movinglife` or `movinglife_derived`). In charts: hollow points are drawn hollow; **the line never connects points of different methods** (it restarts at the first point of the new method); the 7-day average uses only points of the same method; the Change/Average/Lowest/Highest stats use only the points of the same method as the latest point; in a Week or Month bucket that holds both, only the solid days are averaged and the point is solid (a rare, one-time transition). A small legend names the two methods when both appear. *Why:* spec §10 and the anti-goal "fake trend jumps". *Cost:* the transition bucket drops a few legacy days from its average. Accepted.
- **Ruling 8 — Rough metrics are our own heuristics, labelled as such.** All need impedance (Ruling 6), are whole numbers (or one decimal where noted), and the explainer says "A rough estimate. No published equation exists for a foot scale."
  - **Bone mass** (kg): `0.057·FFM` male, `0.05·FFM` female (openScale heuristic).
  - **Protein share** (% of body weight): `max(0, FFM − TBW_kg − bone) / W × 100`, one decimal.
  - **Visceral rating:** `clamp(round(0.8·(BF − BF_ref) + 0.1·max(0, age − 30)), 1, 30)` with `BF_ref` 15.5 (male) or 25.5 (female). Whole number. *Why this shape:* visceral fat tracks total body fat, rises with age and is lower for the same body fat in women; the slope and reference were set so a mid-20s man at about 25 % body fat reads high single digits, which is where vendor apps put him. Invented, hence Rough.
  - **Metabolic age:** `clamp(round(age + 0.5·(BF − mid)), 18, 80)` where `mid` is the midpoint of the Gallagher healthy band for the person's sex and age band. Whole number.
  - **Health score** (0–100): `clamp(round(100 − 4·bfExcess − 5·bmiExcess − 3·visceralExcess), 0, 100)`; `bfExcess` is the distance outside the Gallagher healthy band, `bmiExcess` the distance outside the BMI healthy band of the chosen cut-off set, `visceralExcess = max(0, visceral − 9)`.
  - *Cost if wrong:* these are for reference only (their cards say "For reference", no status colour, no tip). Change the constants and bump `FORMULA_VERSION`.
- **Ruling 9 — profile at measurement, and missing fields.** Each reading uses the profile version in effect at its time (`profileAt`, same rule as `ProfileRepository.getAt`: latest version at or before the reading, else the earliest). Age is whole years on the reading's local day. A metric whose inputs are missing is simply absent. If height, sex or birth date is missing, the Body tab shows a card "Add your height, birth date and sex in Settings to unlock BMI and ranges" with an Open Settings action. *Why:* the owner has not entered the birth date yet; the app must not crash or invent one.
- **Ruling 10 — ranges.**
  - *Body fat (Gallagher 2000):* four bands by sex and age band: Low (below the first number), Healthy, Slightly high, High. Cut-offs `[healthyFrom, slightlyHighFrom, highFrom]`: male 20–39 `[8, 20, 25]`, 40–59 `[11, 22, 28]`, 60–79 `[13, 25, 30]`; female 20–39 `[21, 33, 39]`, 40–59 `[23, 34, 40]`, 60–79 `[24, 36, 42]`. Ages under 20 use the 20–39 row; over 79 the 60–79 row. The male 20–39 row equals the approved mockup (8 / 20 / 25). *Risk:* the cells are the commonly reproduced values of the paper's Table 4, not read from the paper itself; Task 36 asks the controller to confirm them.
  - *BMI:* Low below 18.5; Healthy 18.5 up to 25 (`who`) or 23 (`who_asian`); Slightly high up to 30 (`who`) or 27.5 (`who_asian`); High above. Weight's range bar is the same bands converted with `kg = BMI·(H/100)²`.
  - *Muscle share (Janssen 2002, applied to Janssen 2000's estimate):* male Very low below 31, Low 31–37, Healthy 37 and up; female 22 / 28. Statuses `low`, `low`, `ok`.
  - *Water % (vendor convention):* male Low below 50, Healthy 50–65, High above; female 45 / 60.
  - *Protein %:* Low below 16, Healthy 16–20, High above 20 (vendor convention).
  - *Visceral rating (vendor convention, as on Omron monitors):* Healthy 1–9, High 10–14, Very high 15 and up.
  - **No range, no status colour:** fat mass, lean mass, BMR, bone mass, metabolic age, health score. (Bone mass is a fixed fraction of FFM here, so a range would restate FFM, not add information.) Their cards show a neutral descriptor: "Estimate", "Daily baseline", "For reference".
  - Every range shows its source line, and Rough ranges say "conventional vendor range".
- **Ruling 11 — chart windows and axes.** Day shows the last 30 days, Week the last 26 weeks, Month the last 24 months, each ending with the slot that holds today. The x axis has **one slot per calendar day / week / month**, with empty slots as gaps, so spacing is true to time (Plan 3's charts spaced by index). The line bridges empty slots (a missed weigh-in does not break the trend) but never bridges a method change (Ruling 7). The spec's "swipe back through all history" is not built: the owner's history starts in May 2026 and fits inside the Month window. *Cost if wrong:* a wider window is one constant.
- **Ruling 12 — day point rule.** For each metric, a day's point is the **first reading of that local day that has a value for the metric** (spec §7). Week and Month points are the mean of that bucket's day points. All readings stay available in the weigh-in history list.
- **Ruling 13 — watch check.** `watch_body_fat` rows appear only on the body-fat chart, only in the Day range, as a separate dotted line with its own markers and a legend entry "Watch check". Several checks on one day are averaged. They never enter any scale series, stat or tip.
- **Ruling 14 — refresh.** Screens re-read when `dataVersion` changes (sync, wipe) **and** whenever the Body tab regains focus, so a profile edit in Settings shows immediately. The `SyncCoordinator` is not involved: nothing is written.
- **Ruling 15 — weekly loss rate.** Least-squares slope of the weight day points of the last 28 days (including today), needing at least 3 points spanning at least 14 days. `kgPerWeek = −slope × 7`; `percentPerWeek = kgPerWeek / mean(weights) × 100`. Positive means losing. Status: below 0 "Gaining" (`high`), 0 to under 0.5 "Slow" (`low`), 0.5 to 1 "Healthy" (`ok`), above 1 "Fast" (`high`). A rate under 0.05 % in either direction reads "Steady" with no status colour.
- **Ruling 16 — calibration is local and opt-in.** `calibration.local.test.ts` runs only when `HH_CALIBRATION=1` and the reference file exists; otherwise the whole `describe` is skipped. It contains no values. Differences land in the git-ignored ledger.
- **Ruling 17 — routes.** `app/(tabs)/body.tsx` becomes the folder `app/(tabs)/body/` with a Stack layout like `workouts/`: `index.tsx` (Body), `[metric].tsx` (detail, route `/body/body_fat_pct`), `history.tsx` (all weigh-ins). The tab entry name `body` is unchanged.

## Review Focus

1. **Equations and coefficients.** Every coefficient equals the Research table; the golden-value tests catch a change. → Task 29.
2. **Provenance.** No MovingLife number is ever labelled Health Hub's; absent metrics are absent, never zero or filled. → Tasks 29, 31, 33.
3. **Method mixing.** Hollow points, no joined lines, same-method stats. → Tasks 31, 32.
4. **Day boundaries and DST.** Day points near midnight and across 2026-11-01. → Task 31.
5. **Missing profile.** No crash, no invented values; the banner shows. → Tasks 29, 33.
6. **Watch separation.** Watch values only in the dotted overlay. → Tasks 31, 32.
7. **Status always has text.** Range bar, chips and cards never rely on colour alone. → Tasks 32–34.
8. **Calibration hygiene.** Nothing private is committed. → Task 35 and the final diff.

## Conventions

- **Unit test steps.** Run `npx jest <path>`. Before implementing, expect FAIL (module or export missing); after, PASS.
- **Commit step.** Run the pre-commit gate, `git add <the task's files>`, check `git diff --cached`, then `git commit -m "<message>"`.
- **sql.js tests.** Use the harness in `src/data/healthconnect/HealthConnectRepository.test.ts` (open an in-memory database, `migrate(db, MIGRATIONS)`).
- **Synthetic people** (used by every test; the expected values below were computed with a separate throwaway script from the published equations, so they check the implementation rather than restate it):
  - **Person M:** male, height 175 cm, weight 80 kg, age 30, impedance 500 Ω, legacy body fat 20 %, `who` cut-offs.
  - **Person F:** female, height 165 cm, weight 62 kg, age 35, impedance 600 Ω, legacy body fat 30 %, `who` cut-offs.
- **On-device JS check** (controller only): `adb -s 59180DLCQ00B36 reverse tcp:8081 tcp:8081`, start `npx expo start --dev-client --port 8081` in the background, launch `am start -n com.jereenv.healthhub/.MainActivity`, screenshot with `exec-out screencap -p` into the scratchpad `shots/` folder, `uiautomator dump` for tap targets, and check `logcat -d -s ReactNativeJS:V`. Expected: no red error screen and no `ReactNativeJS` errors.
- **SDD ledger.** The controller records outcomes in `.superpowers/sdd/2026-11-13-plan-4-body-composition/` (git-ignored).

---

### Task 29: The engine — types, formulas, `computeBodyMetrics`

**Files:**
- Create: `src/domain/body/types.ts`, `formulas.ts`, `computeBodyMetrics.ts`, `sources.ts`
- Test: `src/domain/body/formulas.test.ts`, `computeBodyMetrics.test.ts`

**Interfaces (produces):**
```ts
// types.ts
export type MetricId = 'weight' | 'bmi' | 'body_fat_pct' | 'fat_mass_kg' | 'lean_mass_kg' | 'water_pct' | 'muscle_pct'
  | 'bmr_kcal' | 'visceral_rating' | 'bone_mass_kg' | 'protein_pct' | 'metabolic_age' | 'health_score';
export const METRIC_IDS: readonly MetricId[];          // exactly the 13 above, in this order
export type Tier = 'measured' | 'exact' | 'estimated' | 'rough';
/** scale: measured by the scale. formula: our engine. movinglife: MovingLife's own number. movinglife_derived: our maths on MovingLife's body fat. */
export type Origin = 'scale' | 'formula' | 'movinglife' | 'movinglife_derived';
export interface MetricValue { value: number; tier: Tier; origin: Origin }
export type BodyMetrics = Partial<Record<MetricId, MetricValue>>;
export interface BodyInput {
  weightKg: number; impedanceOhm: number | null; legacyBodyFatPct: number | null;
  heightCm: number | null; ageYears: number | null; sex: Sex | null; bmiCutoffs: BmiCutoffs;
}
export interface MetricMeta { label: string; unit: '' | '%' | 'kg' | 'kcal' | 'yrs'; kind: 'mass' | 'percent' | 'index' | 'energy' | 'rating' | 'age'; decimals: number }
export const METRIC_META: Readonly<Record<MetricId, MetricMeta>>;   // labels: Weight, BMI, Body fat, Fat mass, Lean mass, Body water, Muscle, BMR, Visceral fat, Bone mass, Protein, Metabolic age, Health score
export function isLegacyOrigin(origin: Origin): boolean;            // movinglife or movinglife_derived
// formulas.ts — pure; every function documents its citation in a doc comment
export const FORMULA_VERSION = 1;
export const IMPEDANCE_RANGE_OHM: readonly [number, number];        // [200, 1200]
export const BODY_FAT_PLAUSIBLE_PCT: readonly [number, number];     // [3, 60]
export function bmi(weightKg: number, heightCm: number): number;
export function fatFreeMassSun(i: { sex: Sex; heightCm: number; weightKg: number; impedanceOhm: number }): number;
export function totalBodyWaterKgSun(i: { sex: Sex; heightCm: number; weightKg: number; impedanceOhm: number }): number;   // litres × 0.99513
export function skeletalMuscleKgJanssen(i: { sex: Sex; heightCm: number; age: number; impedanceOhm: number }): number;
export function bmrKatchMcArdle(leanMassKg: number): number;
export function bmrMifflinStJeor(i: { sex: Sex; weightKg: number; heightCm: number; age: number }): number;
export function boneMassKg(i: { sex: Sex; fatFreeMassKg: number }): number;
export function proteinPct(i: { fatFreeMassKg: number; waterKg: number; boneKg: number; weightKg: number }): number;
export function visceralRating(i: { sex: Sex; age: number; bodyFatPct: number }): number;
export function metabolicAge(i: { sex: Sex; age: number; bodyFatPct: number }): number;
export function healthScore(i: { sex: Sex; age: number; bodyFatPct: number; bmi: number; visceral: number; bmiCutoffs: BmiCutoffs }): number;
export function impedanceIsUsable(i: { sex: Sex; heightCm: number; weightKg: number; impedanceOhm: number }): boolean;   // Ruling 4
export function bodyFatBand(sex: Sex, age: number): { healthyFrom: number; slightlyHighFrom: number; highFrom: number };  // Gallagher row, Ruling 10
export function bmiHealthyBand(cutoffs: BmiCutoffs): { low: number; high: number };  // who 18.5–25, who_asian 18.5–23
// sources.ts
export interface FormulaSource { id: string; citation: string; link: string }
export const FORMULA_SOURCES: readonly FormulaSource[];   // ids: sun2003, janssen2000, katchMcArdle, mifflin1990, gallagher2000, who2004, janssen2002, helms2014, openscale, vendor
// computeBodyMetrics.ts
export function computeBodyMetrics(input: BodyInput): BodyMetrics;
```

**Algorithm (`computeBodyMetrics`).** Absent inputs mean absent metrics; never throw, never return NaN.
1. `weight`: tier `measured`, origin `scale`. `bmi` (needs height): tier `exact`, origin `formula`.
2. Decide the lean-mass source. Impedance route: needs sex, height, impedance and `impedanceIsUsable`. Then `ffm = fatFreeMassSun`, `fatMass = W − ffm`, `body_fat_pct = fatMass / W × 100`, origin `formula`, tier `estimated`. Legacy route (no usable impedance, `legacyBodyFatPct` strictly between 0 and 100): `body_fat_pct` origin `movinglife`, `fat_mass_kg = W × bf / 100`, `lean_mass_kg = W − fat` both origin `movinglife_derived`, tier `estimated`. On the impedance route `fat_mass_kg` and `lean_mass_kg` have origin `formula`.
3. `bmr_kcal`: `bmrKatchMcArdle(lean)` when a lean mass exists (origin follows the lean mass); otherwise `bmrMifflinStJeor` when sex, height and age exist (origin `formula`). Tier `estimated`.
4. Impedance route only, each needing its inputs: `water_pct = TBW_kg / W × 100` and `muscle_pct = SMM / W × 100` (tier `estimated`, needs age for muscle). Rough tier: `bone_mass_kg`, `protein_pct` (one decimal), and, **with age**, `visceral_rating`, `metabolic_age`, and `health_score` (needs bmi, visceral and age). Rough values use rounding exactly as Ruling 8 says: whole numbers for visceral, metabolic age and health score; bone and protein are left unrounded in the engine (display rounds).
5. Values are stored unrounded except the three whole-number metrics.

- [ ] **Step 1: Write the failing tests**

```ts
// formulas.test.ts — expected values from the equations applied to the synthetic people (toBeCloseTo, 2 digits unless stated)
test('Person M: FFM 59.93, TBW 42.95 kg, SMM 31.36 kg from the Sun and Janssen equations');
test('Person F: FFM 44.32, TBW 30.84 kg, SMM 20.81 kg');
test('bmi of M is 26.12 and of F is 22.77');
test('Katch–McArdle of FFM 59.93 is 1664.5 kcal; of 64 kg lean is 1752.4');
test('Mifflin–St Jeor: M 1748.75, F 1315.25');
test('bone mass is 0.057 of FFM for males and 0.05 for females: M 3.42, F 2.22');
test('protein share: M 16.96, F 18.17 (one decimal comparison)');
test('visceral rating: M 8, F 3; clamps at 1 for a very lean person and at 30 for an extreme one; age adds only beyond 30');
test('metabolic age: M 36, F 36; clamps at 18 and 80');
test('health score: M 74, F 100; never below 0 or above 100');
test('bodyFatBand returns the Gallagher cut-offs for each sex and age band, using the 20–39 row under 20 and the 60–79 row over 79');
test('bmiHealthyBand is 18.5–25 for who and 18.5–23 for who_asian');
test('impedanceIsUsable rejects 150 and 1300 ohm, and a value that gives body fat under 3 or over 60');
test('FORMULA_VERSION golden guard: the full metric set of Person M is pinned');   // toMatchInlineSnapshot of rounded values; comment: "if this fails because a coefficient changed, bump FORMULA_VERSION"
test('FORMULA_SOURCES has the ten ids and every entry has a citation and a link');
// computeBodyMetrics.test.ts
test('Person M with impedance returns all 13 metrics; weight is measured/scale, bmi exact, FFM-based ones estimated/formula, the last five rough');
test('Person M body fat is 25.08 and lean mass 59.93 with origin formula');
test('legacy only (M, impedance null, bf 20): body fat 20 origin movinglife, fat 16 and lean 64 origin movinglife_derived, BMR 1752.4 origin movinglife_derived, no water, muscle, bone, protein, visceral, age or score');
test('no impedance and no body fat: weight, bmi and Mifflin BMR only');
test('an unusable impedance falls back to the legacy value, and to BMI plus Mifflin when there is none');
test('impedance wins when both impedance and a legacy value exist');
test('missing height removes bmi, FFM and everything built on them; missing age removes muscle, Mifflin, visceral, metabolic age and health score; missing sex removes everything but weight');
test('a legacy body fat of 0, 100, NaN or negative is ignored');
test('output never contains NaN or Infinity for zero or negative weight');   // such input returns {}
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Then the full gate.
- [ ] **Step 3: Commit**: `git add src/domain/body` → "Add the body composition engine".

---

### Task 30: Ranges, statuses, tips, explainers and formatting

**Files:**
- Create: `src/domain/body/ranges.ts`, `tips.ts`, `explainers.ts`, `formatMetric.ts`
- Test: `ranges.test.ts`, `tips.test.ts`, `explainers.test.ts`, `formatMetric.test.ts`

**Interfaces (produces):**
```ts
// ranges.ts
export type BandStatus = 'low' | 'ok' | 'high';
export interface RangeBand { label: string; from: number | null; to: number | null; status: BandStatus }   // [from, to), null = open
export interface MetricRange { bands: readonly RangeBand[]; scaleMin: number; scaleMax: number; source: string; sourceId: string }
export interface RangeContext { sex: Sex; ageYears: number | null; heightCm: number | null; bmiCutoffs: BmiCutoffs }
export function rangeFor(metric: MetricId, ctx: RangeContext): MetricRange | null;   // null for metrics without a range (Ruling 10) or when inputs are missing
export interface Classified { band: RangeBand; statusLabel: string }
export function classify(range: MetricRange, value: number): Classified;              // value on a boundary belongs to the upper band
export const NEUTRAL_DESCRIPTOR: Readonly<Partial<Record<MetricId, string>>>;         // fat_mass_kg 'Estimate', lean_mass_kg 'Estimate', bmr_kcal 'Daily baseline', bone_mass_kg 'Estimate', metabolic_age 'For reference', health_score 'For reference'
// tips.ts — rule-based, never generated
export interface TipInput { metric: MetricId; band: BandStatus | null; bandLabel: string | null; change30: number | null; goalWeightKg: number | null; latestWeightKg: number | null }
export function tipFor(input: TipInput): string | null;
// explainers.ts
export interface Explainer { what: string; moves: string; reliability: string; formulaSourceIds: readonly string[] }
export const EXPLAINERS: Readonly<Record<MetricId, Explainer>>;
export function explainerSources(metric: MetricId, origin: Origin): readonly FormulaSource[];
// formatMetric.ts
export function formatMetricValue(metric: MetricId, value: number, unit: WeightUnit): { value: string; unit: string };   // masses use the weight unit; '1,812' kcal; visceral/metabolic age/score whole numbers; percent and BMI one decimal
export function formatMetricChange(metric: MetricId, change: number, unit: WeightUnit): string;                          // signed, "−1.3 pts" for percent metrics, "−2.4 kg" for masses, never "-0"
export const TIER_LABEL: Readonly<Record<Tier, string>>;                                                                  // Measured, Exact, Estimated, Rough
export const ORIGIN_LABEL: Readonly<Record<Origin, string | null>>;                                                       // scale/formula null; movinglife 'MovingLife'; movinglife_derived 'From MovingLife body fat'
```

**Range data** are exactly the numbers in Ruling 10. Scale bounds (bar domain): body fat 4–45; BMI 15–40; weight = BMI 15–40 converted; muscle male 20–55, female 15–45; water 35–75; protein 8–30; visceral 1–20. Band labels: body fat and BMI `Low`, `Healthy`, `Slightly high`, `High` (status `low`, `ok`, `high`, `high`); muscle `Very low`, `Low`, `Healthy`; water and protein `Low`, `Healthy`, `High`; visceral `Healthy`, `High`, `Very high` (`ok`, `high`, `high`). A BMI band that would start below the scale minimum is clamped for drawing only. `source` strings: "Gallagher et al., 2000", "WHO (standard cut-offs)" or "WHO (Asian action points)", "Janssen et al., 2002", "conventional vendor range".

**Tip rules** (the only tips; first match wins; return null otherwise; `change30` is the change over the last 30 days within the same method, negative means down; "flat" is |change| below 0.3 for percent metrics and 0.3 kg for weight):

| Metric | Condition | Tip |
|---|---|---|
| `body_fat_pct` | band `high`, `change30 ≤ −0.3` | "Down {x} points in 30 days, a steady pace. Keep protein high so the loss stays mostly fat." |
| `body_fat_pct` | band `high`, otherwise | "Body fat is above your range. A modest calorie deficit with regular lifting is the reliable route." |
| `body_fat_pct` | band `low` | "Body fat is below your range. Make sure you are eating enough to train and recover." |
| `muscle_pct` | band `low` | "Muscle share is below the usual range. Lifting and enough protein are the levers." |
| `muscle_pct` | `change30 ≤ −1` | "Muscle share is falling. Keep lifting and protein up while you lose weight." |
| `water_pct` | band `low` | "A low reading is often hydration. Drink water, then weigh again in similar conditions." |
| `water_pct` | band `high` | "A high reading is usually salt or a recent big drink. Compare with your 7-day trend." |
| `visceral_rating` | band is `high` | "Visceral fat falls mainly as your overall body fat falls." |
| `protein_pct` | band `low` | "Protein share is below the usual range. Check your daily protein intake." |
| `bmi` | band `high` | "BMI does not separate muscle from fat. Check body fat before drawing conclusions." |
| `weight` | goal set, latest weight above goal, `change30 ≥ 0.5` | "Weight is up {x} in 30 days while your goal is lower. Check the week-to-week trend." |

`tipFor` stays pure: it returns the copy with the literal placeholder `{x}` where a number belongs, and the caller (Task 34) replaces it with the absolute 30-day change, one decimal (body fat: points; weight: the display unit). No tip when `band` is null or `ok`, except the `change30` rows (muscle falling, weight up) and the body-fat "down" row's neighbours as listed.

**Explainer content** (2–3 plain sentences each for `what`, `moves`, `reliability`; no medical claims; builder writes the copy). Required facts per entry: `weight` measured, moves with water and food, "trust the 7-day trend over any single reading"; `bmi` exact arithmetic, ignores muscle; `body_fat_pct` "The share of your weight that is fat" (mockup copy: the scale sends a tiny current through your legs; the app turns how easily it passes into an estimate using your height, age and sex; expect within about 3 to 5 points of a lab scan), with the foot-to-foot caveat of Ruling 2; MovingLife origin entries say the value is MovingLife's own and is **not** comparable to Health Hub's formula; `fat_mass_kg`/`lean_mass_kg` derived from body fat; `water_pct`, `muscle_pct` (say "skeletal muscle"); `bmr_kcal` names Katch–McArdle or Mifflin–St Jeor and "not your calorie target"; the five Rough metrics state "A rough estimate. No published equation exists for a foot scale." `formulaSourceIds` lists the ids from `FORMULA_SOURCES` each metric uses (e.g. `body_fat_pct` → `['sun2003','gallagher2000']`; `bmi` → `['who2004']`; `bmr_kcal` → `['katchMcArdle','mifflin1990']`; `muscle_pct` → `['janssen2000','janssen2002']`; `water_pct` → `['sun2003','vendor']`; rough metrics → `['openscale','vendor']` as relevant). `explainerSources(metric, 'movinglife' | 'movinglife_derived')` returns an empty list for `body_fat_pct` and the derived-origin ones also omit Sun.

- [ ] **Step 1: Write the failing tests**

```ts
// ranges.test.ts
test('body fat for male 26 has bands 8 / 20 / 25 and source Gallagher');                         // the approved mockup values
test('body fat bands switch at ages 40 and 60 and for sex, using the 20–39 row under 20');
test('classify puts a boundary value in the upper band: 20 is Slightly high, 8 is Healthy, 25 is High');
test('BMI bands are 18.5 / 25 / 30 for who and 18.5 / 23 / 27.5 for who_asian; BMI 26.1 is Slightly high for who and High for who_asian');
test('weight bands are the BMI bands converted with the owner height');
test('muscle, water, protein and visceral bands match Ruling 10 for each sex');
test('metrics without a range return null, and a missing sex, age or height returns null where needed');
test('every band list is contiguous, ascending and covers the whole scale');
// tips.test.ts
test('each row of the tip table fires on its condition and returns the exact copy');
test('no tip for healthy values, for null band, or for rough metrics other than visceral and protein');
test('first matching rule wins when two apply');
// explainers.test.ts
test('every metric has non-empty what, moves and reliability');
test('every formulaSourceId exists in FORMULA_SOURCES');
test('every estimated metric names a source and every rough metric says it is a rough estimate');
test('movinglife origin returns no formula sources for body fat');
// formatMetric.test.ts
test('masses follow the weight unit, percent and BMI show one decimal, BMR has a thousands separator, whole-number metrics show no decimal');
test('changes are signed with a true minus and never show -0');
test('TIER_LABEL and ORIGIN_LABEL text');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Then the full gate.
- [ ] **Step 3: Commit**: `git add src/domain/body` → "Add body ranges, tips and explainers".

---

### Task 31: Readings, series and the data hook

**Files:**
- Create: `src/data/body/BodyRepository.ts`, `src/domain/body/readings.ts`, `series.ts`, `lossRate.ts`, `fatVsLean.ts`, `src/ui/data/useBodyData.ts`
- Modify: `src/data/profile/ProfileRepository.ts` (add `listVersions`), `src/bootstrap/container.ts` (add `body`)
- Test: `src/data/body/BodyRepository.test.ts`, `ProfileRepository.test.ts` (extend), `src/domain/body/readings.test.ts`, `series.test.ts`, `lossRate.test.ts`, `fatVsLean.test.ts`

**Interfaces (produces):**
```ts
// BodyRepository.ts
export interface BodyReading { id: number; measuredAt: string; weightKg: number; impedanceOhm: number | null; source: string; legacyBodyFatPct: number | null }
export interface BodyRepository { listReadings(): Promise<BodyReading[]> }          // ascending by measured_at then id; body fat from legacy_body_value metric 'body_fat_pct' (LEFT JOIN)
export function createSqliteBodyRepository(db: SqlDatabase): BodyRepository;
// ProfileRepository gains:  listVersions(): Promise<Profile[]>                     // ascending by effective_from, id
// readings.ts
export function profileAt(versions: readonly Profile[], iso: string): Profile | null;   // same rule as ProfileRepository.getAt
export interface ReadingMetrics { id: number; measuredAt: string; date: DateKey; metrics: BodyMetrics }
export function computeReadings(readings: readonly BodyReading[], versions: readonly Profile[]): ReadingMetrics[];   // ascending; age via ageOn(birthDate, date)
export function missingProfileFields(profile: Profile | null): Array<'height' | 'birthDate' | 'sex'>;
// series.ts
export interface DayPoint { date: DateKey; value: number; origin: Origin; readingId: number }
export function dayPoints(readings: readonly ReadingMetrics[], metric: MetricId): DayPoint[];    // Ruling 12
export const BODY_SPAN: Readonly<Record<RangeKind, number>>;                                    // { day: 30, week: 26, month: 24 }
export interface SlotPoint { start: DateKey; value: number | null; hollow: boolean; count: number }
export interface SeriesStats { average: number; lowest: number; highest: number; change: number | null }
export interface MetricSeries {
  slots: SlotPoint[];                    // BODY_SPAN[range] slots ending with the one holding today
  average7: Array<number | null> | null; // aligned to slots, Day range only
  stats: SeriesStats | null;             // Ruling 7: points of the latest point's method inside the visible span
  current: DayPoint | null;              // latest day point overall
  mixed: boolean;                        // visible span holds both solid and hollow points
}
export function buildMetricSeries(days: readonly DayPoint[], range: RangeKind, today: DateKey): MetricSeries;
export function change30(days: readonly DayPoint[], today: DateKey): number | null;   // last − first of the latest method's points in the last 30 days; needs 2 points at least 7 days apart
export function watchByDay(checks: readonly WatchBodyFat[], slots: readonly SlotPoint[]): Array<number | null>;   // Day range: mean per local day aligned to slots
// lossRate.ts
export interface LossRate { kgPerWeek: number; percentPerWeek: number; status: 'gaining' | 'steady' | 'slow' | 'healthy' | 'fast' }
export function weeklyLossRate(weightDays: readonly DayPoint[], today: DateKey): LossRate | null;   // Ruling 15
// fatVsLean.ts
export interface FatVsLean { from: DateKey; to: DateKey; fatChangeKg: number; leanChangeKg: number; weightChangeKg: number; fatShareOfLoss: number | null; hollow: boolean }
export function fatVsLean(fat: readonly DayPoint[], lean: readonly DayPoint[], today: DateKey): FatVsLean | null;
// useBodyData.ts
export interface BodyData { readings: BodyReading[]; versions: Profile[]; watch: WatchBodyFat[] }
export function useBodyData(): AsyncState<BodyData>;     // re-read on dataVersion and on screen focus (Ruling 14; expo-router's useFocusEffect bumps a local counter)
```

**Algorithm details.**
- `buildMetricSeries` slots: day = one per calendar day from `today − 29` to `today`; week = 26 Monday starts ending with today's week; month = 24 first-of-month starts ending with today's month. Day slot value is that day's point (hollow when its origin is legacy). Week/Month slot: if any solid point exists in the bucket, the mean of the solid points and `hollow = false`; otherwise the mean of all and `hollow = true`; `count` is the number of day points used.
- `average7[i]` exists only where slot `i` has a value: the mean of day points dated `slot.start − 6` through `slot.start` with the same hollow flag as the slot; otherwise null.
- `stats`: day points whose date lies in the visible span (first slot start through today) **and** whose hollow flag equals the latest in-span point's; `change` is last minus first of those points, null with fewer than two.
- `change30` takes the same-method points of the last 30 days.
- `fatVsLean`: dates present in both series within the last 30 days, same method as the latest; first and last such date at least 7 days apart; `fatShareOfLoss = clamp(−fatChange / −weightChange, 0, 1)` only when `weightChange ≤ −0.5`, else null.

- [ ] **Step 1: Write the failing tests**

```ts
// BodyRepository.test.ts (sql.js, after migrate)
test('listReadings returns health_connect and ble readings ascending with impedance');
test('body fat comes from legacy_body_value metric body_fat_pct and is null when absent');
test('another legacy metric is not read as body fat');
// ProfileRepository.test.ts
test('listVersions returns every version ascending');
// readings.test.ts
test('profileAt picks the latest version at or before the reading, else the earliest, else null');
test('age is computed on the reading day: the day before a birthday is one year younger');
test('computeReadings applies the profile in effect at each reading');
test('a reading near local midnight gets the local date, including across the 2026-11-01 DST change');
test('missingProfileFields lists height, birthDate and sex only when null');
test('with no profile at all every reading still yields weight');
// series.test.ts
test('dayPoints takes the first reading of the local day that has the metric');
test('dayPoints skips days where the metric is absent');
test('day range has 30 slots ending today, with null for days without a reading');
test('week range has 26 Monday-start slots and month range 24 month-start slots');
test('a week bucket averages its day points');
test('a bucket with solid and hollow points averages only the solid ones and is solid');
test('average7 averages the previous 7 calendar days, same method only, and is null on empty slots');
test('average7 is null for week and month');
test('stats use only the latest method and the visible span; change is null with one point');
test('mixed is true only when both methods appear in the visible span');
test('current is the latest point even when it is outside the visible span');
test('change30 needs two points at least 7 days apart and ignores the other method');
test('watchByDay averages several checks on one day and aligns to the slots');
test('empty input gives finite, empty results');
// lossRate.test.ts
test('a steady 0.7 kg per week loss over 28 days gives 0.7 kg/week and the matching percent, status healthy');
test('fewer than 3 points or under 14 days of span gives null');
test('a gain gives a negative rate and status gaining; under 0.05 percent either way is steady');
test('slow below 0.5 percent and fast above 1 percent');
// fatVsLean.test.ts
test('fat down 1.7 and lean down 0.7 gives a share of about 0.71');
test('share is null when weight change is above −0.5 kg');
test('lean gain with fat loss clamps the share at 1');
test('fewer than 2 shared dates or under 7 days apart gives null');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Wire `body` into the container (`createSqliteBodyRepository(db)`); no UI yet. Full gate.
- [ ] **Step 3: Commit**: `git add src/data src/domain src/ui/data src/bootstrap` → "Add body readings, series and loss rate models".

---

### Task 32: Chart extensions and shared body components

**Files:**
- Modify: `src/ui/charts/geometry.ts`, `src/ui/charts/TrendChart.tsx`
- Create: `src/ui/screens/body/chartData.ts`, `TierBadge.tsx`, `OriginChip.tsx`, `RangeBar.tsx`, `rangeBarLayout.ts`, `MetricRow.tsx`, `BodyTrendChart.tsx`
- Test: `src/ui/charts/geometry.test.ts` (extend), `src/ui/screens/body/chartData.test.ts`, `rangeBarLayout.test.ts`

**Interfaces (produces):**
```ts
// geometry.ts additions (pure)
/** Index runs of non-null values; a run ends where `breakBefore[i]` is true. Nulls are skipped (the line bridges them). */
export function lineRuns(values: ReadonlyArray<number | null>, breakBefore: readonly boolean[]): number[][];
export function describeSeries(...)   // now accepts (number | null)[] and ignores nulls (existing behaviour for number[] unchanged)
// TrendChart.tsx
export interface ChartDatum { key: string; value: number | null; tooltipLabel: string; axisLabel: string; hollow?: boolean; breakBefore?: boolean }
// new optional props
//   average?: ReadonlyArray<number | null>   aligned to data; when given, the accent line draws the average and the daily points draw as small muted dots (r 2.5, hollow when datum.hollow)
//   watch?: ReadonlyArray<number | null>     aligned to data; drawn as a separate dotted line (strokeDasharray "2 4", colors.muted) with ring markers (r 3.5, fill colors.card, stroke colors.muted), bridging nulls
// rangeBarLayout.ts
export interface RangeBarLayout { segments: Array<{ label: string; status: BandStatus; fraction: number }>; boundaries: Array<{ value: number; fraction: number }>; markerFraction: number }
export function rangeBarLayout(range: MetricRange, value: number): RangeBarLayout;   // fractions of the scale, segments sum to 1, marker clamped to 0..1
// chartData.ts
export function toBodyChartData(series: MetricSeries, range: RangeKind, today: DateKey): ChartDatum[];   // tooltip "Wed 11 Nov" / "Week of 9 Nov" / "November 2026"; axis labels as the Workouts chart; hollow and breakBefore from the slots (breakBefore where the hollow flag differs from the previous non-null slot)
```
`TierBadge({ tier })` is a small pill with `TIER_LABEL`; `OriginChip({ origin })` renders nothing for `scale`/`formula` and a muted pill with `ORIGIN_LABEL` otherwise; `RangeBar({ range, value, accessibilityLabel })` draws the segmented bar in the `statusLow/Ok/High` colours with a marker and numeric boundary labels under it, as in `BodyFat.dc.html`; `MetricRow` is the Body page row (label + `TierBadge`, value + unit, a status dot with its text, chevron; the dot is hollow for no-status metrics, as in `Body.dc.html`). `BodyTrendChart` wraps `TrendChart` with `toBodyChartData`, a legend row (shown only when `mixed` or watch data is shown): "Health Hub" (filled dot), "MovingLife" (hollow dot), "Watch check" (dotted), and the 7-day-average caption.

Rules: existing Activity and Workouts charts must render exactly as before (the new fields are optional; `value` widening to `number | null` must not change their output). In `TrendChart`, the value domain is computed from the non-null values of `data`, `average` and `watch` together; null datums have no dot, bar, tooltip target, or axis label; `nearestIndex` considers only non-null positions. The line is drawn per run from `lineRuns` (each run drawn with `linePath`), so it bridges gaps but not method changes.

- [ ] **Step 1: Write the failing tests**

```ts
// geometry.test.ts
test('lineRuns skips nulls and keeps one run when no break is requested');
test('lineRuns starts a new run where breakBefore is true, even across a null');
test('lineRuns of all nulls is empty');
test('describeSeries ignores nulls and still says no data for all-null input');
// chartData.test.ts
test('hollow and breakBefore come from the slots, breakBefore only where the method changes');
test('day tooltips read like "Wed 11 Nov", week "Week of 9 Nov", month "November 2026"');
test('null slots keep their key and axis label but carry value null');
// rangeBarLayout.test.ts
test('segments follow band widths over the scale and sum to one');
test('the marker sits at the value and clamps at both ends');
test('boundaries list the band edges, not the scale ends');
test('open-ended bands extend to the scale bounds');
```

- [ ] **Step 2: Run → FAIL**, implement, **Run → PASS.** Full gate. Visual verification is Task 36.
- [ ] **Step 3: Commit**: `git add src/ui` → "Add body chart overlays and range bar".

---

### Task 33: Body screen

**Files:**
- Create: `src/domain/body/bodyOverview.ts`, `src/ui/screens/body/BodyScreen.tsx`, `BodySkeleton.tsx`, `LossRateCard.tsx`, `FatVsLeanCard.tsx`, `WeighInRow.tsx`, `HistoryScreen.tsx`, `app/(tabs)/body/_layout.tsx`, `app/(tabs)/body/index.tsx`, `app/(tabs)/body/history.tsx`
- Delete: `app/(tabs)/body.tsx`, `src/ui/screens/placeholders/BodyScreen.tsx` (once unused)
- Test: `src/domain/body/bodyOverview.test.ts`

**Interfaces (produces):**
```ts
// bodyOverview.ts
export interface MetricRowModel { id: MetricId; value: number; tier: Tier; origin: Origin; statusLabel: string | null; statusTone: BandStatus | null; descriptor: string | null }
export interface WeighInModel { readingId: number; measuredAt: string; date: DateKey; weightKg: number; bodyFatPct: number | null; bodyFatHollow: boolean }
export interface BodyOverview {
  latest: ReadingMetrics | null;
  weightChange30: number | null;
  weightSpark: number[];                   // last 30 days of day points, ascending
  rows: MetricRowModel[];                  // Body-page order, only metrics the latest reading has
  lossRate: LossRate | null;
  fatVsLean: FatVsLean | null;
  recent: WeighInModel[];                  // newest first, 4 rows
  missing: Array<'height' | 'birthDate' | 'sex'>;
  onlyLegacy: boolean;                     // the latest reading has no impedance
}
export function buildBodyOverview(readings: readonly ReadingMetrics[], profile: Profile | null, today: DateKey): BodyOverview;
export function allWeighIns(readings: readonly ReadingMetrics[]): WeighInModel[];      // every reading, newest first
```
Row order (as in `Body.dc.html`): `body_fat_pct`, `muscle_pct`, `water_pct`, `bmi`, `bmr_kcal`, `visceral_rating`, `bone_mass_kg`, `metabolic_age`, then `lean_mass_kg`, `fat_mass_kg`, `protein_pct`, `health_score`. Weight is the hero card, not a row. `statusLabel`/`statusTone` come from `classify(rangeFor(...))`; metrics without a range use `NEUTRAL_DESCRIPTOR` and no tone. The profile used for ranges is the one in effect at the latest reading (`profileAt`).

**Screen** (top to bottom; `Body.dc.html` is the layout reference, `ActivityScreen` the structural reference):
1. `ScreenHeader` "Body", subtitle "Last weigh-in today, 7:12 am" style text built from the latest `measuredAt` ("today", "yesterday" or "Wed 11 Nov", then the time).
2. If `missing` is non-empty: a card "Add your height, birth date and sex in Settings to unlock BMI and ranges" with an "Open Settings" action (`router.push('/settings')`).
3. **Hero weight card:** weight large (display unit), "{change} in 30 days" (hidden when null), `TierBadge` "Measured", a `Sparkline` of `weightSpark`. Tapping opens `/body/weight`.
4. **Metric rows** in one card list, each a `MetricRow` pushing `/body/<id>`. If `onlyLegacy`, a caption below: "MovingLife only shares weight and body fat, so water, muscle and the other metrics appear once the scale connects directly."
5. **Weekly loss rate card** (hidden when null): "4-week average", "0.6 kg a week · 0.7%" (display unit), status text, and a small band bar 0 / 0.5–1 / 1.5 %, caption "Healthy 0.5–1% of body weight per week · Helms et al., 2014".
6. **Fat vs lean mass card** (hidden when null): "Last 30 days", fat and lean change with signed values, and when `fatShareOfLoss` is non-null "About {n}% of what you lost was fat." plus the mockup's "Keep protein up and keep lifting." when the share is above 0.5. Hollow marker note "From MovingLife body fat" when `hollow`.
7. **Weigh-ins** list: the 4 `recent` rows (date, weight, body fat with a hollow dot when legacy) and "See all" → `/body/history`.
8. States: `error` → `EmptyState` "Couldn't load your body data" with Try again (re-run `sync.run()`), as Activity does; loading → `BodySkeleton` (card geometry); no readings and Health Connect not connected → `EmptyState` "Connect Health Connect" with Open Settings; no readings otherwise → "No weigh-ins yet" with Sync now (skeleton while a sync runs). Pull to refresh runs `sync.run()`.
`HistoryScreen`: `DetailHeader` "Weigh-ins", every reading newest first via `allWeighIns`, same row as above, grouped by month.

- [ ] **Step 1: Write the failing tests**

```ts
// bodyOverview.test.ts (synthetic Person M readings built with computeReadings)
test('rows list only the metrics the latest reading has, in the Body page order');
test('a legacy-only latest reading gives body fat, BMI, BMR, lean and fat mass rows and onlyLegacy true');
test('an impedance reading gives all twelve rows');
test('status label and tone come from the profile in effect at the latest reading');
test('metrics without a range carry a neutral descriptor and no tone');
test('weightChange30 and weightSpark cover the last 30 days only');
test('recent holds 4 newest-first rows and allWeighIns holds every reading');
test('bodyFatHollow is true for legacy body fat');
test('missing lists the absent profile fields and an absent profile lists all three');
test('no readings gives a null latest and empty lists');
```

- [ ] **Step 2: Run → FAIL**, implement the model, the screens and the routes. **Run → PASS**, then the full gate.
- [ ] **Step 3: Commit**: `git add src app` → "Add the Body page with weigh-ins and loss rate".

---

### Task 34: Metric detail screen, About formulas

**Files:**
- Create: `src/domain/body/metricDetail.ts`, `src/ui/screens/body/MetricDetailScreen.tsx`, `ExplainerCard.tsx`, `app/(tabs)/body/[metric].tsx`
- Modify: `src/ui/screens/settings/AboutSheet.tsx` (add the formula version and sources)
- Test: `src/domain/body/metricDetail.test.ts`

**Interfaces (produces):**
```ts
// metricDetail.ts
export function parseMetricId(param: string | string[] | undefined): MetricId | null;   // only the 13 ids
export interface MetricDetail {
  current: DayPoint | null;                // latest point of the metric
  asOfLatest: boolean;                     // current.date equals the latest weigh-in day
  range: MetricRange | null;
  classified: Classified | null;
  tier: Tier;                              // from the current value
  series: MetricSeries;
  watch: Array<number | null> | null;      // body_fat_pct, Day range only
  tip: string | null;                      // with {x} already substituted
  sources: readonly FormulaSource[];
}
export function buildMetricDetail(input: {
  metric: MetricId; readings: readonly ReadingMetrics[]; profile: Profile | null; watch: readonly WatchBodyFat[];
  range: RangeKind; today: DateKey; unit: WeightUnit;
}): MetricDetail;
```
**Screen** (`BodyFat.dc.html` is the reference; it applies to every metric):
1. `DetailHeader` with the metric label.
2. Hero: current value large with unit, status chip (text + status colour, or the neutral descriptor), `TierBadge`, `OriginChip`. When `asOfLatest` is false: caption "Last measured {date}".
3. `RangeBar` with the range-source line ("Ranges for your age and sex. Source: Gallagher et al., 2000.") and, for Rough ranges, "conventional vendor range". Hidden when `range` is null.
4. `SegmentedControl` Day / Week / Month (same haptic as the Activity ranges), `BodyTrendChart` (height 200, value axis shown), legend, and for body fat on Day the watch overlay.
5. `StatGroup` Average / Lowest / Highest / Change for the visible period (from `series.stats`; "—" when null); a caption "Same-method readings only" when the series is mixed.
6. **"What this means"**: a collapsed-by-default row with a chevron that expands the explainer (`what`, `moves`, `reliability`) and the sources list ("Formula: Sun et al., 2003 · doi …"), plus "Formula version {FORMULA_VERSION}".
7. Tip line (one sentence in a quiet `Card`), only when `tip` is non-null.
8. States: a metric with no readings at all → `EmptyState` "No {label} data yet" explaining what it needs ("needs a scale reading with impedance" for the impedance-only metrics); an unknown route param → `EmptyState` "Unknown metric" with a back action. Chart `accessibilityLabel` via `describeSeries`.
`AboutSheet`: add rows "Body formulas · version {FORMULA_VERSION}" and the short citation list from `FORMULA_SOURCES` (text only, no links needed), keeping the "not medical advice" note.

- [ ] **Step 1: Write the failing tests**

```ts
// metricDetail.test.ts
test('parseMetricId accepts the 13 ids and rejects everything else, arrays and undefined');
test('body fat detail for male 26 carries the Gallagher range, the classified band and the current value');
test('asOfLatest is false when the metric was last measured on an earlier day');
test('tier follows the current point: a legacy body fat is estimated with origin movinglife');
test('watch values appear only for body fat on the Day range and never enter the series stats');
test('the tip substitutes {x} with the absolute 30-day change and is null for a healthy value');
test('weight detail uses the BMI-derived range and unit-converted formatting is left to the screen');
test('a metric with no data gives a null current and an empty series');
test('sources come from the explainer and are empty for MovingLife body fat');
```

- [ ] **Step 2: Run → FAIL**, implement model, screen and route. **Run → PASS**, full gate.
- [ ] **Step 3: Commit**: `git add src app` → "Add the body metric detail screen".

---

### Task 35: Local calibration check

**Files:**
- Create: `src/domain/body/calibration.local.test.ts`
- Modify: none (the test file is the only artefact; it contains no data values)

**Behaviour.** Reads `~/personal/health-hub-captures/2026-11-13/movinglife-reference.json` (via `os.homedir()`) only when `process.env.HH_CALIBRATION === '1'` **and** the file exists; otherwise `describe.skip`. In CI and in a normal `npm test` it is skipped, so the gate never touches private data. Run it with `HH_CALIBRATION=1 npx jest src/domain/body/calibration.local.test.ts`.

For every weigh-in in the file it builds a `BodyInput` from the file's `profile` (height, age, sex) and weight, and for **each of the three candidate impedances** (u16 big-endian at payload offsets 5, 7 and 9, parsed from `bleFinalFrame.payloadHex` by the test itself, not from the file's guessed fields) calls `computeBodyMetrics`. It writes `.superpowers/sdd/2026-11-13-plan-4-body-composition/calibration.md` (create the folder if missing; the folder is git-ignored) containing, per weigh-in and candidate:
- engine vs MovingLife for body fat %, lean mass, water %, skeletal muscle % (MovingLife's `skeletalMusclePct`), BMR, visceral, metabolic age and health score against `bodyAge` and `bodyScore`, with the signed difference;
- PASS/FAIL against the §18 item 6 tolerance (body fat ±4 points, water ±5, muscle ±5);
- whether `impedanceIsUsable` accepted the value, and whether FFM exceeded body weight;
- a closing section comparing weigh-in 1 with weigh-in 3 (the water-bottle one): the change in our fat mass and lean mass for each candidate next to MovingLife's.
The test asserts only structure: the file parses, the three weigh-ins and candidates exist, the report file was written, and no output value is `NaN`. It never asserts closeness to MovingLife.

- [ ] **Step 1: Write the test** (skip logic first, then the report). Confirm a normal `npx jest src/domain/body/calibration.local.test.ts` reports it as skipped, and that `git status` shows no `.superpowers` path.
- [ ] **Step 2: Run it once locally** with `HH_CALIBRATION=1` and confirm the report is written. Do not paste the report into the commit message, the plan or any committed file.
- [ ] **Step 3: Commit**: `git add src/domain/body/calibration.local.test.ts` → "Add the local body calibration check". Check `git diff --cached` shows no numbers from the reference file.

---

### Task 36: On-device verification, debug and release

The controller drives the phone. Nothing here is delegated to a builder. Save screenshots to the scratchpad `shots/` folder as `t36-*`; never commit them. Read and record the current `cmd uimode night` value first.

- [ ] **Step 1: Pre-flight.** The full gate passes and `git status` is clean. The owner's birth date is saved in Settings.
- [ ] **Step 2: Calibration ruling (Ruling 3).** Run `HH_CALIBRATION=1 npx jest src/domain/body/calibration.local.test.ts` and read the ledger report. Confirm or overturn offset 9: the winning candidate keeps FFM below body weight, has `impedanceIsUsable` true for all three weigh-ins, and has body fat and skeletal muscle inside the §18 tolerance. Water may exceed ±5; record why (MovingLife's water is on the low side of the usual range; ours uses the Sun TBW equation) as accepted. **Stop and ask the owner** if no candidate is inside tolerance for body fat or muscle. Write the result into the ledger as the note for Plan 5 (the offset, and "engine unchanged either way"). Also confirm Gallagher's male 20–39 row and the Janssen 2002 cut-points against the papers' abstracts or tables and record "confirmed" or the corrected numbers; a correction is a builder fix plus a `FORMULA_VERSION` bump.
- [ ] **Step 3: Debug app.** No native rebuild is needed (Plan 4 adds no native module); the installed dev client is enough. Start Metro per the on-device JS check procedure and open the app.
- [ ] **Step 4: Functional checks** (values stay on screen; the ledger records only "match", "mismatch" or "n/a").
  1. **Body tab, legacy data.** Opens on the latest weigh-in; hero weight, rows for body fat, BMI, BMR, lean and fat mass only; the caption about MovingLife appears; the missing-profile card is absent.
  2. **Spot-checks.** Latest weight and body fat equal MovingLife's own list for that day (`match`); BMI equals weight ÷ height² by hand; fat mass + lean mass equals weight.
  3. **Detail screen for body fat.** Range bar shows 8 / 20 / 25 for the owner's age and sex and the marker sits in the right band; Day / Week / Month switch with a haptic; points are hollow (legacy); the dotted **watch check** line appears on Day only and never in Week or Month; the 7-day average line renders; long-press tooltip works; the stats are plausible against the chart; the "What this means" row expands; for MovingLife-origin body fat it carries the MovingLife note and no Sun 2003 citation; the tip appears only when the band or trend rule says so.
  4. **Other details.** Weight, BMI, BMR, lean mass and fat mass open without errors; metrics with no value never appear as rows.
  5. **Weekly loss rate and fat vs lean** are plausible against the weight chart (compare the sign and rough size by eye); the Fat vs lean card shows the "From MovingLife body fat" note.
  6. **History.** "See all" lists every weigh-in newest first, grouped by month; count equals Settings → Data weigh-ins.
  7. **Profile reactivity.** In Settings switch the BMI cut-offs to the Asian set, return to Body: the BMI status changes; switch back. Edit height, return: BMI changes; restore it.
  8. **Dark and light** (`cmd uimode night yes|no`; restore the recorded mode afterwards) for Body, a detail screen and History; empty and not-connected states when Health Connect access is revoked and restored.
  9. **Wipe and re-sync.** Wipe local data: Body shows its empty state; re-sync restores the same weigh-in count.
  10. **Logs.** `adb logcat -d -s ReactNativeJS:V` shows no errors.
- [ ] **Step 5: Release smoke test (no Metro, Hermes bytecode).** Stop Metro, then:
```bash
cd android && ./gradlew assembleRelease && cd ..
adb -s 59180DLCQ00B36 install -r android/app/build/outputs/apk/release/app-release.apk
```
Never use `expo run:android --variant release`. Expected: install succeeds as an update; the app opens without Metro; Body, a detail screen, Activity and Settings load with the data; pull-to-refresh succeeds; logcat has no `ReactNativeJS` errors. Leave the release build installed.
- [ ] **Step 6: Owner confirmations (pending list in the report).** The look of the Body and body-fat screens against the approved mockups; whether a body-fat value on the scale matches their expectation once Plan 5 delivers impedance; the Rough-metric labelling.
- [ ] **Step 7: Commit** fixes found in this task: "Fix issues found in body verification". Nothing is committed if there were none.

---

## Notes for later plans

- **Plan 5 (BLE).** Store the chosen u16 offset in the frame parser as one named constant (Ruling 3); fill `scale_reading.impedance_ohm` and `raw_payload`. The engine and screens need no change; a reading with impedance becomes a solid point automatically, and the legacy-to-formula transition is handled by Ruling 7. Dedupe across sources should reuse the match functions in `src/data/healthconnect/weighIns.ts` (lift them into a shared module then).
- **Plan 6 (export).** Use `computeReadings`, `dayPoints`, `FORMULA_VERSION`, `ORIGIN_LABEL`, `TIER_LABEL` and `FORMULA_SOURCES` so the briefing says which values are MovingLife's and which are Health Hub's, and that the watch check is separate. Name the formula version in the context section.
- **Plan 7 (Senssun cloud).** Writing impedance into `scale_reading.impedance_ohm` for historical readings upgrades them to solid points with no other change; there is nothing to recompute (Ruling 5). Re-check the calibration offset against cloud values.
- **Plan 8 (Today).** Read `buildBodyOverview` for the latest weight, body fat and muscle; goal projection can start from `weeklyLossRate`. Settings "Recompute body metrics" is not needed (Ruling 5).

## Done when

- `npm run typecheck && npm run lint && npm run format:check && npm test` pass on `jereenv/body-composition`.
- On the Pixel, the release build runs without Metro; the Body tab opens on the latest weigh-in with correct values, honest MovingLife labelling and hollow legacy points; every available metric opens a detail screen with a range bar, Day/Week/Month chart, the dotted watch-check line on body fat only, an explainer naming its sources, and a tip only when a rule fires; profile edits show immediately.
- `computeBodyMetrics` is ready for readings with impedance, and the local calibration report exists in the ledger with the impedance-offset ruling recorded for Plan 5.
- No private value is committed or logged.
