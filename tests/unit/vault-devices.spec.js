import { describe, expect, it } from 'vitest'
import {
  VAULT_DEVICE_MAX_KEYS,
  buildReaderDeviceOperation,
  hasReaderDevice,
  mergeReaderDevice,
  readReaderDevices,
  removeReaderDevice
} from '../../src/services/vaultDevices'

const BLOG = 'ausbit.vsc'
const ACCOUNT = 'ausbitclank'
const KEY_A = 'p256:' + 'A'.repeat(86)
const KEY_B = 'p256:' + 'B'.repeat(86)

function metadata (extra = {}) {
  return {
    profile: { name: 'Clank' },
    'banksia.io': {
      blog: { title: 'Existing blog', vault: { enabled: false } },
      ...extra
    }
  }
}

describe('vault reader device registry', () => {
  it('adds a device without clobbering the profile or blog settings', () => {
    const merged = mergeReaderDevice({
      account: ACCOUNT,
      metadata: metadata(),
      blog: BLOG,
      readerKey: KEY_A
    })

    expect(merged.ok).toBe(true)
    expect(merged.changed).toBe(true)
    expect(merged.metadata.profile.name).toBe('Clank')
    expect(merged.metadata['banksia.io'].blog.title).toBe('Existing blog')
    expect(readReaderDevices(merged.metadata, BLOG)).toEqual([KEY_A])
    expect(hasReaderDevice(merged.metadata, BLOG, KEY_A)).toBe(true)
    expect(merged.operation[0]).toBe('account_update2')
    expect(merged.operation[1].json_metadata).toBe('')
    expect(merged.operation[1].posting_json_metadata).toContain(KEY_A)
  })

  it('is idempotent and caps the number of devices per blog', () => {
    const first = mergeReaderDevice({ account: ACCOUNT, metadata: metadata(), blog: BLOG, readerKey: KEY_A })
    const again = mergeReaderDevice({ account: ACCOUNT, metadata: first.metadata, blog: BLOG, readerKey: KEY_A })
    expect(again.changed).toBe(false)
    expect(again.operation).toBeNull()

    let current = first
    for (let index = 0; index < VAULT_DEVICE_MAX_KEYS; index++) {
      const key = 'p256:' + String.fromCharCode(65 + index).repeat(86)
      current = mergeReaderDevice({ account: ACCOUNT, metadata: current.metadata, blog: BLOG, readerKey: key })
      expect(current.ok).toBe(true)
    }
    const tooMany = mergeReaderDevice({
      account: ACCOUNT,
      metadata: current.metadata,
      blog: BLOG,
      readerKey: 'p256:' + 'Z'.repeat(86)
    })
    expect(tooMany.ok).toBe(false)
    expect(tooMany.error).toMatch(/maximum/i)
  })

  it('removes one device and cleans up empty namespaces', () => {
    const first = mergeReaderDevice({ account: ACCOUNT, metadata: metadata(), blog: BLOG, readerKey: KEY_A })
    const second = mergeReaderDevice({ account: ACCOUNT, metadata: first.metadata, blog: BLOG, readerKey: KEY_B })
    expect(readReaderDevices(second.metadata, BLOG)).toEqual([KEY_A, KEY_B])

    const removed = removeReaderDevice({ account: ACCOUNT, metadata: second.metadata, blog: BLOG, readerKey: KEY_A })
    expect(removed.ok).toBe(true)
    expect(removed.changed).toBe(true)
    expect(readReaderDevices(removed.metadata, BLOG)).toEqual([KEY_B])

    const last = removeReaderDevice({ account: ACCOUNT, metadata: removed.metadata, blog: BLOG, readerKey: KEY_B })
    expect(last.ok).toBe(true)
    expect(readReaderDevices(last.metadata, BLOG)).toEqual([])
    expect(last.metadata['banksia.io'].blog.title).toBe('Existing blog')
    expect(last.metadata['banksia.io'].reader).toBeUndefined()
  })

  it('accepts the object form and ignores malformed keys', () => {
    const value = {
      'banksia.io': {
        reader: {
          v: 1,
          devices: {
            [BLOG]: [KEY_A, 'not-a-key', KEY_A]
          }
        }
      }
    }
    expect(readReaderDevices(value, BLOG)).toEqual([KEY_A])
    expect(readReaderDevices('{"banksia.io":{"reader":{"devices":{"' + BLOG + '":["' + KEY_A + '"]}}}}', BLOG)).toEqual([KEY_A])
    expect(readReaderDevices('not json', BLOG)).toEqual([])
  })

  it('builds an account_update2 operation and rejects invalid input', () => {
    const value = metadata()
    const operation = buildReaderDeviceOperation(ACCOUNT, value)
    expect(operation[0]).toBe('account_update2')
    expect(operation[1].account).toBe(ACCOUNT)
    expect(buildReaderDeviceOperation('bad name', value)).toBeNull()

    expect(mergeReaderDevice({ account: ACCOUNT, metadata: {}, blog: BLOG, readerKey: 'nope' }).ok).toBe(false)
    expect(mergeReaderDevice({ account: ACCOUNT, metadata: {}, blog: 'bad blog', readerKey: KEY_A }).ok).toBe(false)
  })
})
