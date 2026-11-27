// Shop bridge for Banksia Vault membership products.
//
// A membership is a normal Hive Open Market subscription product, but its
// purchase memo must also carry the reader's P-256 public key and a subscription
// id (`banksia` in the memo) so the creator can wrap the ring key. A generic
// `/pay` or cart transfer would look valid to HOM and invalid to Vault.
//
// This module only detects the product type and builds the apex Subscribe URL.
// It never reads key material, changes Vault metadata or builds a payment.

import { parseVaultProduct } from './vaultProduct'

/** The parsed membership plan for a shop Product, or null. */
export function membershipFromProduct (product) {
  if (!product) return null
  return parseVaultProduct(product.post || product)
}

export function isMembershipProduct (product) {
  return Boolean(membershipFromProduct(product))
}

/**
 * Canonical apex Subscribe URL for a membership product.
 *
 * `absolute` is used on a blog host, where `/subscribe` belongs to the apex and
 * the blog route table deliberately has no signing flow.
 */
export function membershipSubscribeUrl (product, { absolute = false } = {}) {
  const membership = membershipFromProduct(product)
  if (!membership || !membership.author || !membership.permlink) return ''
  const query = '?blog=' + encodeURIComponent(membership.author) +
    '&product=' + encodeURIComponent(membership.author + '/' + membership.permlink)
  return (absolute ? 'https://banksia.io' : '') + '/subscribe' + query
}

/** Badge text for cards and order rows. */
export function membershipBadgeLabel () {
  return 'Membership'
}
