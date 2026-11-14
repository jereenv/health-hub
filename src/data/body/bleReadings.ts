/** One fresh weigh-in from the Bluetooth scale, ready to store. */
export interface BleReadingInput {
  measuredAt: string;
  weightKg: number;
  impedanceOhm: number | null;
  rawPayload: string;
  deviceId: string;
}
