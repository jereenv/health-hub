const MAX_DEPTH = 8;
const DEPTH_MARKER = '…';

type Shape = string | Shape[] | { [key: string]: Shape };

function isPlainShape(shape: Shape): shape is { [key: string]: Shape } {
  return typeof shape === 'object' && !Array.isArray(shape);
}

/**
 * Combines the shapes of several values into one. Objects merge key by key, arrays merge their
 * item shapes, and differing primitive types are listed as "a | b". A mix of primitives and
 * containers (for example a nullable object) is listed under a `$union` key.
 */
function mergeShapes(shapes: Shape[]): Shape {
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
  return members.length === 1 ? members[0] : { $union: members };
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
    const shape: { [key: string]: Shape } = {};
    for (const [key, child] of Object.entries(value)) shape[key] = describe(child, depth + 1);
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
