const MINUS = '−';

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatSignedDelta(value: number, decimals: number): string {
  const text = Math.abs(value).toFixed(decimals);
  if (Number(text) === 0) return '0';
  return `${value > 0 ? '+' : MINUS}${text}`;
}

export function formatCount(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Groups thousands with commas. Done by hand so Hermes and Node agree. */
export function formatInteger(n: number): string {
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 && Math.round(n) !== 0 ? `${MINUS}${digits}` : digits;
}
