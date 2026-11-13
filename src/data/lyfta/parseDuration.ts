// Recorded pattern (docs/research/lyfta-api-shapes.md): `H:MM:SS` / `HH:MM:SS`, nothing else.
const DURATION_PATTERN = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/;

/**
 * Parses Lyfta's `workout_duration` (`H:MM:SS`) into whole seconds. Returns null for any other
 * shape, including a two-part or bare-number value, because those formats were never observed.
 */
export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
