// Vitest runs with `pool: 'vmThreads'` so one jsdom environment is reused per
// worker. The vm sandbox does not always expose Node's WebCrypto, which the
// hive-tx signing helpers rely on.
import { webcrypto } from 'node:crypto'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto
} else if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: webcrypto.subtle,
    configurable: true
  })
}
