const MAX_DEPTH = 8;
const DEPTH_MARKER = '…';

/** Key under which every value-like key (id, date, UUID, long hex) is merged. */
export const VALUE_KEY = '<key>';

const MAX_PATTERN_LENGTH = 40;
const VALUE_LIKE_KEY =
  /^(\d+|\d{4}-\d{2}-\d{2}.*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,})$/i;

function isValueLikeKey(key: string): boolean {
  return VALUE_LIKE_KEY.test(key);
}

type Shape = string | Shape[] | { [key: string]: Shape };

function isPlainShape(shape: Shape): shape is { [key: string]: Shape } {
  return typeof shape === 'object' && !Array.isArray(shape);
}

// Only nodes created by mergeShapes are unions, so a real "$union" key in an API response is never
// mistaken for one.
const unions = new WeakSet<object>();

function unionMembers(shape: Shape): Shape[] {
  return (shape as unknown as { $union: Shape[] }).$union;
}

/**
 * Combines the shapes of several values into one. Objects merge key by key, arrays merge their
 * item shapes, and differing primitive types are listed as "a | b". A mix of primitives and
 * containers (for example a nullable object) is listed under a `$union` key.
 */
function mergeShapes(input: Shape[]): Shape {
  const shapes = input.flatMap((shape) =>
    typeof shape === 'object' && unions.has(shape) ? unionMembers(shape) : [shape],
  );
  const primitives = new Set<string>();
  const objects: { [key: string]: Shape }[] = [];
  const arrays: Shape[][] = [];
  for (const shape of shapes) {
    if (typeof shape === 'string') shape.split(' | ').forEach((name) => primitives.add(name));
    else if (Array.isArray(shape)) arrays.push(shape);
    else if (isPlainShape(shape)) objects.push(shape);
  }

  const members: Shape[] = [];
  if (primitives.size > 0) members.push([...primitives].sort().join(' | '));
  if (objects.length > 0) {
    const keys = new Set(objects.flatMap((object) => Object.keys(object)));
    const merged: { [key: string]: Shape } = {};
    for (const key of keys) {
      merged[key] = mergeShapes(objects.filter((o) => key in o).map((o) => o[key]));
    }
    members.push(merged);
  }
  if (arrays.length > 0) {
    const items = arrays.flat();
    members.push(items.length === 0 ? [] : [mergeShapes(items)]);
  }

  if (members.length === 0) return [];
  if (members.length === 1) return members[0];
  const union = { $union: members } as unknown as { [key: string]: Shape };
  unions.add(union);
  return union;
}

function describe(value: unknown, depth: number): Shape {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (depth >= MAX_DEPTH) return DEPTH_MARKER;
  if (Array.isArray(value)) {
    return value.length === 0 ? [] : [mergeShapes(value.map((item) => describe(item, depth + 1)))];
  }
  if (typeof value === 'object') {
    const children = new Map<string, Shape[]>();
    for (const [key, child] of Object.entries(value)) {
      const name = isValueLikeKey(key) ? VALUE_KEY : key;
      const list = children.get(name) ?? [];
      list.push(describe(child, depth + 1));
      children.set(name, list);
    }
    const shape: { [key: string]: Shape } = {};
    for (const [name, list] of children)
      shape[name] = list.length === 1 ? list[0] : mergeShapes(list);
    return shape;
  }
  return typeof value;
}

/**
 * Returns the structure of a value with every value replaced by its type name, so the shape of an
 * API response can be recorded without leaking any personal data. Nesting deeper than eight levels
 * is cut off with "…".
 */
export function describeShape(value: unknown): unknown {
  return describe(value, 0);
}

/**
 * Describes one value as a pattern so a format can be recorded without the value: digits become
 * "9", ASCII letters "a", whitespace " ", other characters are kept, and strings are cut at 40
 * characters plus "…". Non-strings are described by their type name.
 */
export function describePattern(value: unknown): string {
  if (typeof value !== 'string') return value === null ? 'null' : typeof value;
  const pattern = [...value.slice(0, MAX_PATTERN_LENGTH)]
    .map((char) => {
      if (/\d/.test(char)) return '9';
      if (/[A-Za-z]/.test(char)) return 'a';
      if (/\s/.test(char)) return ' ';
      return char;
    })
    .join('');
  return value.length > MAX_PATTERN_LENGTH ? `${pattern}…` : pattern;
}
