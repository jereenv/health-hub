import * as SecureStore from 'expo-secure-store';

import type { SecretStore } from './SecretStore';

/**
 * Writes with WHEN_UNLOCKED_THIS_DEVICE_ONLY so an iOS keychain item is never
 * included in backups or migrated to another device. The option is iOS-only;
 * Android already keeps these values in the Keystore and ignores it.
 */
const WRITE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Device secure storage (iOS Keychain / Android Keystore) behind the SecretStore interface. */
export function createExpoSecretStore(): SecretStore {
  return {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value, WRITE_OPTIONS),
    delete: (key) => SecureStore.deleteItemAsync(key),
  };
}
