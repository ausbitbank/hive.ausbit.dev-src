import hive from '@hiveio/hive-js'
import signature from '@hiveio/hive-js/lib/auth/ecc'
import { getPosting, getActive, getMemo } from './store'
import { Notify } from 'quasar'

const signBuffer = (username, data) => {
  // try to parse Buffer
  let buf = data
  try {
    const o = JSON.parse(buf, (k, v) => {
      if (v !== null && typeof v === 'object' && 'type' in v && v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
        return new Buffer(v.data) // eslint-disable-line node/no-deprecated-api
      }
      return v
    })
    if (Buffer.isBuffer(o)) {
      buf = o
    }
  } catch (e) {}

  return signature.Signature.signBuffer(buf, getPosting(username)).toHex()
}

const broadcastAsync = async (username, operations, role = 'posting', password) => {
  if (operations[0][0] === 'comment' && operations[0][1].comment_options) {
    var commentOptions = operations[0][1].comment_options
    delete operations[0][1].comment_options
    operations.push(['comment_options', { author: commentOptions.author, permlink: commentOptions.permlink, max_accepted_payout: commentOptions.max_accepted_payout, percent_hbd: commentOptions.percent_hbd, allow_votes: commentOptions.allow_votes, allow_curation_rewards: commentOptions.allow_curation_rewards, extensions: [[0, { beneficiaries: [{ account: 'ausbit.dev', weight: 1000 }] }]] }])
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
