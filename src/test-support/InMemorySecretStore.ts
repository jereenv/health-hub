import type { SecretStore } from '@/data/secrets/SecretStore';

/** Test-only SecretStore backed by a Map; never use it for real credentials. */
export class InMemorySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}
