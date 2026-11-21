import { Notify } from 'quasar'
import { hive } from 'src/services/hive'
import {
  broadcastOperations,
  encodeMemo,
  signBufferData,
  toPublicKey
} from 'src/services/hiveTx'
import { getPosting, getActive, getMemo } from './store'

const signBuffer = async (username, data) => {
  const wif = getPosting(username)
  if (!wif) throw new Error('SmartLock is locked. Unlock it to sign this request.')

  // Some callers pass a JSON-serialised Node Buffer. Preserve that shape and
  // sign the bytes, matching Keychain's requestSignBuffer behaviour.
  let buf = data
  try {
    const o = JSON.parse(buf, (k, v) => {
      if (v !== null && typeof v === 'object' && 'type' in v && v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
        return Buffer.from(v.data)
      }
      return v
    })
    if (Buffer.isBuffer(o)) {
      buf = o
    }
  } catch {}

  return signBufferData(buf, wif)
}

// Sign a plain text challenge and return the matching public key. Used by the
// read-only v4v.app session, which needs both halves of the proof.
const signBufferWithPublicKey = async (username, data) => {
  const wif = getPosting(username)
  if (!wif) throw new Error('SmartLock is locked. Unlock it to connect to v4v.app.')
  return {
    signature: await signBufferData(data, wif),
    publicKey: await toPublicKey(wif)
  }
}

const broadcastAsync = async (username, operations, role = 'posting', password) => {
  if (operations[0][0] === 'comment' && operations[0][1]._edit) {
    // Queue-only marker used to label edits; the chain rejects unknown fields.
    delete operations[0][1]._edit
  }
  if (operations[0][0] === 'comment' && operations[0][1].comment_options) {
    // `comment_options` is a separate operation, not a field of `comment`.
    // Preserve the beneficiary settings chosen by the user.
    const commentOptions = operations[0][1].comment_options
    delete operations[0][1].comment_options
    operations.push(['comment_options', commentOptions])
  }
  if (operations[0][0] === 'transfer' && password) {
    var memo = operations[0][1].memo
    if (memo && memo.length > 0 && memo[0] === '#') {
      try {
        const receiver = await hive.api.getAccountsAsync([operations[0][1].to])
        if (!receiver) { throw new Error('Failed to load memo key of receiver') }
        const receiverMemoKey = receiver[0].memo_key
        const senderMemoKey = getMemo(username, password)
        if (!senderMemoKey) { throw new Error('Failed to load own memo key') }
        var encoded = ''
        if (senderMemoKey) {
          encoded = await encodeMemo(senderMemoKey, receiverMemoKey, memo)
        } else {
          encoded = await encodeMemo(getPosting(username), receiverMemoKey, memo)
        }
        operations[0][1].memo = encoded
      } catch {
      }
    }
  }

  const normalizedRole = String(role || '').toLowerCase()
  let wif = null
  if (normalizedRole === 'posting') {
    wif = getPosting(username)
  } else if (normalizedRole === 'active') {
    if (password) {
      wif = getActive(username, password)
    }
  }

  if (!wif) {
    Notify.create({
      type: 'negative',
      message: 'The key required to sign this transaction is not available'
    })
    return Promise.reject(new Error('The key required to sign this transaction is not available!!'))
  }

  const { tx_id } = await broadcastOperations(operations, wif)
  return {
    success: Boolean(tx_id),
    result: { id: tx_id }
  }
}

export default {
  broadcastAsync,
  signBuffer,
  signBufferWithPublicKey
}
