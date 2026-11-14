import type { OffReason } from '@/domain/scale/scaleSession';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export interface ScalePeripheral {
  id: string;
  name: string | null;
}

/** Everything the runner needs from Bluetooth. No native imports, so tests use an in-memory fake. */
export interface ScaleTransport {
  /** 'unsupported' below Android 12; otherwise permission and Bluetooth state. */
  preflight(): Promise<'ok' | OffReason>;
  requestPermissions(): Promise<PermissionResult>;
  enableBluetooth(): Promise<boolean>;
  openSettings(): Promise<void>;
  /** Resolves with the first match (scan stopped) or null on timeout or when stopScan() cancels it. Rejects when the scan cannot start. */
  scan(match: (p: ScalePeripheral) => boolean, timeoutMs: number): Promise<ScalePeripheral | null>;
  stopScan(): Promise<void>;
  /** Connects, discovers services, enables notifications. Resolves false on failure or timeout. */
  connect(peripheralId: string, timeoutMs: number): Promise<boolean>;
  /** Write-without-response to FFF2. */
  write(bytes: readonly number[]): Promise<void>;
  disconnect(): Promise<void>;
  onBytes(listener: (bytes: number[]) => void): () => void;
  onDisconnected(listener: () => void): () => void;
}
