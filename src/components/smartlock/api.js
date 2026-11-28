import { Notify } from 'quasar'
import { hive } from 'src/services/hive'
import {
  broadcastOperations,
  encodeMemo,
  signBufferData,
  toPublicKey
} from 'src/services/hiveTx'
import { expandQueueOperation } from 'src/services/queue'
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
        return Uint8Array.from(v.data)
      }
      return v
    })
    if (o instanceof Uint8Array) {
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
  // Strip queue-only markers, split comment options and append an optional
  // self-reblog so the chain receives plain operations in the right order.
  const chainOperations = operations.flatMap(operation => expandQueueOperation(operation, username))
  const needsEncryption = operation => operation?.[0] === 'transfer' &&
    typeof operation[1]?.memo === 'string' &&
    operation[1].memo.startsWith('#')
  const unsupportedMemo = chainOperations.find(operation =>
    operation?.[1]?.memo?.startsWith?.('#') && operation[0] !== 'transfer')
  if (unsupportedMemo) {
    throw new Error('Encrypted memos are only supported on direct transfers. Nothing was broadcast.')
  }
  for (const operation of chainOperations) {
    if (!needsEncryption(operation)) continue
    if (!password) {
      throw new Error('SmartLock needs the memo password to encrypt this #memo; nothing was broadcast.')
    }
    try {
      const receiver = await hive.api.getAccountsAsync([operation[1].to])
      if (!receiver?.length) throw new Error('Failed to load memo key of receiver')
      const receiverMemoKey = receiver[0].memo_key
      const senderMemoKey = getMemo(username, password)
      if (!senderMemoKey) throw new Error('Failed to load own memo key')
      operation[1].memo = await encodeMemo(senderMemoKey, receiverMemoKey, operation[1].memo)
    } catch (error) {
      throw new Error('The memo could not be encrypted; nothing was broadcast. ' + (error?.message || ''), { cause: error })
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

  const { tx_id } = await broadcastOperations(chainOperations, wif)
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
