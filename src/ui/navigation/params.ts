/** A route id as a positive integer, or null for anything else (a repeated param uses its first value). */
export function parseIdParam(param: string | string[] | undefined): number | null {
  const text = Array.isArray(param) ? param[0] : param;
  if (text === undefined || !/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
