// Shared data plumbing for the "your account" dashboard widgets.
//
// The wallet, witness, witness-health and notification widgets all need the
// same few things: which account a widget is about (its own setting, or the
// signed-in user), that account record, global properties and Hive prices.
// Doing this here means four widgets sharing `/@me` cost one cached request
// through `chainData.js` instead of four.
//
// `useAccountWidget` is an options-style factory rather than a composable
// because the whole app is Options API; it returns methods computed for `this`.

import { fetchAccount, fetchGlobalProps } from 'src/services/chainData'
import { getHivePrices } from 'src/services/prices'

/**
 * Resolve which account a widget is about.
 * `settings.account` (explicit) -> signed-in user -> '' (guest).
 */
export function resolveWidgetAccount (settings = {}, username = '') {
  return String(settings?.account || username || '').trim()
}

export function useSignedInUsername (vm) {
  return vm?.$hiveStore?.user?.username || ''
}

/**
 * Load `{ account, globalProps, prices }` for the dashboard widget mounted as
 * `vm`. `getSettings()` returns the instance settings so the widget can react
 * to its own configuration without knowing the dashboard grid internals.
 *
 * Returns `{ ok, accountName, account, globalProps, prices, error }`.
 */
export async function loadAccountWidgetData (vm, { getSettings = () => ({}) } = {}) {
  const username = useSignedInUsername(vm)
  const accountName = resolveWidgetAccount(getSettings(), username)
  if (!accountName) return { ok: false, guest: true, accountName: '' }
  try {
    const [account, globalProps, prices] = await Promise.all([
      fetchAccount(accountName),
      fetchGlobalProps().catch(() => null),
      getHivePrices().catch(() => null)
    ])
    return {
      ok: Boolean(account),
      guest: false,
      accountName,
      account: account || null,
      globalProps: globalProps || null,
      prices: prices || null,
      error: account ? '' : 'Account @' + accountName + ' was not found.'
    }
  } catch (error) {
    console.error('Failed to load dashboard account data for @' + accountName, error)
    return { ok: false, guest: false, accountName, error: 'Could not load @' + accountName + '.' }
  }
}
