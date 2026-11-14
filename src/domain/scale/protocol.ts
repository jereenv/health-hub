// Constants for the owner's Bluetooth scale (TF-4001, advertises as IF_B2A). Values come from the
// Plan 5 protocol note and rulings; the on-device ladder in Ruling 1 only ever changes constants here.

export const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
export const NOTIFY_CHARACTERISTIC = '0000fff1-0000-1000-8000-00805f9b34fb';
export const WRITE_CHARACTERISTIC = '0000fff2-0000-1000-8000-00805f9b34fb';
export const SCALE_NAME = 'IF_B2A';

/** Every frame, in both directions, starts with these four bytes. */
export const HEADER = [0x10, 0x00, 0x00, 0xc5] as const;

export const CMD = {
  LIVE: 0x80,
  PROFILE_ACK: 0x81,
  RESULT: 0x82,
  STATUS: 0x8d,
  HANDSHAKE: 0x0d,
  PROFILE: 0x01,
  REQUEST_RESULT: 0x02,
} as const;

/** Payload offset of the u16 big-endian impedance in a result (Plan 4 Ruling 3). */
export const IMPEDANCE_OFFSET = 9;

export const KIND_FRESH = 0x00;
export const KIND_REPLAY = 0xff;

export const FLAG_SETTLING = 0xa0;
export const FLAG_STABLE = 0xaa;

export const MAX_FRAME_LEN = 40;
export const STALE_PARTIAL_MS = 1_000;

export const HEALTH_HUB_USER_ID = 0x4801;
export const FALLBACK_USER_ID = 0x0001;

export const WRITE_GAP_MS = 150;
/** Ruling 1, ladder rung (a): set to 2000 if no fresh result arrives after a stable reading. */
export const RESEND_PROFILE_AFTER_STABLE_MS: number | null = null;

export type HandshakeStep = 'handshake' | 'profile' | 'request_result';
export const HANDSHAKE_STEPS: readonly HandshakeStep[] = ['handshake', 'profile'];

export const SCAN_TIMEOUT_MS = 30_000;
export const MAX_SCAN_WINDOWS = 20;
export const CONNECT_TIMEOUT_MS = 10_000;
export const MAX_AUTO_RECONNECTS = 2;
export const RECONNECT_DELAY_MS = 1_000;

export const MIN_BLE_WEIGHT_KG = 20;
export const MAX_BLE_WEIGHT_KG = 400;
