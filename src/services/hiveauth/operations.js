// Queue operations carry two app-only markers that must not reach the chain:
// `_edit` (a comment edit) and a nested `comment_options` field (beneficiaries).
// Keychain handles these with requestPost; HiveAuth sends exact operations, so
// the comment options become a second operation.

import { HiveAuthError } from './errors'

export function normalizeBroadcastOperation (operation) {
  if (!Array.isArray(operation) || typeof operation[0] !== 'string' || !operation[1] || typeof operation[1] !== 'object') {
    throw new HiveAuthError('Invalid operation for HiveAuth.', { code: 'protocol' })
  }
  const normalized = JSON.parse(JSON.stringify(operation))
  const operations = [normalized]
  if (normalized[0] === 'comment') {
    if (normalized[1]._edit === true) delete normalized[1]._edit
    if (normalized[1].comment_options) {
      const commentOptions = normalized[1].comment_options
      delete normalized[1].comment_options
      operations.push(['comment_options', commentOptions])
    }
  }
  return operations
}
