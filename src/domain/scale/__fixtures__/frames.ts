// Synthetic frames for tests. Written independently of encodeFrame so the codec is checked against
// the documented layout, not against itself. No real weights or impedances appear here.

export function buildFrame(cmd: number, payload: readonly number[]): number[] {
  const len = payload.length + 8;
  const body = [len, 0x03, cmd, ...payload];
  const cs = body.reduce((sum, byte) => sum + byte, 0) & 0xff;
  return [0x10, 0x00, 0x00, 0xc5, ...body, cs];
}

export function liveFrame(kg10: number, stable: boolean): number[] {
  return buildFrame(0x80, [
    (kg10 >> 8) & 0xff,
    kg10 & 0xff,
    0x00,
    0x00,
    0x01,
    stable ? 0xaa : 0xa0,
  ]);
}

export interface ResultOptions {
  kind: number;
  kg10: number;
  impedance: number;
  offset5?: number;
  offset7?: number;
}

/** 23-byte payload (LEN 0x1F), zero padded, impedance at offset 9. */
export function resultFrame({
  kind,
  kg10,
  impedance,
  offset5 = 0,
  offset7 = 0,
}: ResultOptions): number[] {
  const payload = new Array<number>(23).fill(0);
  payload[0] = kind;
  payload[1] = 0x48;
  payload[2] = 0x48;
  payload[3] = (kg10 >> 8) & 0xff;
  payload[4] = kg10 & 0xff;
  payload[5] = (offset5 >> 8) & 0xff;
  payload[6] = offset5 & 0xff;
  payload[7] = (offset7 >> 8) & 0xff;
  payload[8] = offset7 & 0xff;
  payload[9] = (impedance >> 8) & 0xff;
  payload[10] = impedance & 0xff;
  return buildFrame(0x82, payload);
}

export function split(frame: readonly number[], at: number): [number[], number[]] {
  return [frame.slice(0, at), frame.slice(at)];
}
