# Health Hub

A personal Android app that gathers my workouts, smart-scale body composition and watch data into one place, then turns them into a short **briefing for ChatGPT**. I share it from my phone and ask for advice on my training and progress.

It is built for one person and one set of devices. It is not a general product, and nothing here is medical advice.

## What it does

- **Workouts from [Lyfta](https://lyfta.app).** Full history and the training schedule come from Lyfta's REST API, using a personal API key entered in Settings. The app shows volume, personal records and estimated one-rep maxes (Epley).
- **Activity, sleep and heart rate from Health Connect.** Samsung Health writes steps, distance, calories, sleep sessions and heart rate. The app reads them with Android's history permission, so older data comes in too.
- **The smart scale over Bluetooth.** The app connects to a Senssun-family foot-to-foot scale (TF-4001, advertises `IF_B2A`) whenever it is open. It shows the live weight on Today and saves the final result with its bio-impedance. Older weigh-ins come in through Health Connect from the vendor app, MovingLife.
- **Body composition.** Computed on the phone from weight, impedance and profile, using published equations: Sun 2003 for fat-free mass and body water, Janssen 2000 for skeletal muscle, and Katch–McArdle for BMR (Mifflin–St Jeor as fallback). Each value carries a reliability tier: _Measured_, _Exact_, _Estimated_ or _Rough_. Ranges come from Gallagher 2000 for body fat, WHO or WHO Asian for BMI, and Janssen 2002 for muscle.
- **Export.** A Markdown briefing in three layers: context, summary, then detail. It goes to the ChatGPT app through Android's share sheet, or onto the clipboard. Presets:
  - weekly check-in;
  - month review;
  - whole journey, with weekly aggregates plus a CSV;
  - single workout, with every set;
  - custom date range.

  Days with no data are left out of averages rather than counted as zero.

## Screens

| Tab          | What it shows                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**    | The Bluetooth weigh-in card: "Step on the scale" → live weight → "Stay on · measuring body composition" → saved                                                  |
| **Body**     | Latest weigh-in and every metric with its tier and range, weekly loss rate, fat versus lean mass, weigh-in history. Tap a metric for day, week and month charts. |
| **Workouts** | Weekly volume, upcoming sessions from the Lyfta schedule, workout detail with every set, per-exercise progress                                                   |
| **Activity** | Steps, distance, calories, sleep per night and heart rate                                                                                                        |
| **Export**   | Pick a preset and sections, preview, then **Share to ChatGPT**                                                                                                   |

## Tech stack

- Expo SDK 57, with React Native 0.86 on the New Architecture, React 19.2 and TypeScript 6.0
- `expo-router` for navigation and `expo-sqlite` for local storage (WAL mode, versioned migrations)
- `react-native-health-connect` 4.1.3 and `react-native-ble-manager` 12.6.1
- Jest 29, with `sql.js` so the repositories run against real SQLite in Node

## Architecture

```text
app/          expo-router routes (thin re-exports of screens)
src/domain/   pure TypeScript: no React Native imports. Body-composition engine, export
              builder, scale frame codec and session state machine, date maths, formatting
src/data/     SQLite repositories, sync (Lyfta, Health Connect), the BLE runner; native
              access only through adapter files named expo*.ts
src/ui/       screens, components, charts, theme tokens, hooks
src/bootstrap dependency container that wires repositories, sync and the scale runner
docs/         design spec, implementation plans, research notes, UI guidelines
```

The rule that keeps this testable is that `src/domain` and `src/data` never import React Native or Expo, except in the `expo*.ts` adapters. Hard logic runs in plain Node: scale byte parsing, the reducer that decides when a weigh-in is saved, and the briefing builder. Tests pin it, including golden files for the exported briefings.

## Building and running

Android only. You need Node, the Android SDK and JDK 17, plus a device with Health Connect. The Bluetooth card needs Android 12 or newer.

```bash
npm install
npx expo prebuild --platform android      # generates android/ (git-ignored)
(cd android && ./gradlew assembleDebug)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npx expo start --dev-client               # serves the JS bundle to the debug build
```

- Don't start Metro with `CI=1`. It disables file watching, so the phone keeps running stale code.
- A standalone build: `(cd android && ./gradlew assembleRelease)`, then install `app-release.apk` the same way. It is signed with the debug keystore, which is fine for sideloading onto your own phone but not for a store.
- Install updates with `adb install -r`, not by uninstalling first. Uninstalling wipes the app's secure storage and its local database.

## Tests and checks

```bash
npm test              # Jest, about 1,100 tests; the time zone is fixed to America/New_York
npm run typecheck
npm run lint
npm run format:check
```

`npm run lyfta:probe` is a development script that prints the shapes of Lyfta API responses. It reads the API key from the macOS Keychain and never prints it.

## Privacy

- All data stays on the phone, in a local SQLite database. There is no server, no account and no analytics.
- The Lyfta key is kept in Android secure storage. It is never logged and never committed.
- Data leaves the phone only when you share a briefing or CSV yourself.
- The test fixtures are synthetic. Real Bluetooth captures and personal measurements were used during development but are not in this repository.

## Docs

- Design spec: [`docs/superpowers/specs/2026-11-12-health-hub-design.md`](docs/superpowers/specs/2026-11-12-health-hub-design.md)
- Implementation plans, one per stage: [`docs/superpowers/plans/`](docs/superpowers/plans/)
- Research notes (Lyfta API shapes, Senssun cloud feasibility): [`docs/research/`](docs/research/)
- UI guidelines: [`docs/design/ui-guidelines.md`](docs/design/ui-guidelines.md)

## Status and limits

- The app is feature-complete for what I need: collect, then export to ChatGPT.
- Importing older weigh-ins with impedance from the Senssun cloud was investigated and dropped. Readings from before the app could talk to the scale therefore keep only weight and the vendor's body-fat value.
- The Bluetooth code knows one scale's protocol. Other scales won't connect.
- Foot-to-foot scales measure differently from the whole-body method the equations were developed on, so body-composition values are estimates, best read as trends.

No license has been chosen yet, so default copyright applies.
