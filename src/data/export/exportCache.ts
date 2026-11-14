/** The folder under the app cache that holds files made for sharing. */
export const EXPORT_CACHE_DIR = 'health-hub-export';

const FALLBACK_NAME = 'export';

/**
 * A file name that is safe to create: only letters, digits, dot, dash and underscore survive,
 * anything else (slashes included) becomes '-'. Never empty and never starts with a dot.
 */
export function safeExportFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  return cleaned.length === 0 ? FALLBACK_NAME : cleaned;
}
