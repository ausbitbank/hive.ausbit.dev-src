// Pure helpers for the customise bar and the add-widget drawer.
//
// Kept out of the components so the catalogue grouping, availability rules and
// draft/save semantics can be unit tested without mounting Quasar.

import {
  MAX_WIDGETS,
  WIDGET_CATEGORIES,
  WIDGET_REGISTRY,
  canAddWidget,
  defaultSettingsFor,
  insertWidget,
  isDefaultLayout,
  moveWidget,
  removeWidget,
  setWidgetWidth,
  updateWidgetSettings,
  widgetMeta,
  widthChoicesFor
} from './dashboardLayout'
import { HOME_MARKET_CURRENCIES, MAX_HOME_MARKET_COINS } from './homeMarket'
import { SAFETY_SOURCES } from './accountSafety'
import { OPERATION_FILTER_CHOICES } from './operationsFeed'
import { ACCOUNT_FEED_SORTS, FEED_REFERENCE_PLACEHOLDER } from './feedReference'

/**
 * Catalogue for the drawer: one group per category, in the registry's declared
 * category order, with each entry annotated for the current layout.
 *
 * `requiresAccount` widgets stay addable for guests — the registry keeps them
 * in the layout and the widget shows a log-in prompt (`note`) instead of data.
 *
 * Returns `[{ id, label, widgets: [{ type, label, description, icon, added,
 * limitReached, disabled, reason, note }] }]`.
 */
export function widgetCatalogue (layout = [], { signedIn = true } = {}) {
  const widgets = Array.isArray(layout) ? layout : []
  const groups = WIDGET_CATEGORIES.map(category => ({ id: category.id, label: category.label, widgets: [] }))
  const byId = new Map(groups.map(group => [group.id, group]))

  for (const entry of WIDGET_REGISTRY) {
    const group = byId.get(entry.category)
    if (!group) continue
    const check = canAddWidget(widgets, entry.type)
    const needsAccount = Boolean(entry.requiresAccount) && !signedIn
    group.widgets.push({
      type: entry.type,
      label: entry.label,
      description: entry.description,
      icon: entry.icon,
      added: widgets.some(widget => widget.type === entry.type),
      singleton: Boolean(entry.singleton),
      limitReached: widgets.length >= MAX_WIDGETS,
      disabled: !check.ok,
      reason: check.ok ? '' : check.reason,
      note: needsAccount ? 'Log in to see your own numbers in this widget.' : ''
    })
  }

  return groups.filter(group => group.widgets.length)
}

/**
 * The widgets a drawer action can add right now, for a count badge ("Add
 * widget" shows "3 widgets available") and to disable an empty add button.
 */
export function availableWidgetCount (layout = [], options = {}) {
  return widgetCatalogue(layout, options)
    .reduce((total, group) => total + group.widgets.filter(entry => !entry.disabled).length, 0)
}

/** Insert a widget type after `afterId`, merging it with the instance settings. */
export function addWidgetToLayout (layout, type, { afterId = null, settings = {}, now = Date.now() } = {}) {
  if (!widgetMeta(type)) return layout
  const merged = { ...defaultSettingsFor(type), ...settings }
  return insertWidget(layout, type, { afterId, settings: merged, now })
}

/** Width tokens a widget type may use, in WIDGET_WIDTHS order. */
export function widthChoices (type) {
  return widthChoicesFor(type)
}

/**
 * Draft semantics for the bar: edit mode works on a copy of the layout so the
 * user can cancel. These helpers keep the copy honest.
 */
export function draftWidgets (layout) {
  // Shallow copies: widget settings objects are replaced, never mutated, by
  // the layout helpers, so a shared settings object is safe to keep.
  return (Array.isArray(layout) ? layout : []).map(widget => ({ ...widget, settings: { ...widget.settings } }))
}

export function isDirtyDraft (draft, original) {
  const shape = list => (Array.isArray(list) ? list : []).map(widget => JSON.stringify({
    id: widget.id,
    type: widget.type,
    width: widget.width,
    settings: widget.settings
  }))
  const a = shape(draft)
  const b = shape(original)
  return a.length !== b.length || a.some((entry, index) => entry !== b[index])
}

/**
 * Whether saving the draft means "customised" or "back to the built-in
 * default". Resetting to the default is not a customisation, so the page can
 * keep showing the setup prompt and use the original shell.
 */
export function isDefaultDraft (draft) {
  return isDefaultLayout(draft)
}

/**
 * Count of changes for the bar's summary line:
 * `{ added, removed, moved, resized, configured }`.
 */
export function draftChanges (draft, original) {
  const before = Array.isArray(original) ? original : []
  const after = Array.isArray(draft) ? draft : []
  const beforeById = new Map(before.map(widget => [widget.id, widget]))
  const afterIds = new Set(after.map(widget => widget.id))

  let added = 0
  let removed = 0
  let moved = 0
  let resized = 0
  let configured = 0

  for (const widget of after) {
    const previous = beforeById.get(widget.id)
    if (!previous) {
      added += 1
      continue
    }
    if (previous.width !== widget.width) resized += 1
    if (JSON.stringify(previous.settings) !== JSON.stringify(widget.settings)) configured += 1
  }
  for (const widget of before) {
    if (!afterIds.has(widget.id)) removed += 1
  }
  const shared = after.filter(widget => beforeById.has(widget.id)).map(widget => widget.id)
  const beforeOrder = before.filter(widget => afterIds.has(widget.id)).map(widget => widget.id)
  if (shared.join('|') !== beforeOrder.join('|')) moved += 1

  return { added, removed, moved, resized, configured, total: added + removed + moved + resized + configured }
}

/* --- widget settings ------------------------------------------------------ */

export const POST_SOURCE_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'created', label: 'New' },
  { value: 'hot', label: 'Hot' },
  { value: 'myCommunities', label: 'My communities' }
]

const ACCOUNT_FIELD = {
  key: 'account',
  kind: 'text',
  label: 'Account',
  hint: 'Leave blank to use the signed-in user.',
  placeholder: 'ausbitbank',
  stripAt: true
}

const LIMIT_FIELD = (max, label = 'Items to show') => ({
  key: 'limit',
  kind: 'number',
  label,
  min: 1,
  max
})

const REFERENCE_FIELD = {
  key: 'reference',
  kind: 'text',
  label: 'Feed reference',
  placeholder: FEED_REFERENCE_PLACEHOLDER,
  hint: 'Paste a Hive path: an account feed, a community, a short-form timeline, a sort or a tag.'
}

const referenceField = hint => ({ ...REFERENCE_FIELD, hint })

/**
 * The settings a widget instance exposes in the Configure dialog. The order is
 * the visual order. An empty list means the widget has nothing to configure
 * (network stats), which also hides its Configure item.
 */
export function settingsFieldsFor (type) {
  switch (type) {
    case 'block':
      return [
        { key: 'compact', kind: 'toggle', label: 'Compact layout', hint: 'Hide the operation mix to keep the card short.' }
      ]
    case 'market':
      return [
        { key: 'coinIds', kind: 'coins', label: 'Coins' },
        { key: 'currency', kind: 'currency', label: 'Quote currency' },
        { key: 'compact', kind: 'toggle', label: 'Compact layout', hint: 'Show at most four coins.' }
      ]
    case 'witnesses':
      return [
        { key: 'limit', kind: 'number', label: 'Witnesses to show', min: 1, max: 20 },
        { key: 'pinMine', kind: 'toggle', label: 'Keep my witness on top', hint: 'Added to the limit rather than replacing a row.' },
        { key: 'highlight', kind: 'text', label: 'Highlight account', placeholder: 'ausbitbank', stripAt: true },
        { key: 'showHealth', kind: 'toggle', label: 'Show signing and price-feed health' }
      ]
    case 'posts':
      return [
        referenceField('Paste a Hive path. When set, it overrides the account, feed type, sort and tag below.'),
        { key: 'account', kind: 'text', label: 'Account feed', placeholder: 'ausbitbank', hint: 'Leave empty for a network, tag or community feed. Set it to browse one account.', stripAt: true },
        { key: 'feedSort', kind: 'select', label: 'Account feed type', options: ACCOUNT_FEED_SORTS },
        { key: 'source', kind: 'select', label: 'Network feed', options: POST_SOURCE_OPTIONS },
        { key: 'tag', kind: 'text', label: 'Community or tag', placeholder: 'hive-dev', stripHash: true },
        { key: 'limit', kind: 'number', label: 'Posts to show', min: 1, max: 20 },
        {
          key: 'view',
          kind: 'select',
          label: 'View style',
          options: [
            { value: 'list', label: 'List with rank and stats' },
            { value: 'compact', label: 'Compact list' },
            { value: 'cards', label: 'Cards' }
          ]
        },
        { key: 'showBody', kind: 'toggle', label: 'Show post and comment text', hint: 'Read short posts and replies in the widget without opening them.' },
        { key: 'showSortToggle', kind: 'toggle', label: 'Show the Trending/New/Hot switcher' },
        {
          key: 'pollSeconds',
          kind: 'select',
          label: 'Auto refresh',
          options: [
            { value: 0, label: 'Off' },
            { value: 30, label: 'Every 30 seconds' },
            { value: 60, label: 'Every minute' },
            { value: 300, label: 'Every 5 minutes' }
          ]
        }
      ]
    case 'wallet':
      return [
        ACCOUNT_FIELD,
        {
          key: 'currency',
          kind: 'select',
          label: 'Fiat currency',
          options: [
            { value: 'usd', label: 'US Dollar ($)' },
            { value: 'aud', label: 'Australian Dollar (A$)' },
            { value: 'eur', label: 'Euro (€)' },
            { value: 'gbp', label: 'British Pound (£)' }
          ]
        },
        {
          key: 'includeHiveEngine',
          kind: 'toggle',
          label: 'Include Hive-Engine tokens',
          hint: 'Prices come from the Hive-Engine market and are shown in HIVE terms.'
        },
        {
          key: 'includeMagi',
          kind: 'toggle',
          label: 'Include Magi balances and tokens',
          hint: 'HIVE, HBD and standard magi_token balances read from Magi. Token values use DEX pools where available.'
        }
      ]
    case 'myWitness':
    case 'witnessHealth':
      return [ACCOUNT_FIELD]
    case 'vitals':
      return [
        ACCOUNT_FIELD,
        {
          key: 'refreshSeconds',
          kind: 'select',
          label: 'Refresh interval',
          options: [
            { value: 30, label: 'Every 30 seconds' },
            { value: 60, label: 'Every minute' },
            { value: 300, label: 'Every 5 minutes' },
            { value: 0, label: 'Manual only' }
          ]
        },
        { key: 'showVoteValue', kind: 'toggle', label: 'Show vote value', hint: 'Estimate based on the current reward fund and voting power.' }
      ]
    case 'portfolioTrend':
      return [
        ACCOUNT_FIELD,
        {
          key: 'windowDays',
          kind: 'window',
          label: 'Price history window',
          options: [
            { value: 7, label: 'Last 7 days' },
            { value: 30, label: 'Last 30 days' }
          ]
        },
        { key: 'showPrice', kind: 'toggle', label: 'Show HIVE price history', hint: 'Public CoinGecko history. The portfolio line is always a local baseline.' }
      ]
    case 'walletActions':
      return [
        ACCOUNT_FIELD,
        { key: 'showPowerDown', kind: 'toggle', label: 'Show power-down' },
        { key: 'showSavings', kind: 'toggle', label: 'Show savings withdrawals' },
        { key: 'showConversions', kind: 'toggle', label: 'Show conversions' },
        { key: 'showOrders', kind: 'toggle', label: 'Show open market orders' },
        { key: 'showRewards', kind: 'toggle', label: 'Show claimable rewards' },
        {
          key: 'enableActions',
          kind: 'toggle',
          label: 'Enable claim and cancel buttons',
          hint: 'Only for your own account. Each action opens a confirmation, shows the required authority and is added to the signing queue. Nothing is broadcast automatically.'
        }
      ]
    case 'creatorStats':
      return [
        ACCOUNT_FIELD,
        {
          key: 'windowDays',
          kind: 'window',
          label: 'Reward window',
          options: [
            { value: 7, label: 'Last 7 days' },
            { value: 30, label: 'Last 30 days' },
            { value: 90, label: 'Last 90 days' }
          ]
        },
        { key: 'showCurationApr', kind: 'toggle', label: 'Show curation APR', hint: 'Annualised from the loaded reward window; an estimate.' },
        { key: 'showTopPost', kind: 'toggle', label: 'Show top post' }
      ]
    case 'governance':
      return [
        LIMIT_FIELD(8, 'Proposals to show'),
        {
          key: 'watchlist',
          kind: 'list',
          label: 'Proposal watchlist',
          hint: 'Proposal ids, comma separated. Leave blank to show proposals closing soon.',
          maxItems: 8,
          numeric: true
        },
        { key: 'showBudget', kind: 'toggle', label: 'Show DHF budget' },
        { key: 'showVoteExpiry', kind: 'toggle', label: 'Show my governance vote expiry' }
      ]
    case 'hbd':
      return [
        { key: 'amount', kind: 'amount', label: 'Projection amount (HBD)', min: 1, max: 10000000 },
        { key: 'showProjection', kind: 'toggle', label: 'Show savings projection' }
      ]
    case 'communityPulse':
      return [
        { key: 'community', kind: 'text', label: 'Community', placeholder: 'hive-139531', stripHash: true, hint: 'Community name, for example hive-139531.' },
        {
          key: 'mode',
          kind: 'select',
          label: 'Show',
          options: [
            { value: 'single', label: 'One community' },
            { value: 'mine', label: 'My communities' }
          ]
        },
        { key: 'showTopPost', kind: 'toggle', label: 'Show the top post' }
      ]
    case 'communityGrowth':
      return [
        { key: 'community', kind: 'text', label: 'Community', placeholder: 'hive-139531', stripHash: true, hint: 'Community name, for example hive-139531. Growth is measured from a baseline saved in this browser.' },
        { key: 'showAuthors', kind: 'toggle', label: 'Show active authors' },
        { key: 'showPending', kind: 'toggle', label: 'Show pending rewards' }
      ]
    case 'newsDigest':
      return [
        {
          key: 'accounts',
          kind: 'accounts',
          label: 'Curated accounts',
          hint: 'Up to 5 accounts whose blog posts are merged. This is a curated list, not an editorial news desk.',
          maxItems: 5
        },
        LIMIT_FIELD(12, 'Posts to show'),
        { key: 'showPayout', kind: 'toggle', label: 'Show payouts' }
      ]
    case 'keRatio':
      return [
        ACCOUNT_FIELD,
        {
          key: 'windowDays',
          kind: 'window',
          label: 'History window',
          options: [
            { value: 30, label: 'Last 30 days' },
            { value: 90, label: 'Last 90 days' },
            { value: 365, label: 'Last 365 days' }
          ]
        },
        { key: 'showBreakdown', kind: 'toggle', label: 'Show the reward-source breakdown', hint: 'The breakdown and the limitations are what keep this contextual; leave them visible unless the card is very narrow.' }
      ]
    case 'accountSafety':
      return [
        ACCOUNT_FIELD,
        {
          key: 'sources',
          kind: 'multi',
          label: 'Warning lists',
          options: SAFETY_SOURCES.map(source => ({
            value: source.id,
            label: source.title
          }))
        },
        {
          key: 'showCaution',
          kind: 'toggle',
          label: 'Show each list’s caveat',
          hint: 'These lists are curated by other Hive apps and communities. A match is a warning, never a block.'
        }
      ]
    case 'delegations':
      return [
        ACCOUNT_FIELD,
        { key: 'showIncoming', kind: 'toggle', label: 'Show incoming delegations', hint: 'Reconstructed from recent history and verified against each delegator. Slower than outgoing.' },
        { key: 'showOutgoing', kind: 'toggle', label: 'Show outgoing delegations' },
        LIMIT_FIELD(10, 'Delegators to show')
      ]
    case 'witnessRound':
      return [
        { key: 'account', kind: 'text', label: 'Highlight account', placeholder: 'ausbitbank', stripAt: true, hint: 'Optional. Highlights this witness when it is next in the round.' },
        LIMIT_FIELD(8, 'Producers to show')
      ]
    case 'nodeHealth':
      return [
        { key: 'showL2', kind: 'toggle', label: 'Check Hive-Engine and Magi', hint: 'Runs two timed probes when the widget refreshes.' }
      ]
    case 'hiveEngine':
      return [
        ACCOUNT_FIELD,
        {
          key: 'symbols',
          kind: 'list',
          label: 'Token symbols',
          hint: 'Up to 8 symbols, comma separated.',
          maxItems: 8,
          uppercase: true,
          pattern: /^[a-z0-9][a-z0-9._-]*$/i
        },
        { key: 'showBalances', kind: 'toggle', label: 'Show my balances' },
        LIMIT_FIELD(8, 'Tokens to show')
      ]
    case 'trendingTags':
      return [
        LIMIT_FIELD(12, 'Tags to show'),
        { key: 'showRewards', kind: 'toggle', label: 'Show payouts' }
      ]
    case 'draftsQueue':
      return [
        { key: 'showDrafts', kind: 'toggle', label: 'Show drafts' },
        { key: 'showQueue', kind: 'toggle', label: 'Show the signing queue' }
      ]
    case 'magiNetwork':
      return [
        { key: 'showContracts', kind: 'toggle', label: 'Show recent contracts' },
        { key: 'showTokens', kind: 'toggle', label: 'Show token prices' },
        LIMIT_FIELD(8, 'Items to show')
      ]
    case 'accountWatchlist':
      return [
        {
          key: 'accounts',
          kind: 'accounts',
          label: 'Accounts',
          hint: 'Up to 10 Hive account names, comma separated.',
          maxItems: 10
        },
        { key: 'showBalances', kind: 'toggle', label: 'Show HIVE and HBD balances' }
      ]
    case 'priceAlert':
      return [
        { key: 'target', kind: 'amount', label: 'HIVE USD target', min: 0, max: 1000000, step: 0.0001 },
        {
          key: 'direction',
          kind: 'select',
          label: 'Alert when the price is',
          options: [
            { value: 'above', label: 'At or above the target' },
            { value: 'below', label: 'At or below the target' }
          ]
        }
      ]
    case 'followerGrowth':
      return [
        ACCOUNT_FIELD,
        { key: 'showFollowing', kind: 'toggle', label: 'Show following count' }
      ]
    case 'notifications':
      return [LIMIT_FIELD(10, 'Notifications to show'), ACCOUNT_FIELD]
    case 'operations':
      return [
        ACCOUNT_FIELD,
        { key: 'filters', kind: 'multi', label: 'Operation types', options: OPERATION_FILTER_CHOICES },
        { key: 'jsonIds', kind: 'text', label: 'custom_json ids', placeholder: 'follow, vote, reblog', hint: 'Only used for App actions. Blank means every custom_json id.' },
        LIMIT_FIELD(20, 'Operations to show'),
        {
          key: 'includeMagi',
          kind: 'toggle',
          label: 'Include Magi Network transactions',
          hint: 'Merges the account\'s recent Magi ledger transactions with Hive operations.'
        },
        {
          key: 'pollSeconds',
          kind: 'select',
          label: 'Refresh interval',
          options: [
            { value: 0, label: 'Manual only' },
            { value: 10, label: 'Every 10 seconds' },
            { value: 15, label: 'Every 15 seconds' },
            { value: 30, label: 'Every 30 seconds' },
            { value: 60, label: 'Every minute' },
            { value: 120, label: 'Every 2 minutes' }
          ]
        }
      ]
    default:
      return []
  }
}

export function isConfigurableWidget (type) {
  return settingsFieldsFor(type).length > 0
}

const CURRENCY_IDS = HOME_MARKET_CURRENCIES.map(entry => entry.id)
const COIN_ID = /^[a-z0-9][a-z0-9-]*$/
const ACCOUNT_NAME = /^[a-z0-9][a-z0-9.-]{1,15}$/

function settingList (raw, field = {}) {
  const values = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
  const maxItems = Math.max(1, Math.min(50, Number(field.maxItems) || 20))
  const result = []
  for (const value of values) {
    let text = String(value ?? '').trim()
    if (field.stripAt) text = text.replace(/^@/, '')
    if (field.stripHash) text = text.replace(/^#/, '')
    if (field.uppercase) text = text.toUpperCase()
    text = text.trim()
    if (!text) continue
    if (field.numeric && !/^\d+$/.test(text)) continue
    if (field.pattern && !field.pattern.test(text)) continue
    if (!result.includes(text)) result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

function accountList (raw, field = {}) {
  const result = []
  for (const value of settingList(raw, { ...field, stripAt: true })) {
    const name = value.toLowerCase()
    if (!ACCOUNT_NAME.test(name)) continue
    if (!result.includes(name)) result.push(name)
    if (result.length >= Math.max(1, Math.min(50, Number(field.maxItems) || 10))) break
  }
  return result
}

/**
 * Clamp and cast values coming from the Configure dialog. Only keys the widget
 * declares are kept, so a stale setting from an older layout cannot leak into
 * a card that no longer accepts it.
 */
export function sanitiseWidgetSettings (type, settings = {}) {
  const input = settings && typeof settings === 'object' ? settings : {}
  const result = {}
  for (const field of settingsFieldsFor(type)) {
    if (!(field.key in input)) continue
    const raw = input[field.key]
    switch (field.kind) {
      case 'toggle':
        result[field.key] = Boolean(raw)
        break
      case 'number': {
        const number = Number(raw)
        if (!Number.isFinite(number)) break
        result[field.key] = Math.min(field.max, Math.max(field.min, Math.round(number)))
        break
      }
      case 'window': {
        const allowed = new Set((field.options || []).map(option => Number(option.value)))
        const number = Math.round(Number(raw))
        if (allowed.has(number)) result[field.key] = number
        break
      }
      case 'amount': {
        const number = Number(raw)
        if (!Number.isFinite(number)) break
        const min = Number.isFinite(Number(field.min)) ? Number(field.min) : 0
        const max = Number.isFinite(Number(field.max)) ? Number(field.max) : 1000000000
        result[field.key] = Math.min(max, Math.max(min, number))
        break
      }
      case 'select':
        if (field.options.some(option => option.value === raw)) result[field.key] = raw
        break
      case 'multi': {
        const allowed = new Set(field.options.map(option => option.value))
        const values = (Array.isArray(raw) ? raw : [raw])
          .filter(value => allowed.has(value))
        result[field.key] = [...new Set(values)]
        break
      }
      case 'list':
        result[field.key] = settingList(raw, field)
        break
      case 'accounts':
        result[field.key] = accountList(raw, field)
        break
      case 'currency': {
        const currency = String(raw ?? '').trim().toLowerCase()
        if (CURRENCY_IDS.includes(currency)) result[field.key] = currency
        break
      }
      case 'coins': {
        const list = (Array.isArray(raw) ? raw : [])
          .map(value => String(value || '').trim().toLowerCase())
          .filter(value => COIN_ID.test(value))
        result[field.key] = [...new Set(list)].slice(0, MAX_HOME_MARKET_COINS)
        break
      }
      case 'text': {
        let value = String(raw ?? '').trim()
        if (field.stripAt) value = value.replace(/^@/, '')
        if (field.stripHash) value = value.replace(/^#/, '')
        result[field.key] = value.slice(0, 80)
        break
      }
      default:
        break
    }
  }
  return result
}

/* Re-exported so the bar/drawer can do layout edits without importing the
 * layout module directly (keeps their imports small and obvious). */
export {
  MAX_WIDGETS,
  moveWidget,
  removeWidget,
  setWidgetWidth,
  updateWidgetSettings
}
