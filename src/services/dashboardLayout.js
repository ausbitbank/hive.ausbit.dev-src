// Pure layout model for the customisable home dashboard.
//
// A dashboard is an ordered list of widget instances. Widgets are placed on a
// 12-column grid; each instance carries a width token (`quarter`, `third`,
// `half`, `twoThirds`, `full`) rather than a pixel width so the same layout
// works at every breakpoint. Everything here is pure so the arrangement logic
// can be unit tested without mounting Vue.
//
// Order matters: rows are filled left-to-right, and a widget moves to the next
// row when it would overflow the 12 columns. The built-in default layout and
// every saved layout are rendered the same way.

/** Columns available to widget widths. */
export const GRID_COLUMNS = 12

/** Width tokens and how many columns each occupies. */
export const WIDGET_WIDTHS = [
  { value: 'quarter', label: 'Quarter', columns: 3 },
  { value: 'third', label: 'Third', columns: 4 },
  { value: 'half', label: 'Half', columns: 6 },
  { value: 'twoThirds', label: 'Two thirds', columns: 8 },
  { value: 'full', label: 'Full width', columns: 12 }
]

export const DEFAULT_WIDGET_WIDTH = 'full'
export const MAX_WIDGETS = 20

/**
 * Widget catalogue. `component` is the Vue component name registered by the
 * dashboard grid; `defaultSettings` is spread into each new instance so that
 * adding a widget never needs its own dialog before it renders.
 *
 * `singleton: true` widgets may only appear once per dashboard (a second live
 * block card has no extra value); others can be added several times with
 * different settings (coin prices in AUD and USD, two community feeds, ...).
 *
 * `requiresAccount` widgets need a signed-in user. Guests can still add them,
 * but the shell renders a "log in to see this" state instead of empty data.
 *
 * `live` widgets keep their own polling timer, so the grid only mounts them
 * while they are on screen.
 *
 * `defer` widgets are expensive to fetch (history, L2 balances, probes); the
 * grid shows a skeleton and only mounts their body when the card is near the
 * viewport.
 */
export const WIDGET_REGISTRY = [
  {
    type: 'block',
    component: 'HomeBlockCard',
    label: 'Live block',
    description: 'Latest block, transactions, operations and top operation mix.',
    category: 'network',
    icon: 'view_agenda',
    defaultWidth: 'half',
    minWidth: 'quarter',
    defaultSettings: {},
    singleton: true,
    live: true
  },
  {
    type: 'market',
    component: 'HomeMarketCard',
    label: 'Coin prices',
    description: 'Price, 24h change and sparkline for the coins you choose.',
    category: 'markets',
    icon: 'show_chart',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {},
    singleton: false
  },
  {
    type: 'witnesses',
    component: 'HomeWitnessCard',
    label: 'Top witnesses',
    description: 'Witness approval ranking, optionally pinned to your own witness.',
    category: 'governance',
    icon: 'how_to_vote',
    defaultWidth: 'full',
    minWidth: 'third',
    defaultSettings: { limit: 6, pinMine: false, showHealth: true },
    singleton: false
  },
  {
    type: 'posts',
    component: 'HomeTrendingPosts',
    label: 'Content browser',
    description: 'Browse any Hive feed — trending, a tag, a community, an account — with list, compact or card views.',
    category: 'community',
    icon: 'article',
    defaultWidth: 'full',
    minWidth: 'half',
    defaultSettings: {
      source: 'trending',
      tag: '',
      reference: '',
      account: '',
      feedSort: 'blog',
      limit: 6,
      showSortToggle: true,
      view: 'list',
      showBody: false,
      pollSeconds: 0
    },
    singleton: false
  },
  {
    type: 'wallet',
    component: 'WidgetWallet',
    label: 'My wallet',
    description: 'Portfolio value, balance breakdown and claimable rewards.',
    category: 'account',
    icon: 'account_balance_wallet',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', currency: 'usd', includeHiveEngine: true, includeMagi: true },
    requiresAccount: true
  },
  {
    type: 'myWitness',
    component: 'WidgetMyWitness',
    label: 'My witness',
    description: 'Your witness rank, votes, gap to the top 20 and health.',
    category: 'governance',
    icon: 'verified',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '' },
    requiresAccount: true
  },
  {
    type: 'witnessHealth',
    component: 'WidgetWitnessHealth',
    label: 'Witness health',
    description: 'Health of the witnesses you vote for and your vote weight.',
    category: 'governance',
    icon: 'health_and_safety',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {},
    requiresAccount: true
  },
  {
    type: 'network',
    component: 'WidgetNetworkStats',
    label: 'Network stats',
    description: 'Head block, HP supply, participation and HBD debt ratio.',
    category: 'network',
    icon: 'insights',
    defaultWidth: 'full',
    minWidth: 'half',
    defaultSettings: {},
    singleton: true,
    live: true,
    // No per-instance settings; the shell hides its Configure item.
    configurable: false
  },
  {
    type: 'notifications',
    component: 'WidgetNotifications',
    label: 'Notifications',
    description: 'Recent replies, votes and mentions with unread count.',
    category: 'account',
    icon: 'notifications',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { limit: 5 },
    requiresAccount: true
  },
  {
    type: 'operations',
    component: 'WidgetOperations',
    label: 'Live operations',
    description: 'A live, filtered view of one account\'s operations or transactions.',
    category: 'account',
    icon: 'receipt_long',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', filters: ['all'], jsonIds: '', limit: 8, pollSeconds: 30, includeMagi: false },
    singleton: false
  },
  {
    type: 'vitals',
    component: 'WidgetAccountVitals',
    label: 'Account vitals',
    description: 'Voting power, resource credits, vote value and effective HP.',
    category: 'account',
    icon: 'monitor_heart',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', refreshSeconds: 60, showVoteValue: true },
    singleton: true,
    requiresAccount: true,
    live: true
  },
  {
    type: 'newsDigest',
    component: 'WidgetNewsDigest',
    label: 'Hive news digest',
    description: 'Newest posts from a curated set of ecosystem accounts.',
    category: 'community',
    icon: 'newspaper',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {
      accounts: ['hiveio', 'ecency', 'peakd', 'leofinance'],
      limit: 6,
      showPayout: true
    },
    singleton: true,
    defer: true
  },
  {
    type: 'keRatio',
    component: 'WidgetKeRatio',
    label: 'Accountability view',
    description: 'Contextual reward-retention ratio with sources and limits — never a score.',
    category: 'account',
    icon: 'balance',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', windowDays: 90, showBreakdown: true },
    singleton: true,
    requiresAccount: true,
    defer: true
  },
  {
    type: 'accountSafety',
    component: 'WidgetAccountSafety',
    label: 'Account safety',
    description: 'Warning-only check against curated public phishing and abuse lists.',
    category: 'account',
    icon: 'gpp_maybe',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: {
      account: '',
      sources: ['hive-blog-phishing', 'plentyofphish', 'spaminator-blacklist'],
      showCaution: true
    },
    singleton: true,
    requiresAccount: true,
    defer: true
  },
  {
    type: 'keepsats',
    component: 'WidgetKeepsats',
    label: 'Lightning balance',
    description: 'Read-only keepsats balance from an existing v4v.app session.',
    category: 'account',
    icon: 'bolt',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: {},
    singleton: true,
    requiresAccount: true,
    defer: true,
    configurable: false
  },
  {
    type: 'portfolioTrend',
    component: 'WidgetPortfolioTrend',
    label: 'Portfolio trend',
    description: 'Portfolio value plus public HIVE price history and a local balance baseline.',
    category: 'account',
    icon: 'auto_graph',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', windowDays: 30, showPrice: true },
    singleton: true,
    requiresAccount: true,
    defer: true
  },
  {
    type: 'walletActions',
    component: 'WidgetWalletActions',
    label: 'Wallet actions',
    description: 'Power-down, savings withdrawals, conversions, orders and claimable rewards.',
    category: 'account',
    icon: 'pending_actions',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {
      account: '',
      showPowerDown: true,
      showSavings: true,
      showConversions: true,
      showOrders: true,
      showRewards: true,
      enableActions: false
    },
    singleton: true,
    requiresAccount: true
  },
  {
    type: 'creatorStats',
    component: 'WidgetCreatorStats',
    label: 'Creator stats',
    description: 'Author and curation rewards, pending payouts and your best recent post.',
    category: 'account',
    icon: 'insights',
    defaultWidth: 'half',
    minWidth: 'half',
    defaultSettings: { account: '', windowDays: 7, showCurationApr: true, showTopPost: true },
    singleton: true,
    requiresAccount: true,
    defer: true
  },
  {
    type: 'governance',
    component: 'WidgetGovernanceWatch',
    label: 'Governance watch',
    description: 'DHF budget, proposals closing soon and your governance vote expiry.',
    category: 'governance',
    icon: 'account_balance',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { limit: 4, watchlist: [], showBudget: true, showVoteExpiry: true },
    singleton: true
  },
  {
    type: 'hbd',
    component: 'WidgetHbdPeg',
    label: 'HBD peg & yield',
    description: 'Internal market price, savings APR, debt ratio and haircut distance.',
    category: 'markets',
    icon: 'paid',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { amount: 1000, showProjection: true },
    singleton: true
  },
  {
    type: 'communityPulse',
    component: 'WidgetCommunityPulse',
    label: 'Community pulse',
    description: 'Subscribers, active authors, pending rewards, your role and the top post.',
    category: 'community',
    icon: 'groups',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { community: '', mode: 'single', showTopPost: true },
    singleton: false
  },
  {
    type: 'communityGrowth',
    component: 'WidgetCommunityGrowth',
    label: 'Community growth',
    description: 'Subscriber, author and pending-reward growth from a local baseline.',
    category: 'community',
    icon: 'trending_up',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { community: '', showAuthors: true, showPending: true },
    singleton: true
  },
  {
    type: 'delegations',
    component: 'WidgetDelegationSnapshot',
    label: 'Delegations',
    description: 'Incoming and outgoing Hive Power delegations and effective HP.',
    category: 'account',
    icon: 'account_tree',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', showIncoming: false, showOutgoing: true, limit: 5 },
    singleton: true,
    requiresAccount: true,
    defer: true
  },
  {
    type: 'witnessRound',
    component: 'WidgetWitnessRound',
    label: 'Witness round',
    description: 'Current block producer, the next producers and your witness slot.',
    category: 'governance',
    icon: 'how_to_vote',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', limit: 5 },
    singleton: true
  },
  {
    type: 'nodeHealth',
    component: 'WidgetNodeHealth',
    label: 'Node health',
    description: 'Active API node latency, failures, head block and optional L2 probes.',
    category: 'network',
    icon: 'dns',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { showL2: false },
    singleton: true,
    defer: true
  },
  {
    type: 'hiveEngine',
    component: 'WidgetHiveEngineWatchlist',
    label: 'Hive-Engine watchlist',
    description: 'Prices, 24h change, volume and balances for chosen L2 tokens.',
    category: 'markets',
    icon: 'token',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {
      account: '',
      symbols: ['SWAP.HIVE', 'DEC', 'LEO'],
      showBalances: true,
      limit: 6
    },
    singleton: true,
    defer: true
  },
  {
    type: 'trendingTags',
    component: 'WidgetTrendingTags',
    label: 'Trending tags',
    description: 'The topics with the most activity and rewards right now.',
    category: 'community',
    icon: 'tag',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { limit: 8, showRewards: true },
    singleton: true
  },
  {
    type: 'draftsQueue',
    component: 'WidgetDraftsQueue',
    label: 'Drafts & queue',
    description: 'Unfinished drafts and operations waiting to be signed.',
    category: 'account',
    icon: 'drafts',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { showDrafts: true, showQueue: true },
    singleton: true
  },
  {
    type: 'communitySpotlight',
    component: 'WidgetCommunitySpotlight',
    label: 'Community spotlight',
    description: 'A rotating community worth discovering today.',
    category: 'community',
    icon: 'travel_explore',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: {},
    singleton: true,
    configurable: false
  },
  {
    type: 'magiNetwork',
    component: 'WidgetMagiNetwork',
    label: 'Magi network',
    description: 'Magi head, witnesses, recent contracts and token prices.',
    category: 'network',
    icon: 'hub',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { showContracts: true, showTokens: true, limit: 4 },
    singleton: true,
    defer: true
  },
  {
    type: 'accountWatchlist',
    component: 'WidgetAccountWatchlist',
    label: 'Account watchlist',
    description: 'Reputation, HP and balances for accounts you follow.',
    category: 'account',
    icon: 'visibility',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { accounts: [], showBalances: true },
    singleton: true,
    defer: true
  },
  {
    type: 'priceAlert',
    component: 'WidgetPriceAlert',
    label: 'Price alert',
    description: 'Track a HIVE USD target and see how far the market is from it.',
    category: 'markets',
    icon: 'notification_important',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { target: 0, direction: 'above' },
    singleton: true
  },
  {
    type: 'followerGrowth',
    component: 'WidgetFollowerGrowth',
    label: 'Follower growth',
    description: 'Followers, following and growth since this browser started tracking.',
    category: 'account',
    icon: 'people',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { account: '', showFollowing: true },
    singleton: true,
    requiresAccount: true
  }
]

export const WIDGET_CATEGORIES = [
  { id: 'network', label: 'Network' },
  { id: 'markets', label: 'Markets' },
  { id: 'governance', label: 'Governance' },
  { id: 'community', label: 'Community' },
  { id: 'account', label: 'Your account' }
]

/**
 * The built-in default layout. Every visitor starts here until they save a
 * customisation of their own:
 *
 *   ┌─────────┬─────────┬─────────┐
 *   │ block   │ market  │witnesses│
 *   ├─────────┴───┬─────┴─────────┤
 *   │ trending    │ @ausbitbank   │
 *   ├─────────────┴───────────────┤
 *   │ HiveDevs community          │
 *   └─────────────────────────────┘
 *
 * The first row is three thirds (12 columns), the next two post feeds are
 * halves, and the community feed spans the full width.
 */
export const DEFAULT_LAYOUT = [
  { type: 'block', width: 'third', settings: {} },
  { type: 'market', width: 'third', settings: {} },
  { type: 'witnesses', width: 'third', settings: { limit: 10 } },
  {
    type: 'posts',
    width: 'half',
    settings: { source: 'trending', limit: 6, view: 'cards', showBody: true }
  },
  {
    type: 'posts',
    width: 'half',
    settings: { account: 'ausbitbank', feedSort: 'blog', limit: 6, view: 'cards', showBody: true }
  },
  {
    type: 'posts',
    width: 'full',
    settings: {
      source: 'trending',
      tag: 'hive-139531',
      reference: '/c/hive-139531',
      limit: 8,
      view: 'cards',
      showBody: true,
      pollSeconds: 300
    }
  }
]

/** Suggested layout offered once when a known account is logged in. */
export const LOGGED_IN_STARTER_LAYOUT = [
  { type: 'wallet', width: 'half', settings: {} },
  { type: 'myWitness', width: 'half', settings: {} },
  { type: 'witnessHealth', width: 'full', settings: {} },
  { type: 'posts', width: 'full', settings: { source: 'trending' } },
  { type: 'network', width: 'full', settings: {} },
  { type: 'block', width: 'half', settings: {} },
  { type: 'market', width: 'half', settings: {} }
]

/**
 * Ready-made dashboards offered from the editor's Layouts menu. Each preset is
 * a normal layout preset (`{ type, width, settings }`), so it can be previewed
 * in the draft, saved as a named layout and shared like any other layout.
 */
export const DASHBOARD_PRESETS = [
  {
    id: 'everyday',
    label: 'Everyday',
    description: 'Prices, HBD, network health, governance and community in one view.',
    icon: 'today',
    tiling: 'masonry',
    widgets: [
      { type: 'hbd', width: 'third', settings: {} },
      { type: 'network', width: 'third', settings: {} },
      { type: 'witnesses', width: 'third', settings: { limit: 10 } },
      { type: 'posts', width: 'half', settings: { source: 'trending', limit: 6, view: 'cards', showBody: true } },
      { type: 'communityPulse', width: 'half', settings: {} },
      { type: 'governance', width: 'full', settings: {} },
      { type: 'newsDigest', width: 'half', settings: {} },
      { type: 'trendingTags', width: 'third', settings: {} },
      { type: 'communitySpotlight', width: 'third', settings: {} }
    ]
  },
  {
    id: 'creator',
    label: 'Creator',
    description: 'Your account vitals, rewards, wallet actions and notifications.',
    icon: 'edit_note',
    tiling: 'masonry',
    widgets: [
      { type: 'vitals', width: 'half', settings: {} },
      { type: 'creatorStats', width: 'half', settings: {} },
      { type: 'walletActions', width: 'half', settings: {} },
      { type: 'posts', width: 'half', settings: { source: 'trending', limit: 4, view: 'list' } },
      { type: 'notifications', width: 'third', settings: {} },
      { type: 'network', width: 'third', settings: {} },
      { type: 'hbd', width: 'third', settings: {} },
      { type: 'portfolioTrend', width: 'half', settings: {} },
      { type: 'draftsQueue', width: 'third', settings: {} },
      { type: 'followerGrowth', width: 'third', settings: {} }
    ]
  },
  {
    id: 'witness',
    label: 'Witness',
    description: 'Witness rank and health, governance, blocks and network participation.',
    icon: 'how_to_vote',
    tiling: 'masonry',
    widgets: [
      { type: 'myWitness', width: 'half', settings: {} },
      { type: 'witnessHealth', width: 'half', settings: {} },
      { type: 'governance', width: 'full', settings: {} },
      { type: 'network', width: 'half', settings: {} },
      { type: 'block', width: 'half', settings: {} },
      { type: 'witnesses', width: 'half', settings: { limit: 10 } },
      { type: 'market', width: 'half', settings: {} },
      { type: 'witnessRound', width: 'half', settings: {} }
    ]
  },
  {
    id: 'trader',
    label: 'Trader',
    description: 'Markets, HBD peg and yield, wallet actions and chain activity.',
    icon: 'show_chart',
    tiling: 'masonry',
    widgets: [
      { type: 'market', width: 'half', settings: {} },
      { type: 'hbd', width: 'half', settings: {} },
      { type: 'walletActions', width: 'half', settings: {} },
      { type: 'network', width: 'half', settings: {} },
      { type: 'block', width: 'half', settings: {} },
      { type: 'witnesses', width: 'half', settings: { limit: 8 } },
      { type: 'hiveEngine', width: 'half', settings: {} },
      { type: 'portfolioTrend', width: 'half', settings: {} },
      { type: 'priceAlert', width: 'half', settings: {} }
    ]
  },
  {
    id: 'community',
    label: 'Community',
    description: 'Community stats, your creator numbers, the community feed and notifications.',
    icon: 'groups',
    tiling: 'masonry',
    widgets: [
      { type: 'communityPulse', width: 'half', settings: {} },
      { type: 'posts', width: 'half', settings: { reference: '/c/hive-139531', limit: 6, view: 'cards', showBody: true } },
      { type: 'creatorStats', width: 'half', settings: {} },
      { type: 'notifications', width: 'half', settings: {} },
      { type: 'governance', width: 'half', settings: {} },
      { type: 'network', width: 'half', settings: {} },
      { type: 'communityGrowth', width: 'third', settings: {} },
      { type: 'communitySpotlight', width: 'third', settings: {} },
      { type: 'trendingTags', width: 'third', settings: {} }
    ]
  },
  {
    id: 'governance',
    label: 'Governance',
    description: 'DHF funding, proposal watch, witness standing and network health.',
    icon: 'account_balance',
    tiling: 'masonry',
    widgets: [
      { type: 'governance', width: 'full', settings: { limit: 6 } },
      { type: 'witnesses', width: 'half', settings: { limit: 10 } },
      { type: 'network', width: 'half', settings: {} },
      { type: 'hbd', width: 'third', settings: {} },
      { type: 'block', width: 'third', settings: {} },
      { type: 'market', width: 'third', settings: {} },
      { type: 'witnessRound', width: 'half', settings: {} }
    ]
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Network stats, blocks, HBD, governance and witness data for builders.',
    icon: 'code',
    tiling: 'masonry',
    widgets: [
      { type: 'block', width: 'half', settings: {} },
      { type: 'network', width: 'half', settings: {} },
      { type: 'governance', width: 'half', settings: {} },
      { type: 'hbd', width: 'half', settings: {} },
      { type: 'market', width: 'half', settings: {} },
      { type: 'witnesses', width: 'half', settings: { limit: 10 } },
      { type: 'nodeHealth', width: 'half', settings: {} },
      { type: 'hiveEngine', width: 'half', settings: {} },
      { type: 'magiNetwork', width: 'half', settings: {} }
    ]
  }
]

export function presetById (id) {
  return DASHBOARD_PRESETS.find(preset => preset.id === id) || null
}

function registryEntry (type) {
  return WIDGET_REGISTRY.find(entry => entry.type === type) || null
}

export function widgetMeta (type) {
  return registryEntry(type)
}

export function isKnownWidgetType (type) {
  return Boolean(registryEntry(type))
}

function widthColumns (value) {
  const match = WIDGET_WIDTHS.find(entry => entry.value === value)
  return match ? match.columns : GRID_COLUMNS
}

function closestWidth (columns, minWidth) {
  const floor = Math.max(widthColumns(minWidth), Math.min(GRID_COLUMNS, Number(columns) || GRID_COLUMNS))
  let best = WIDGET_WIDTHS[0]
  for (const entry of WIDGET_WIDTHS) {
    if (entry.columns <= floor) best = entry
  }
  return best.value
}

/** Copy of a registry widget's default settings (arrays included). */
export function defaultSettingsFor (type) {
  const entry = registryEntry(type)
  if (!entry) return {}
  return JSON.parse(JSON.stringify(entry.defaultSettings || {}))
}

/**
 * Stable-but-unique instance id. Widgets are identified by instance so two of
 * the same type keep independent settings and never swap on reorder.
 */
let instanceCounter = 0
export function createWidgetId (type = 'widget', now = Date.now()) {
  instanceCounter = (instanceCounter + 1) % 100000
  const random = Math.random().toString(36).slice(2, 6)
  return type + '_' + now.toString(36).slice(-6) + instanceCounter.toString(36) + random
}

/**
 * Normalise one stored instance into a renderable widget, or null when it
 * cannot be salvaged. Unknown types are dropped rather than crashing the page.
 */
export function normaliseWidget (input) {
  if (!input || typeof input !== 'object') return null
  // Older dashboards stored the account feed as a separate widget. Fold it into
  // the general content browser without losing its account and feed type.
  const rawType = String(input.type || '')
  const alias = rawType === 'accountPosts' ? 'posts' : rawType
  const meta = registryEntry(alias)
  if (!meta) return null
  const settings = input.settings && typeof input.settings === 'object' ? { ...input.settings } : {}
  if (rawType === 'accountPosts') {
    if (!settings.feedSort && settings.sort) settings.feedSort = settings.sort
    delete settings.sort
  }
  return {
    id: typeof input.id === 'string' && input.id ? input.id : createWidgetId(meta.type),
    type: meta.type,
    width: closestWidth(widthColumns(input.width), meta.minWidth),
    settings: { ...defaultSettingsFor(meta.type), ...settings }
  }
}

/** Bound a widget to its registry minimum width. */
export function clampWidth (type, width) {
  const meta = registryEntry(type)
  return closestWidth(widthColumns(width), meta?.minWidth || 'quarter')
}

/** Enforce unique ids and singleton rules, and drop unknown widget types. */
export function normaliseLayout (widgets) {
  if (!Array.isArray(widgets)) return []
  const seenIds = new Set()
  const seenSingletons = new Set()
  const result = []
  for (const raw of widgets) {
    const widget = normaliseWidget(raw)
    if (!widget) continue
    if (seenIds.has(widget.id)) widget.id = createWidgetId(widget.type)
    const meta = registryEntry(widget.type)
    if (meta?.singleton) {
      if (seenSingletons.has(widget.type)) continue
      seenSingletons.add(widget.type)
    }
    seenIds.add(widget.id)
    result.push(widget)
    if (result.length >= MAX_WIDGETS) break
  }
  return result
}

/** Turn a layout preset into fresh widget instances. */
export function buildLayout (preset = DEFAULT_LAYOUT, { now = Date.now() } = {}) {
  return normaliseLayout(
    preset.map((entry, index) => ({
      id: createWidgetId(entry.type, now + index),
      type: entry.type,
      width: entry.width,
      settings: entry.settings
    }))
  )
}

/** Can `type` be added given the current layout? */
export function canAddWidget (layout, type) {
  const meta = registryEntry(type)
  if (!meta) return { ok: false, reason: 'Unknown widget.' }
  if (layout.length >= MAX_WIDGETS) return { ok: false, reason: 'This dashboard is full.' }
  if (meta.singleton && layout.some(widget => widget.type === type)) {
    return { ok: false, reason: meta.label + ' is already on this dashboard.' }
  }
  return { ok: true }
}

/** Append a new widget instance; returns a new array. */
export function addWidget (layout, type, { settings = {}, width = '', now = Date.now() } = {}) {
  const check = canAddWidget(layout, type)
  if (!check.ok) return layout
  const meta = registryEntry(type)
  const widget = normaliseWidget({
    id: createWidgetId(type, now),
    type,
    width: width || meta.defaultWidth,
    settings
  })
  return layout.concat([widget])
}

/**
 * Insert a widget before/after another instance. Used by the add drawer so a
 * new widget lands next to the one the user pressed "+" on.
 */
export function insertWidget (layout, type, { afterId = null, settings = {}, now = Date.now() } = {}) {
  const check = canAddWidget(layout, type)
  if (!check.ok) return layout
  const meta = registryEntry(type)
  const widget = normaliseWidget({
    id: createWidgetId(type, now),
    type,
    width: meta.defaultWidth,
    settings
  })
  if (!afterId) return layout.concat([widget])
  const index = layout.findIndex(entry => entry.id === afterId)
  if (index === -1) return layout.concat([widget])
  return layout.slice(0, index + 1).concat([widget], layout.slice(index + 1))
}

export function removeWidget (layout, id) {
  return layout.filter(widget => widget.id !== id)
}

export function updateWidgetSettings (layout, id, settings) {
  return layout.map(widget => {
    if (widget.id !== id) return widget
    const normalised = normaliseWidget({ ...widget, settings: { ...widget.settings, ...settings } })
    return normalised || widget
  })
}

export function setWidgetWidth (layout, id, width) {
  return layout.map(widget => (
    widget.id === id ? { ...widget, width: clampWidth(widget.type, width) } : widget
  ))
}

/** Width tokens a widget may use, narrowest first. */export function widthChoicesFor (type) {
  const meta = registryEntry(type)
  if (!meta) return []
  const minimum = widthColumns(meta.minWidth || 'quarter')
  return WIDGET_WIDTHS.filter(entry => entry.columns >= minimum).map(entry => entry.value)
}

/**
 * Move a widget one width token narrower (`-1`) or wider (`+1`). Stops at the
 * widget's minimum and at full width, so a disabled +/- button and the helper
 * agree on the bounds.
 */
export function stepWidgetWidth (layout, id, direction) {
  return (Array.isArray(layout) ? layout : []).map(widget => {
    if (widget.id !== id) return widget
    const choices = widthChoicesFor(widget.type)
    const current = choices.indexOf(widget.width)
    const step = direction < 0 ? -1 : 1
    const next = choices[Math.max(0, Math.min(choices.length - 1, (current === -1 ? 0 : current) + step))]
    return next ? { ...widget, width: next } : widget
  })
}

function widthForColumns (columns) {
  const match = WIDGET_WIDTHS.find(entry => entry.columns === columns)
  return match ? match.value : closestWidth(columns, 'quarter')
}

const ROW_SCORE = (a, b) => {
  if (!a) return false
  if (!b) return true
  if (a.penalty !== b.penalty) return a.penalty < b.penalty
  if (a.count !== b.count) return a.count > b.count
  return a.order < b.order
}

/**
 * Find the best subset of remaining widgets for one 12-column row. The row
 * score is: use as many columns as possible, then change widths as little as
 * possible, then fit more widgets, then keep the original order. Widths are
 * limited to the tokens each widget already allows, so a widget never drops
 * below its registry minimum.
 */
function bestRow (items, columns = GRID_COLUMNS) {
  let dp = new Array(columns + 1).fill(null)
  dp[0] = { penalty: 0, count: 0, order: 0, picks: [] }

  for (const item of items) {
    const next = dp.slice()
    for (let sum = 0; sum <= columns; sum++) {
      const entry = dp[sum]
      if (!entry) continue
      for (const width of item.choices) {
        if (sum + width > columns) continue
        const candidate = {
          penalty: entry.penalty + Math.abs(width - item.current),
          count: entry.count + 1,
          order: entry.order + item.index,
          picks: entry.picks.concat([{ item, columns: width }])
        }
        if (ROW_SCORE(candidate, next[sum + width])) next[sum + width] = candidate
      }
    }
    dp = next
  }

  for (let sum = columns; sum > 0; sum--) {
    if (dp[sum] && dp[sum].picks.length) return dp[sum]
  }
  return { picks: [] }
}

/**
 * Reorder and resize a layout to fill 12-column rows with as little leftover
 * space as possible. Used by the editor's auto-optimize action; the result is
 * still a normal layout that can be previewed and cancelled.
 */
export function optimiseLayout (layout) {
  const items = (Array.isArray(layout) ? layout : []).map((widget, index) => {
    const current = widthColumns(widget.width)
    const choices = [...new Set(widthChoicesFor(widget.type).map(widthColumns))]
      .filter(width => width <= GRID_COLUMNS)
    return {
      widget,
      index,
      current,
      choices: choices.length ? choices : [current]
    }
  })

  const remaining = items.slice()
  const result = []
  while (remaining.length) {
    const row = bestRow(remaining)
    const picks = row.picks.length ? row.picks : [{ item: remaining[0], columns: remaining[0].current }]
    picks.sort((a, b) => a.item.index - b.item.index)
    for (const pick of picks) {
      result.push({ ...pick.item.widget, width: widthForColumns(pick.columns) })
    }
    const used = new Set(picks.map(pick => pick.item))
    for (let index = remaining.length - 1; index >= 0; index--) {
      if (used.has(remaining[index])) remaining.splice(index, 1)
    }
  }
  return result
}

/** Move a widget to a new index, keeping the others' relative order. */
export function moveWidget (layout, id, toIndex) {
  const from = layout.findIndex(widget => widget.id === id)
  if (from === -1) return layout
  const target = Math.max(0, Math.min(layout.length - 1, Math.round(Number(toIndex) || 0)))
  if (target === from) return layout
  const next = layout.slice()
  const [widget] = next.splice(from, 1)
  next.splice(target, 0, widget)
  return next
}

/** Swap a widget one position earlier (`-1`) or later (`+1`). */
export function nudgeWidget (layout, id, direction) {
  const from = layout.findIndex(widget => widget.id === id)
  if (from === -1) return layout
  return moveWidget(layout, id, from + (direction < 0 ? -1 : 1))
}

/**
 * Fill 12-column rows left-to-right. Returns arrays of widgets per row; a
 * widget wider than the remaining space starts a new row. Widgets are never
 * split, so the rendered page has no gaps caused by row breaking.
 */
export function packRows (widgets, columns = GRID_COLUMNS) {
  const rows = []
  let current = []
  let used = 0
  for (const widget of Array.isArray(widgets) ? widgets : []) {
    const span = Math.min(columns, widthColumns(widget.width))
    if (used + span > columns && current.length) {
      rows.push(current)
      current = []
      used = 0
    }
    current.push({ widget, columns: span })
    used += span
    if (used >= columns) {
      rows.push(current)
      current = []
      used = 0
    }
  }
  if (current.length) rows.push(current)
  return rows
}

function stableSettings (value) {
  if (Array.isArray(value)) return value.map(stableSettings)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableSettings(value[key])
    return result
  }, {})
}

/**
 * Default layouts shipped by earlier releases. They are recognised only so a
 * stored dashboard that was never customised can follow the current default
 * after an update.
 */
const LEGACY_DEFAULT_LAYOUTS = [
  [
    { type: 'block', width: 'half', settings: {} },
    { type: 'market', width: 'half', settings: {} },
    { type: 'posts', width: 'full', settings: { source: 'trending' } },
    { type: 'witnesses', width: 'full', settings: { limit: 6 } },
    { type: 'posts', width: 'full', settings: { account: 'ausbitbank', feedSort: 'blog', limit: 4 } }
  ]
]

function matchesPreset (layout, preset) {
  if (!Array.isArray(layout) || layout.length !== preset.length) return false
  return layout.every((widget, index) => {
    const expected = preset[index]
    if (widget.type !== expected.type || widget.width !== expected.width) return false
    // Merge registry defaults so a widget that simply omitted a setting still
    // matches; a changed setting is a real customisation.
    const actual = { ...defaultSettingsFor(widget.type), ...widget.settings }
    const target = { ...defaultSettingsFor(expected.type), ...expected.settings }
    return JSON.stringify(stableSettings(actual)) === JSON.stringify(stableSettings(target))
  })
}

/** True when the stored layout is the built-in default (nothing customised). */
export function isDefaultLayout (layout) {
  return matchesPreset(layout, DEFAULT_LAYOUT)
}

/** True when the layout is an untouched default from an earlier release. */
export function isLegacyDefaultLayout (layout) {
  return LEGACY_DEFAULT_LAYOUTS.some(preset => matchesPreset(layout, preset))
}

// -- Portable layouts --------------------------------------------------------

const SHARE_PREFIX = 'HIVE-DASH-1.'

function encodeBase64 (text) {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64')
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64 (text) {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'base64').toString('utf8')
  const binary = atob(text)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function toBase64Url (value) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url (value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return padded + '='.repeat((4 - (padded.length % 4)) % 4)
}

/** Compact, pasteable layout text. Widget ids are intentionally omitted. */
export function serialiseLayout (layout) {
  const widgets = (Array.isArray(layout) ? layout : []).map(widget => ({
    type: widget.type,
    width: clampWidth(widget.type, widget.width),
    settings: widget.settings && typeof widget.settings === 'object' ? widget.settings : {}
  }))
  return SHARE_PREFIX + toBase64Url(encodeBase64(JSON.stringify({ v: 1, widgets })))
}

/**
 * Read a shared layout string or a raw JSON layout. Returns
 * `{ layout, error }`; an invalid string never throws.
 */
export function parseLayoutText (text) {
  const value = String(text || '').trim()
  if (!value) return { layout: null, error: 'Paste a layout string to import.' }
  let json
  try {
    if (value.startsWith(SHARE_PREFIX)) {
      json = decodeBase64(fromBase64Url(value.slice(SHARE_PREFIX.length)))
    } else if (value.startsWith('{')) {
      json = value
    } else {
      return { layout: null, error: 'That does not look like a banksia.io layout string.' }
    }
  } catch {
    return { layout: null, error: 'The layout string is damaged and could not be decoded.' }
  }

  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    return { layout: null, error: 'The layout string does not contain valid JSON.' }
  }
  const raw = Array.isArray(parsed) ? parsed : parsed?.widgets
  const layout = normaliseLayout(raw)
  if (!layout.length) return { layout: null, error: 'That layout contains no recognisable widgets.' }
  return { layout, error: '' }
}
