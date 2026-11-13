// Jest runs this once before any test worker starts. Workers inherit the
// environment, so every test sees the same fixed time zone.
export default function setup(): void {
  process.env.TZ = 'America/New_York';
}
