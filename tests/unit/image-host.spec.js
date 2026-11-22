import { describe, expect, it, vi } from 'vitest'
import { createHash, webcrypto } from 'node:crypto'
import {
  appendUploadHistory,
  buildImageChecksumSigningPayload,
  buildImageSigningPayload,
  clearUploadHistory,
  createUploadQueue,
  formatUploadAge,
  formatUploadBytes,
  imageChecksumUploadUrl,
  imageHostErrorMessage,
  imageUploadUrl,
  isUploadAborted,
  MAX_UPLOAD_HISTORY,
  readUploadHistory,
  uploadImage,
  uploadQueueSummary,
  validateImageFile
} from '../../src/services/imageHost'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    get (key) { return map.get(key) ?? null },
    set (key, value) { map.set(key, value) },
    remove (key) { map.delete(key) }
  }
}

const png = { name: 'photo.png', type: 'image/png', size: 2048 }
const pngFile = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })

describe('image validation', () => {
  it('accepts common image formats and rejects HEIC and oversized files', () => {
    expect(validateImageFile(png)).toMatchObject({ ok: true })
    expect(validateImageFile({ name: 'photo.heic', type: 'image/heic', size: 100 }))
      .toMatchObject({ ok: false, error: expect.stringContaining('HEIC') })
    expect(validateImageFile({ name: 'notes.txt', type: 'text/plain', size: 100 }))
      .toMatchObject({ ok: false, error: expect.stringContaining('not an image') })
    expect(validateImageFile({ name: 'huge.jpg', type: 'image/jpeg', size: 31 * 1024 * 1024 }))
      .toMatchObject({ ok: false, error: expect.stringContaining('limited') })
  })

  it('builds the signed Buffer payload with the image challenge prefix', () => {
    const payload = JSON.parse(buildImageSigningPayload(new Uint8Array([4, 5, 6])))
    expect(payload.type).toBe('Buffer')
    const bytes = Uint8Array.from(payload.data)
    const prefix = new TextEncoder().encode('ImageSigningChallenge')
    expect(Array.from(bytes.slice(0, prefix.length))).toEqual(Array.from(prefix))
    expect(Array.from(bytes.slice(prefix.length))).toEqual([4, 5, 6])
  })

  it('hashes to the exact sha256 challenge the image host verifies', () => {
    const file = new Uint8Array([1, 2, 3, 4, 5])
    const payload = JSON.parse(buildImageSigningPayload(file))
    const signed = Buffer.from(payload.data)
    const digest = createHash('sha256').update(signed).digest('hex')
    const expected = createHash('sha256')
      .update(Buffer.concat([Buffer.from('ImageSigningChallenge'), Buffer.from(file)]))
      .digest('hex')
    expect(digest).toBe(expected)
  })

  it('builds the compact checksum challenge used by the image host /cs endpoint', async () => {
    const file = new Uint8Array([1, 2, 3, 4, 5])
    vi.stubGlobal('crypto', webcrypto)
    try {
      const payload = JSON.parse(await buildImageChecksumSigningPayload(file))
      const prefix = new TextEncoder().encode('ImageSigningChallenge')
      const bytes = Uint8Array.from(payload.data)
      expect(bytes).toHaveLength(prefix.length + 32)
      expect(Array.from(bytes.slice(0, prefix.length))).toEqual(Array.from(prefix))
      expect(Array.from(bytes.slice(prefix.length))).toEqual(
        Array.from(createHash('sha256').update(file).digest())
      )
      // This is what the PKSA signs: sha256(challenge + sha256(file)).
      const expected = createHash('sha256')
        .update(Buffer.concat([
          Buffer.from('ImageSigningChallenge'),
          createHash('sha256').update(file).digest()
        ]))
        .digest('hex')
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('image upload', () => {
  it('posts the file to the signed account URL and returns the public URL', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'https://images.hive.blog/DQmTest/photo.png' })
    }))
    const url = await uploadImage({
      username: 'ausbitbank',
      signature: 'abcdef',
      file: pngFile,
      fetchImpl
    })
    expect(url).toBe('https://images.hive.blog/DQmTest/photo.png')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe(imageUploadUrl('ausbitbank', 'abcdef'))
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST')
  })

  it('posts to the checksum endpoint when requested', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'https://images.hive.blog/DQmTest/photo.png' })
    }))
    await uploadImage({
      username: 'ausbitbank',
      signature: 'abcdef',
      file: pngFile,
      checksum: true,
      fetchImpl
    })
    expect(fetchImpl.mock.calls[0][0]).toBe(imageChecksumUploadUrl('ausbitbank', 'abcdef'))
    expect(fetchImpl.mock.calls[0][0]).toContain('/cs/ausbitbank/')
  })

  it('surfaces the host error name and maps friendly messages', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { name: 'invalid_signature', info: {} } })
    })
    let error
    try {
      await uploadImage({ username: 'ausbitbank', signature: 'bad', file: pngFile, fetchImpl })
    } catch (caught) {
      error = caught
    }
    expect(error.code).toBe('invalid_signature')
    expect(imageHostErrorMessage(error)).toContain('rejected the signature')
  })

  it('rejects an invalid returned URL', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ url: 'javascript:alert(1)' })
    })
    await expect(uploadImage({ username: 'ausbitbank', signature: 'sig', file: pngFile, fetchImpl }))
      .rejects.toThrow('invalid URL')
  })
})

describe('upload queue and labels', () => {
  it('formats byte sizes and relative upload times', () => {
    expect(formatUploadBytes(0)).toBe('')
    expect(formatUploadBytes(512)).toBe('512 B')
    expect(formatUploadBytes(2048)).toBe('2.0 KB')
    expect(formatUploadBytes(5 * 1024 * 1024)).toBe('5.0 MB')

    const now = Date.UTC(2026, 10, 22, 12, 0, 0)
    expect(formatUploadAge(now - 30 * 1000, now)).toBe('just now')
    expect(formatUploadAge(now - 5 * 60 * 1000, now)).toBe('5 min ago')
    expect(formatUploadAge(now - 3 * 60 * 60 * 1000, now)).toBe('3 hours ago')
    expect(formatUploadAge(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('2 days ago')
    expect(formatUploadAge(0, now)).toBe('')
  })

  it('builds a queue with stable ids and limits cover uploads to one file', () => {
    const files = [
      { name: 'one.png', size: 100, type: 'image/png' },
      { name: 'two.png', size: 200, type: 'image/png' }
    ]
    const queue = createUploadQueue(files, { now: 123, target: 'body' })
    expect(queue).toHaveLength(2)
    expect(queue[0]).toMatchObject({ name: 'one.png', size: 100, status: 'queued', progress: 0, alt: '' })
    expect(queue[0].id).not.toBe(queue[1].id)
    expect(createUploadQueue(files, { now: 123, target: 'cover' })).toHaveLength(1)
  })

  it('summarises queued, active, done, failed and cancelled rows', () => {
    const summary = uploadQueueSummary([
      { status: 'queued' },
      { status: 'signing' },
      { status: 'uploading' },
      { status: 'done' },
      { status: 'error' },
      { status: 'cancelled' }
    ])
    expect(summary).toMatchObject({
      total: 6,
      queued: 1,
      signing: 1,
      uploading: 1,
      done: 1,
      failed: 1,
      cancelled: 1,
      active: 3,
      finished: false
    })
    expect(uploadQueueSummary([])).toMatchObject({ total: 0, finished: true })
  })
})

describe('image upload progress and cancellation', () => {
  function fakeXhrFactory (behaviour) {
    const state = { instance: null }
    class FakeXhr {
      constructor () {
        this.upload = {}
        this.status = 0
        this.responseText = ''
        state.instance = this
      }

      open (method, url) {
        this.method = method
        this.url = url
      }

      send (form) {
        this.body = form
        behaviour(this)
      }

      abort () {
        this.aborted = true
        if (typeof this.onabort === 'function') this.onabort()
      }
    }
    return { factory: () => new FakeXhr(), state }
  }

  it('reports real upload progress through XHR', async () => {
    const { factory, state } = fakeXhrFactory(xhr => {
      xhr.upload.onprogress({ lengthComputable: true, total: 100, loaded: 25 })
      xhr.upload.onprogress({ lengthComputable: true, total: 100, loaded: 75 })
      xhr.status = 200
      xhr.responseText = JSON.stringify({ url: 'https://images.hive.blog/DQmTest/photo.png' })
      xhr.onload()
    })
    const progress = []
    const url = await uploadImage({
      username: 'ausbitbank',
      signature: 'sig',
      file: pngFile,
      xhrFactory: factory,
      onProgress: value => progress.push(value)
    })
    expect(url).toBe('https://images.hive.blog/DQmTest/photo.png')
    expect(progress).toEqual([0, 25, 75, 100])
    expect(state.instance.method).toBe('POST')
    expect(state.instance.url).toBe(imageUploadUrl('ausbitbank', 'sig'))
  })

  it('aborts an in-flight upload and reports an aborted error', async () => {
    const { factory, state } = fakeXhrFactory(() => {})
    const controller = new AbortController()
    const pending = uploadImage({
      username: 'ausbitbank',
      signature: 'sig',
      file: pngFile,
      xhrFactory: factory,
      signal: controller.signal
    })
    controller.abort()
    let error
    try {
      await pending
    } catch (caught) {
      error = caught
    }
    expect(state.instance.aborted).toBe(true)
    expect(isUploadAborted(error)).toBe(true)
    expect(error.message).toBe('Upload cancelled.')
  })

  it('maps non-2xx XHR responses to host errors', async () => {
    const { factory } = fakeXhrFactory(xhr => {
      xhr.status = 429
      xhr.responseText = JSON.stringify({ error: { name: 'rate_limit_exceeded' } })
      xhr.onload()
    })
    await expect(uploadImage({
      username: 'ausbitbank',
      signature: 'sig',
      file: pngFile,
      xhrFactory: factory
    })).rejects.toThrow('rate_limit_exceeded')
  })
})

describe('upload history', () => {
  it('keeps newest-first, deduplicated per account', () => {
    const storage = memoryStorage()
    appendUploadHistory(storage, 'alice', { url: 'https://images.hive.blog/one.jpg', alt: 'One' }, 1000)
    appendUploadHistory(storage, 'alice', { url: 'https://images.hive.blog/two.jpg', alt: 'Two' }, 2000)
    appendUploadHistory(storage, 'alice', { url: 'https://images.hive.blog/one.jpg', alt: 'One again' }, 3000)

    const list = readUploadHistory(storage, 'alice')
    expect(list.map(item => item.url)).toEqual([
      'https://images.hive.blog/one.jpg',
      'https://images.hive.blog/two.jpg'
    ])
    expect(list[0].alt).toBe('One again')
    expect(readUploadHistory(storage, 'bob')).toEqual([])
  })

  it('caps the list and clears it', () => {
    const storage = memoryStorage()
    for (let index = 0; index < MAX_UPLOAD_HISTORY + 5; index++) {
      appendUploadHistory(storage, 'alice', { url: 'https://images.hive.blog/' + index + '.jpg' }, index)
    }
    expect(readUploadHistory(storage, 'alice')).toHaveLength(MAX_UPLOAD_HISTORY)
    expect(clearUploadHistory(storage, 'alice')).toEqual([])
    expect(readUploadHistory(storage, 'alice')).toEqual([])
  })
})
