import { Linking, PermissionsAndroid, Platform } from 'react-native';
import BleManager, { BleScanMode, BleState } from 'react-native-ble-manager';
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
  let cancelActiveScan: (() => void) | null = null;

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
      // The library has one global scan, so an older window must never stop a newer one.
      const previous = cancelActiveScan;
      cancelActiveScan = null;
      previous?.();

      return new Promise<ScalePeripheral | null>((resolve, reject) => {
        let settled = false;
        let subscription: { remove(): void } | null = null;
        const cancel = () => settle(null);
        const settle = (found: ScalePeripheral | null, error?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          subscription?.remove();
          if (cancelActiveScan === cancel) {
            cancelActiveScan = null;
            BleManager.stopScan().catch(() => undefined);
          }
          if (error === undefined) resolve(found);
          else reject(error);
        };
        const timer = setTimeout(cancel, timeoutMs);
        cancelActiveScan = cancel;
        subscription = BleManager.onDiscoverPeripheral((peripheral) => {
          const candidate = {
            id: peripheral.id,
            name: peripheral.name ?? peripheral.advertising?.localName ?? null,
          };
          if (match(candidate)) settle(candidate);
        });
        ensureStarted()
          .then(() => {
            // Cancelled while starting: do not begin a scan nobody is waiting for.
            if (settled) return;
            return BleManager.scan({
              serviceUUIDs: [SERVICE_UUID],
              seconds: 0,
              allowDuplicates: false,
              scanMode: BleScanMode.LowLatency,
            });
          })
          .then(() => {
            // The window may have ended while the scan was starting.
            if (settled && cancelActiveScan === null) return BleManager.stopScan();
          })
          // A scan that cannot start (Bluetooth off, scanning too often) is a failure, not "not found".
          .catch((error: unknown) => settle(null, error ?? new Error('scan failed')));
      });
    },

    async stopScan() {
      if (cancelActiveScan !== null) cancelActiveScan();
      else await BleManager.stopScan().catch(() => undefined);
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
        if (event.peripheral !== connectedId) return;
        // The scale dropped the link itself: forget it so a late write or disconnect does not use it.
        connectedId = null;
        listener();
      });
      return () => subscription.remove();
    },
  };
}
