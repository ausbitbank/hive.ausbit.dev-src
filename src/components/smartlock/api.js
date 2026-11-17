import signature from '@hiveio/hive-js/lib/auth/ecc'
import { getPosting, getActive, getMemo } from './store'
import { Notify } from 'quasar'
import { hive } from 'src/services/hive'

const signBuffer = (username, data) => {
  // try to parse Buffer
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

  return signature.Signature.signBuffer(buf, getPosting(username)).toHex()
}

const broadcastAsync = async (username, operations, role = 'posting', password) => {
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
          encoded = hive.memo.encode(senderMemoKey, receiverMemoKey, memo)
        } else {
          encoded = hive.memo.encode(getPosting(username), receiverMemoKey, memo)
        }
        operations[0][1].memo = encoded
      } catch {
      }
    }
  }
  let auth = {}
  if (role.toLowerCase() === 'posting') {
    const postingKey = getPosting(username)
    auth = { posting: postingKey }
  } else if (role.toLowerCase() === 'active') {
    if (password) {
      const activeKey = getActive(username, password)
      auth = { active: activeKey }
    }
  }

  if (!auth[role]) {
    Notify.create({
      type: 'negative',
      message: 'The key required to sign this transaction is not available'
    })
    return Promise.reject(new Error('The key required to sign this transaction is not available!!'))
  }
  // if (operations.length === 1) { operations = [operations] }
  const result = await hive.broadcast.sendAsync({ extensions: [], operations: operations }, auth)
  return {
    success: result.id && result.id.length > 0,
    result: result
  }
}

export default {
  broadcastAsync,
  signBuffer
}
