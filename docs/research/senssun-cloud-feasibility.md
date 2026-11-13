# Senssun / MovingLife cloud history: feasibility (static analysis)

Date: 2026-11-12. App analysed: MovingLife `com.moving.movinglife` 5.13.0 (white-label Senssun app).
Method: static decompilation only (jadx 1.5.6). No request was sent to any Senssun server, no credentials were used, no app code was run.
Labels: **[confirmed]** = read directly in decompiled code; **[inferred]** = deduced from code shape or naming; **[live]** = can only be settled by a live request.

## Verdict: feasible with caveats

The app talks to a plain REST API over HTTPS with a session token. There is no request signing, no certificate pinning and no encrypted payload on the read path. The per-weigh-in detail call returns every stored sensor value, including impedance. The caveats are: the password hash scheme is app-specific and must be re-implemented exactly, the API is undocumented and may change, and the response shapes, units and region must be confirmed with one live test.

Confidence: high that the call sequence and field names are right; medium that impedance is present for the owner's scale (depends on the model, see "Live test").

## Servers [confirmed]

Base URL is chosen by a "foreign" flag on the account (`com/moving/movinglife/ui/utils/o0000O.java`):

| Account region | API base |
|---|---|
| overseas | `https://movinglife.senssun.com` |
| China | `https://movinglifecn.senssun.com` |

Two further hosts, `https://exploreren.senssun.com` and `https://explorercn.senssun.com`, serve admin/file endpoints (OTA, file download). Not needed here. [inferred: which region the owner's account lives in; **[live]**]

## Transport and security observations

- HTTPS everywhere for the configured base URLs [confirmed]. The manifest's network security config permits cleartext globally (`cleartextTrafficPermitted="true"`), but the API base URLs are all `https://`.
- No certificate pinning [confirmed for this client]: the shared OkHttp client builder (`p133o00OO0o/OooO0OO.java`) sets only three 30 s timeouts and one header interceptor. No pinner, custom SSL factory or hostname verifier is configured there.
- No request signing on the read path [confirmed]: the only auth material is one request header named `token`, added to every request by that interceptor.
- Two embedded values exist elsewhere in the app but are not needed for this feature: a Fitbit OAuth client id and client secret in `MainApplication.onCreate` (third-party integration), and an app client code used at login (below). Recorded by location only.
- Request logging: the app logs request maps with `Log.e` (debug noise, not a network concern).

## Call sequence

Retrofit interfaces use obfuscated annotation names; the mapping to HTTP verbs was confirmed in `retrofit2/RequestFactory.java` (e.g. `o00O00O`=GET, `o00O0OO0`=POST, `o00O`=Query, `o00OO000`=QueryMap, `o00O000`=Field, `oo0oOO0`=Path).

### 1. Login: `POST v1/user/loginCheck` [confirmed]

Interface: `o0o0Oo/OooO0O0.java`; caller: `o0o0Oo/OooO0OO.java` (`OooOo00`).

- Parameters are sent as **query parameters** on a POST (still inside TLS): `client_id`, `account`, `password`.
- `client_id`: a short numeric client code set once in `MainApplication.onCreate` and passed to the login module. It is an app identifier, not a per-user value. [confirmed it exists; value can be read from MainApplication.onCreate when implementing]
- Password handling [confirmed]: the password is **not sent in plain text and not sent encrypted**. The client trims it, runs it through a custom base64 variant with a shuffled fixed alphabet (`o00OOO/OooO00o.java`), then through a salted double MD5 (`o00OOO/OooO0O0.java`), uppercase hex. The salt is a fixed constant string compiled into the app (not secret per user, but app-specific); it is used once as a suffix in the first MD5 and once as a prefix in the second. Because the result is a deterministic, unsalted-per-user hash, the hash itself acts as the password on the wire ("pass-the-hash"). The implementation must reproduce those two small classes exactly.
- Response (`SUserLoginRSO`): `token`, `tokenExpiration`, plus `errcode`/`errMsg`. [confirmed]
- Errors: HTTP error status with a JSON body `{errcode, errMsg}`; `errcode == 0` means success. [confirmed]
- Token storage in the app: kept in the local `SUserInfo` database row and handed to the shared client builder (`Oooo000`/`OooO0Oo(token)`), which then sends it in the `token` header. [confirmed]
- Token lifetime / refresh: only `tokenExpiration` is present; no refresh endpoint seen. `v1/user/logout` (GET) exists. [live: format of expiry, whether sessions are single-device and whether logging in here logs the phone app out]

Other auth routes exist (Google, Facebook, WeChat, phone and e-mail registration, `checkExist`). Not needed. Whether the owner's MovingLife account is a password account or a social login is a prerequisite [live/owner]. A social-only account would have no password to use here.

### 2. Identify the user: `GET v1/user/getUserInfo`, `POST v1/user/subuser/list` [confirmed]

Needed only to learn the user id and sub-user (family member) ids. [inferred: when the account is the single/primary user, the account-level history endpoints are used; otherwise sub-user endpoints with the sub-user id. Which applies to the owner is **[live]**.]

### 3. List weigh-ins (history index) [confirmed]

Two equivalent shapes, chosen in `p153o00Oo0oo/OooOOO.java` by a flag on the user object:

- Account level: `GET v1/user/sensor/02/datapoints`
- Sub-user level: `GET v1/user/subuser/{subuserId}/datapoints/02`

Query parameters (account level): `page_index`, `page_size`, `sort` (`ASC`/`DESC`), `begin_time`, `end_time`. The sub-user variant takes the same through a map, plus `sensor_types=02`.
Time format: `yyyy-MM-dd HH:mm:ss` **in GMT+8** (`p143o00Oo/OooO0OO.java`). [confirmed] Convert owner-local times to GMT+8 for the window parameters, and treat returned times as needing the same zone check. [live]

Pagination [confirmed]: 1-based `page_index`; the app uses `page_size=50` and pages until an empty list comes back. Its first backfill window is 2010-01-01 to now. There is no total count or cursor in the list response; stop on an empty page. The app resumes later by moving `begin_time` past its newest local record. The server-side maximum `page_size` is unknown. [live]

Response: a JSON array of `SWeightHistoryRSO` with fields `batchId`, `sensorType`, `timestamp`, `value`. This is the weight sensor (`02`) only, one entry per weigh-in. **The list does not contain impedance.** [confirmed]

### 4. Fetch one weigh-in's full detail [confirmed]

For each `batchId` from step 3 the app calls:

- Account level: `GET v1/user/datapoints/{batchId}`
- Sub-user level: `GET v1/user/subuser/datapoints/{batchId}`

Response: a JSON array of `SWeightGetDetailsRSO`, one element per sensor reading in that weigh-in. Fields: `id`, `dataPointId`, `dataPointName`, `dataPointType`, `dataStreamId`, `deviceId`, `symbol`, `userHistoryId`, `userId`, `value` (string), `valueCreateTime` (long), `systemAcceptTime` (long).

The app builds its local record by switching on `dataPointType` (`o0oOO/OooO00o.java`):

| dataPointType | meaning (from the setter it feeds) |
|---|---|
| 02 | weight |
| 03 | body fat |
| 04 | body water (moisture) |
| 06 | BMI |
| 11 | muscle |
| 12 | bone |
| 13 | BMR |
| 18 | **impedance (foot-to-foot, "LfRf")** |
| 21 | AMR |
| 39 | body score |
| 45 | weight division/resolution |
| 46, 47, 48, 50, 51, 52 | additional impedance channels (hand/hand, hand/foot pairs) for 8-electrode scales |
| 53 | extended data blob (parsed as structured data) |
| 171 | heart rate |

Meanings are inferred from the setter names (`setLfRfImpedance`, `setLhRhImpedance`, ...). [inferred] Which of these the owner's scale actually writes is **[live]**: a basic foot-only scale should yield `18`; 8-electrode models add the 46 to 53 family. `valueCreateTime` is presumably epoch milliseconds, since the app stores it directly as its timestamp. [inferred]. Weight value units and the use of type `45` (division) for scaling are unverified. [live]

So impedance is available through the detail call, not the list call. A full backfill costs 1 list call per 50 weigh-ins plus 1 detail call per weigh-in.

### 5. Other data paths seen (not needed)

- `data/v1/wifi/history/findUnclaim`, `findAutoclaim`, `delUnclaim`, `uploadData`: WiFi-scale "unclaimed" records. The unclaimed record (`SWeightUnclaimDataRSO`) carries an `impedance` string and a separate typed impedance object (`SWeightUnclaimImpedanceRSO`, for example 20 kHz / 100 kHz per limb and a 50 kHz leg-to-leg value). Relevant only if the owner's scale is WiFi. [confirmed fields; applicability **[live]**]
- Upload endpoints (`datapoints/batch`, gzip+base64 `data` form field) and a `delClaim`/`delete datapoints` DELETE. **Out of scope. Health Hub must stay read-only against this API.**

## Risks

1. **Private, undocumented API.** Paths, parameters and the password scheme can change with any app release. Pin the findings to app version 5.13.0 and keep the client isolated behind one module with tolerant parsing.
2. **Password hash is app-specific.** It depends on a fixed salt and custom encoding compiled into the app. If a future release changes it, login breaks until re-derived.
3. **Credential handling.** The owner's MovingLife password (or the derived hash, which is equivalent) must live only in `expo-secure-store` / a local Keychain item, never in logs, fixtures or commits. The token goes in the same store.
4. **Session side effects.** Logging in from Health Hub may invalidate the phone app's session if the server allows one token per account. [live]
5. **Terms of service.** Using the vendor's private API, even for one's own data, may conflict with their terms. The owner has accepted this for their own account.
6. **Rate limits unknown.** A backfill needs one detail call per weigh-in. Throttle and make it resumable. [live]
7. **Region.** Wrong region host means failed login. Both hosts are known. [live: which one]
8. **Time zone.** Window parameters are GMT+8; stored times must be normalised to UTC ISO-8601 per project rules.
9. **Impedance meaning.** Raw impedance units, and whether `18` is a single 50 kHz-type reading, are unverified. Keep raw strings alongside any parsed numbers.

## Live test: what is needed from the owner

One short, read-only session, run by the owner (or with the owner present) and never logged to the repo:

1. Confirm the MovingLife account logs in with an **account + password** (not Google, Facebook or WeChat only). Which region does the app show (overseas or China)?
2. Scale model name or the model shown in the app (WiFi or Bluetooth, number of electrodes) to know which impedance types to expect.
3. Enter the MovingLife account name and password into a local Keychain item (`health-hub-senssun` suggested) by the owner's own hand. Do not paste them into chat.
4. Run, in order, with the `token` header: login; `getUserInfo`; one history page of 5 records, newest first; the detail call for 1 to 2 of those `batchId` values.
5. Record only **shapes**: field names, value types, which `dataPointType` codes appear, whether impedance is present, units (compare weight against the app screen), time format and zone, and the HTTP/error JSON for a wrong password. Do not store real weights, ids or tokens in fixtures; redact before saving.
6. Answer the open questions: does login return an expiry in a parseable format; does it log the phone out; maximum `page_size`; any rate limiting; what the list returns when the window is empty.

## Evidence index (decompiled paths, inside the scratchpad copy only)

- API interfaces: `p153o00Oo0oo/OooOOOO.java` (weight), `o0o0Oo/OooO0O0.java` (auth/user), `oo0oOO0/OooO0O0.java` (other sensor `61` data).
- Client/header interceptor: `p133o00OO0o/OooO0OO.java`. Header name constant `token` in `com/ss/bluetooth/utils/Constant.java`.
- History paging and detail fetch: `p147o00Oo0O/OooOOO.java`, `p153o00Oo0oo/OooOOO.java`.
- Sensor code mapping: `o0oOO/OooO00o.java`. Password hashing: `o00OOO/OooO00o.java`, `o00OOO/OooO0O0.java`.
- Base URL selection: `com/moving/movinglife/ui/utils/o0000O.java`.
- Response models: `com/senssun/weight/net/model/*`, `com/senssun/user/account/model/SUserLoginRSO.java`.
