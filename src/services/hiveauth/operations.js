// Queue operations carry app-only markers that must not reach the chain:
// `_edit` (a comment edit), `_reblog` (also reblog the new post to the author's
// blog) and a nested `comment_options` field (beneficiaries). Keychain handles
// these with requestPost; HiveAuth sends exact operations, so the markers are
// stripped and the extra operations are appended in chain order.

import { expandQueueOperation } from '../queue'
import { HiveAuthError } from './errors'

export function normalizeBroadcastOperation (operation) {
  try {
    return expandQueueOperation(operation)
  } catch {
    throw new HiveAuthError('Invalid operation for HiveAuth.', { code: 'protocol' })
  }
}
