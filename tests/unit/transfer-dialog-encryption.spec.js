import { describe, expect, it } from 'vitest'
import TransferDialog from '../../src/components/transferDialog.vue'

function context ({ network = 'hive', recurrent = false, loginType = 'smartlock', memo = '', encrypted = false } = {}) {
  const ctx = {
    network,
    recurrent,
    memo,
    encrypted,
    $hiveStore: { user: { loginType } }
  }
  ctx.canEncryptMemo = TransferDialog.computed.canEncryptMemo.call(ctx)
  return ctx
}

describe('transfer memo encryption', () => {
  it('is offered only for a SmartLock Hive transfer', () => {
    const canEncrypt = TransferDialog.computed.canEncryptMemo
    expect(canEncrypt.call(context())).toBe(true)
    expect(canEncrypt.call(context({ loginType: 'keychain' }))).toBe(false)
    expect(canEncrypt.call(context({ loginType: 'hiveauth' }))).toBe(false)
    expect(canEncrypt.call(context({ network: 'hiveEngine' }))).toBe(false)
    expect(canEncrypt.call(context({ recurrent: true }))).toBe(false)
  })

  it('does not add a fake # prefix for other signers', () => {
    const ctx = context({ loginType: 'keychain', memo: 'public note' })
    TransferDialog.methods.toggleEncryption.call(ctx)
    expect(ctx.memo).toBe('public note')
    expect(ctx.encrypted).toBe(false)

    TransferDialog.methods.checkEncryption.call(ctx)
    expect(ctx.encrypted).toBe(false)
  })

  it('toggles the prefix only when encryption is available', () => {
    const ctx = context()
    TransferDialog.methods.toggleEncryption.call(ctx)
    expect(ctx.memo).toBe('#')
    TransferDialog.methods.toggleEncryption.call(ctx)
    expect(ctx.memo).toBe('')
  })
})
