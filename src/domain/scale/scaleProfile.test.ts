import { encodeFrame } from './frameCodec';
import { encodeProfile, type ScaleProfileInput } from './scaleProfile';
import { CMD } from './protocol';

const base: ScaleProfileInput = {
  sex: 'male',
  heightCm: 175,
  birthDate: '1996-01-01',
  lastWeightKg: 80,
  today: '2026-11-13',
};

const payloadOf = (frame: number[]) => frame.slice(7, frame.length - 1);

test('encodeProfile for the documented synthetic example', () => {
  const frame = encodeProfile(base, 0x4848);
  expect(frame).toEqual(
    encodeFrame(CMD.PROFILE, [0x00, 0x00, 0x48, 0x48, 0x01, 0xaf, 0x1e, 0x00, 0x00, 0x03, 0x20]),
  );
  expect(frame[4]).toBe(0x13);
  expect(frame[frame.length - 1]).toBe(0x98);
});

test('the user id is written big-endian', () => {
  expect(payloadOf(encodeProfile(base, 0x4801)).slice(2, 4)).toEqual([0x48, 0x01]);
});

test.each([
  ['sex null', { sex: null }, 4, 0x01],
  ['sex female', { sex: 'female' as const }, 4, 0x00],
  ['height null', { heightCm: null }, 5, 175],
  ['height 90', { heightCm: 90 }, 5, 175],
  ['height 180.4 rounds', { heightCm: 180.4 }, 5, 180],
  ['birthDate null', { birthDate: null }, 6, 30],
  ['age 8', { birthDate: '2018-01-01' }, 6, 30],
])('%s', (_name, override, index, expected) => {
  expect(payloadOf(encodeProfile({ ...base, ...override }, 0x4801))[index]).toBe(expected);
});

test.each([
  ['null', null, [0x00, 0x00]],
  ['80.04 rounds to 0x0320', 80.04, [0x03, 0x20]],
])('last weight %s', (_name, lastWeightKg, expected) => {
  expect(payloadOf(encodeProfile({ ...base, lastWeightKg }, 0x4801)).slice(9)).toEqual(expected);
});
