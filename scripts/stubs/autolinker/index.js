// remarkable depends on autolinker for its optional `remarkable/linkify`
// entry point. The app aliases that entry point to src/utils/remarkableLinkify.js
// (linkify-it + the IANA TLD list), so this stub keeps the 1.9 MB package out
// of the install while leaving a harmless no-link fallback if it is ever used.
export default class Autolinker {
  link (text) {
    return text
  }
}
