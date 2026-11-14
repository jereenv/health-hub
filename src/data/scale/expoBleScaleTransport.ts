import { Linking, PermissionsAndroid, Platform } from 'react-native';
import BleManager, { BleState } from 'react-native-ble-manager';
import { NOTIFY_CHARACTERISTIC, SERVICE_UUID, WRITE_CHARACTERISTIC } from '@/domain/scale/protocol';
import type { PermissionResult, ScalePeripheral, ScaleTransport } from './ScaleTransport';

/** Android 12 (API 31) introduced the BLUETOOTH_SCAN and BLUETOOTH_CONNECT runtime permissions. */
const MIN_ANDROID_API = 31;
const PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
] as const;

/** The scale uses 16-bit UUIDs; Android may report them short or in the full 128-bit form. */
function isNotifyCharacteristic(uuid: string): boolean {
  return uuid.toLowerCase().includes(NOTIFY_CHARACTERISTIC.slice(4, 8));
}

/** The only file that talks to react-native-ble-manager. Never logs bytes. */
export function createExpoBleScaleTransport(): ScaleTransport {
  let starting: Promise<void> | null = null;
  let connectedId: string | null = null;

  function ensureStarted(): Promise<void> {
    starting ??= BleManager.start({ showAlert: false }).catch((error: unknown) => {
      starting = null;
      throw error;
    });
    return starting;
  }

  return {
    async preflight() {
      if (Number(Platform.Version) < MIN_ANDROID_API) return 'unsupported';
      const granted = await Promise.all(
        PERMISSIONS.map((permission) => PermissionsAndroid.check(permission)),
      );
      if (!granted.every(Boolean)) return 'permission_needed';
      await ensureStarted();
      return (await BleManager.checkState()) === BleState.On ? 'ok' : 'bluetooth_off';
    },

    async requestPermissions(): Promise<PermissionResult> {
      const results = await PermissionsAndroid.requestMultiple([...PERMISSIONS]);
      const values = Object.values(results);
      if (values.every((value) => value === PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
      return values.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) ? 'blocked' : 'denied';
    },

    async enableBluetooth() {
      try {
        await ensureStarted();
        await BleManager.enableBluetooth();
        return true;
      } catch {
        return false;
      }
    },

    async openSettings() {
      await Linking.openSettings();
    },

    scan(match, timeoutMs) {
      return new Promise<ScalePeripheral | null>((resolve) => {
        let settled = false;
        let subscription: { remove(): void } | null = null;
        const finish = (found: ScalePeripheral | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          subscription?.remove();
          BleManager.stopScan().catch(() => undefined);
          resolve(found);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        subscription = BleManager.onDiscoverPeripheral((peripheral) => {
          const candidate = {
            id: peripheral.id,
            name: peripheral.name ?? peripheral.advertising?.localName ?? null,
          };
          if (match(candidate)) finish(candidate);
        });
        ensureStarted()
          .then(() =>
            BleManager.scan({ serviceUUIDs: [SERVICE_UUID], seconds: 0, allowDuplicates: false }),
          )
          .then(() => {
            // The window may have ended while the scan was starting.
            if (settled) return BleManager.stopScan();
          })
          .catch(() => finish(null));
      });
    },

    async stopScan() {
      await BleManager.stopScan().catch(() => undefined);
    },

    async connect(peripheralId, timeoutMs) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      });
      const attempt = (async () => {
        await ensureStarted();
        await BleManager.connect(peripheralId);
        await BleManager.retrieveServices(peripheralId);
        await BleManager.startNotification(peripheralId, SERVICE_UUID, NOTIFY_CHARACTERISTIC);
        return true as const;
      })().catch(() => false as const);
      const ok = await Promise.race([attempt, timeout]);
      clearTimeout(timer);
      if (ok) {
        connectedId = peripheralId;
      } else {
        await BleManager.disconnect(peripheralId).catch(() => undefined);
      }
      return ok;
    },

    async write(bytes) {
      if (connectedId === null) throw new Error('not connected');
      await BleManager.writeWithoutResponse(connectedId, SERVICE_UUID, WRITE_CHARACTERISTIC, [
        ...bytes,
      ]);
    },

    async disconnect() {
      const id = connectedId;
      connectedId = null;
      if (id !== null) await BleManager.disconnect(id).catch(() => undefined);
    },

    onBytes(listener) {
      const subscription = BleManager.onDidUpdateValueForCharacteristic((event) => {
        if (event.peripheral === connectedId && isNotifyCharacteristic(event.characteristic)) {
          listener([...event.value]);
        }
      });
      return () => subscription.remove();
    },

    onDisconnected(listener) {
      const subscription = BleManager.onDisconnectPeripheral((event) => {
        if (event.peripheral === connectedId) listener();
      });
      return () => subscription.remove();
    },
  };
}
