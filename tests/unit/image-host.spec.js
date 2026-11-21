import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  appendUploadHistory,
  buildImageSigningPayload,
  clearUploadHistory,
  imageHostErrorMessage,
  imageUploadUrl,
  MAX_UPLOAD_HISTORY,
  readUploadHistory,
  uploadImage,
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
