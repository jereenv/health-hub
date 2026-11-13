// Jest global setup.
//
// The domain and data layers are deliberately free of React Native / Expo
// runtime imports, so their unit and integration suites run as pure Node with
// no native mocks required. Persistence, secrets and the Lyfta client are
// injected via interfaces, letting tests supply in-memory fakes and sql.js.
//
// The one shim we need: jest-expo installs Expo's "winter" TextDecoder/TextEncoder
// polyfills, and the suites fail to start with them in place. We restore Node's
// spec-complete implementations. This runs in setupFilesAfterEnv, i.e. after
// the preset's polyfills, so ours wins.
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

Object.defineProperty(globalThis, 'TextDecoder', {
  value: NodeTextDecoder,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'TextEncoder', {
  value: NodeTextEncoder,
  configurable: true,
  writable: true,
});
