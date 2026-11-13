# Lyfta API response shapes

Recorded on 2026-11-12 by `npm run lyfta:probe` (one request per endpoint, `limit: 1` for workouts).
This file holds shapes only: field names and type names, never values. Everything under "Shapes" is
**confirmed** from the live responses unless marked otherwise.

A type written `null | string` means that field was `null` on some items and a string on others
within the one response sampled. A field seen only as `null` has an unknown real type.

## Shapes

### GET /profile

```json
{
  "status": "boolean",
  "message": "string",
  "data": {
    "user_id": "number",
    "first": "string",
    "last": "string",
    "photo": "string",
    "followers": "number",
    "following": "number",
    "is_coach": "boolean",
    "workouts": "number",
    "shared_workouts": "number",
    "shared_programs": "number",
    "bio": "string",
    "follow_state": "null",
    "limited": "boolean"
  }
}
```

### GET /schedule (with completed items included)

```json
{
  "status": "boolean",
  "count": "number",
  "total_records": "number",
  "total_pages": "number",
  "current_page": "number",
  "limit": "number",
  "from": "string",
  "to": "string",
  "workouts": [
    {
      "id": "string",
      "source": "string",
      "template_id": "string",
      "title": "string",
      "scheduled_date": "string",
      "scheduled_time": "null",
      "status": "string",
      "is_completed": "boolean",
      "note": "null"
    }
  ]
}
```

### GET /workouts (page 1, limit 1)

```json
{
  "user_id": "number",
  "status": "boolean",
  "count": "number",
  "total_records": "number",
  "total_pages": "number",
  "current_page": "number",
  "limit": "number",
  "workouts": [
    {
      "id": "number",
      "title": "string",
      "body_weight": "number",
      "workout_perform_date": "string",
      "total_volume": "number",
      "totalLiftedWeight": "number",
      "user": { "username": "string" },
      "exercises": [
        {
          "exercise_id": "number",
          "excercise_name": "string",
          "exercise_type": "string",
          "exercise_image": "string",
          "exercise_rest_time": "number",
          "sets": [
            {
              "id": "string",
              "weight": "string",
              "reps": "string",
              "rir": "null | string",
              "duration": "null",
              "distance": "null",
              "set_type_id": "string",
              "is_completed": "boolean",
              "record_type": "null | string",
              "record_level": "null | string",
              "record_value": "null | string"
            }
          ]
        }
      ],
      "user_id": "number",
      "weight_unit": "null",
      "workout_duration": "string"
    }
  ]
}
```

### GET /exercises/progress

```json
{
  "status": "boolean",
  "weight_unit": "string",
  "data": []
}
```

`data` came back as an empty array, so the shape of its items is **not yet known**. Re-probe with an
account state or query that returns progress rows before writing a parser for it.

## Units

- Set weights are in the account unit, read from `/exercises/progress` `weight_unit`.
- `body_weight` is owner-entered in Lyfta and is intentionally ignored; body weight comes only from
  the scale and MovingLife history.
- `total_volume` is not yet verified. It is currently treated as being in the account unit; check
  it against raw set weights and reps before relying on it.

## Answers

- **Weight unit.** Confirmed present: top-level `weight_unit` (string) on `/exercises/progress`. A
  `weight_unit` field also exists on each workout in `/workouts`, but it was `null` in the sampled
  workout, so it cannot be relied on alone. `/profile` has no unit field. Which unit strings occur
  (for example kg or lb) is not known from shape alone; the value was deliberately not recorded.
  Inferred approach: read `/exercises/progress` `weight_unit` once, and treat a non-null workout
  `weight_unit` as an override.
- **`duration` and `distance`.** Both were `null` on every sampled set, so the type and unit are
  unknown. Inferred only: they are probably for cardio-type exercises and likely numeric strings
  like `weight` and `reps`, but this is unconfirmed. Nothing in the field names states a unit.
- **`set_type_id`.** Confirmed to be a string. Its meaning is not discoverable from shape; mapping
  ids to set types (normal, warm-up, drop set and so on) needs the Lyfta documentation or
  deliberately comparing sets of known type.
- **Numeric formats.** Confirmed: set `weight` and `reps` are strings; `body_weight`,
  `total_volume`, `totalLiftedWeight` and `exercise_rest_time` are numbers.
- **Schedule item fields.** Confirmed: `id`, `source`, `template_id`, `title`, `scheduled_date`,
  `scheduled_time`, `status`, `is_completed`, `note`. `scheduled_time` and `note` were `null`, so
  their types when set are unknown (inferred: strings). Pagination fields (`count`, `total_records`,
  `total_pages`, `current_page`, `limit`) and the `from`/`to` range echo the request.
- **Id types differ.** Workout `id` and `exercise_id` are numbers, but set `id`, schedule `id` and
  `template_id` are strings.
- **Spelling.** `excercise_name` is spelled that way in the live response (confirmed).
