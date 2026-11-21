// Minimal browser stand-in for Node's `querystring`.
//
// `@ecency/render-helper` imports `querystring` only to build the image-proxy
// query string (`format`, `mode`, optional `width`/`height`/`blur`). Keeping
// the call site on a tiny module avoids pulling `node-stdlib-browser` into the
// build just for one helper.

export function stringify (value, separator = '&', equals = '=') {
  if (!value || typeof value !== 'object') return ''
  return Object.keys(value)
    .filter(key => value[key] !== undefined)
    .map(key => encodeURIComponent(key) + equals + encodeURIComponent(String(value[key])))
    .join(separator)
}

export function parse (value) {
  const out = {}
  if (typeof value !== 'string' || value.length === 0) return out
  for (const part of value.split('&')) {
    if (!part) continue
    const index = part.indexOf('=')
    const key = decodeURIComponent((index === -1 ? part : part.slice(0, index)).replace(/\+/g, ' '))
    const item = decodeURIComponent((index === -1 ? '' : part.slice(index + 1)).replace(/\+/g, ' '))
    if (out[key] === undefined) out[key] = item
    else if (Array.isArray(out[key])) out[key].push(item)
    else out[key] = [out[key], item]
  }
  return out
}

export default { stringify, parse }
