/** Names of the secrets the app stores. Values never appear in code, logs or the database. */
export const SECRET_KEYS = { lyftaApiKey: 'lyfta_api_key' } as const;

/**
 * Storage for credentials. Implementations must never log or otherwise expose
 * the values they hold.
 */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
