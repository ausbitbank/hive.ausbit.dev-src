// Lightweight image probing for the composer publish checklist.
//
// Probe naturally loaded images with `Image()` so naturalWidth/naturalHeight are
// available without canvas or CORS configuration. Nothing is uploaded, cached
// or persisted here; results only feed advisory warnings.

import { safeExternalUrl } from '../utils/safeUrl'

export const MIN_COVER_WIDTH = 640
export const MIN_COVER_HEIGHT = 320
export const IMAGE_PROBE_TIMEOUT_MS = 8000
export const IMAGE_PROBE_CONCURRENCY = 4

function result (url, status, width = 0, height = 0) {
  return { url, status, width, height }
}

/**
 * Probe one image URL. `ImageImpl` is injectable for tests.
 * Status is `ok`, `broken`, `invalid`, `timeout` or `unknown` (no Image API).
 */
export function probeImage (url, {
  ImageImpl = null,
  timeoutMs = IMAGE_PROBE_TIMEOUT_MS
} = {}) {
  const safe = safeExternalUrl(url)
  if (!safe) return Promise.resolve(result(String(url || ''), 'invalid'))
  const ImageCtor = ImageImpl || (typeof Image !== 'undefined' ? Image : null)
  if (!ImageCtor) return Promise.resolve(result(safe, 'unknown'))

  return new Promise(resolve => {
    let settled = false
    let timer = null
    const image = new ImageCtor()

    const finish = (status, width = 0, height = 0) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(result(safe, status, width, height))
    }

    timer = setTimeout(() => finish('timeout'), Math.max(1, Number(timeoutMs) || IMAGE_PROBE_TIMEOUT_MS))
    image.onload = () => {
      const width = Number(image.naturalWidth) || 0
      const height = Number(image.naturalHeight) || 0
      finish(width > 0 && height > 0 ? 'ok' : 'broken', width, height)
    }
    image.onerror = () => finish('broken')

    try {
      image.src = safe
    } catch {
      finish('invalid')
    }
  })
}

export async function probeImages (urls, options = {}) {
  const unique = [...new Set(
    (Array.isArray(urls) ? urls : [])
      .map(url => safeExternalUrl(url))
      .filter(Boolean)
  )]
  const results = new Array(unique.length)
  let next = 0
  const worker = async () => {
    while (next < unique.length) {
      const index = next
      next += 1
      results[index] = await probeImage(unique[index], options)
    }
  }
  const workers = Math.min(IMAGE_PROBE_CONCURRENCY, unique.length)
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}

/**
 * Summarise probe results for the checklist.
 * `broken` includes failed, invalid and timed-out images.
 */
export function analyzeImageHealth (results, { coverUrl = null } = {}) {
  const list = Array.isArray(results) ? results.filter(Boolean) : []
  const cover = safeExternalUrl(coverUrl)
  const broken = list.filter(item => item.status === 'broken' || item.status === 'invalid' || item.status === 'timeout')
  const coverResult = cover ? list.find(item => item.url === cover) || null : null
  const coverIssues = []

  if (coverResult && coverResult.status === 'ok') {
    if (coverResult.width < MIN_COVER_WIDTH || coverResult.height < MIN_COVER_HEIGHT) {
      coverIssues.push({
        code: 'small',
        width: coverResult.width,
        height: coverResult.height
      })
    }
    if (coverResult.height > coverResult.width) {
      coverIssues.push({
        code: 'portrait',
        width: coverResult.width,
        height: coverResult.height
      })
    }
  }

  return { results: list, broken, cover: coverResult, coverIssues }
}

export async function probeImageHealth (urls, { coverUrl = null, ...options } = {}) {
  const results = await probeImages(urls, options)
  return analyzeImageHealth(results, { coverUrl })
}

/** One readable sentence for the cover quality warning. */
export function coverIssueDetail (issues) {
  const list = Array.isArray(issues) ? issues : []
  if (!list.length) return ''
  const first = list[0]
  const size = first.width + '×' + first.height
  const reasons = []
  if (list.some(issue => issue.code === 'portrait')) reasons.push('portrait')
  if (list.some(issue => issue.code === 'small')) reasons.push('below ' + MIN_COVER_WIDTH + '×' + MIN_COVER_HEIGHT)
  return 'The cover is ' + size +
    (reasons.length ? ' (' + reasons.join(', ') + ')' : '') +
    '. A landscape image at least ' + MIN_COVER_WIDTH + '×' + MIN_COVER_HEIGHT +
    ' keeps cards and link previews sharp.'
}
