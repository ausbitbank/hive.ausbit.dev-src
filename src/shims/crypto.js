// Browser stand-in for Node's `crypto` module.
//
// `sjcl` feature-detects Node and calls `require('crypto').randomBytes` inside
// a try/catch before falling back to `window.crypto.getRandomValues`. Without
// this shim the Node polyfill plugin bundles the whole `crypto-browserify`
// dependency tree (bn.js, elliptic, readable-stream, ...) into the lazy
// SmartLock chunk just so that probe can fail.
//
// Exposing no `randomBytes` keeps sjcl on the browser WebCrypto path while
// letting the dependency stay out of the bundle.
export const randomBytes = undefined

export default { randomBytes }
