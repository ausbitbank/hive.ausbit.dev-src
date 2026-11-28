export const REPO = 'ausbitbank/banksia.io'
export const BRANCH = 'master'
export const OWNER = 'ausbitbank'
export const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`
export const BLOB_BASE = `https://github.com/${REPO}/blob/${BRANCH}`
export const HIVE_MAX_BODY_BYTES = 65535
export const HIVE_WARN_BODY_BYTES = 58000
export const DESCRIPTION_MAX = 120
export const WORK_DIR = '.devlog'
export const SHOT_ROOT = 'docs/screenshots/devlog'
export const BLOG_DIR = 'docs/blog'
export const PUBLISHED_POSTS = 'docs/devlog-posts.json'

export const DEFAULTS = {
  account: 'ausbitbank',
  post: '@worldmappin/travel-digest-3105',
  block: '111823900',
  search: 'Steem Hostile Takeover',
  baseUrl: 'http://127.0.0.1:4173'
}

export const SURFACES = [
  {
    key: 'theme',
    label: 'Themes and profile skins',
    patterns: ['src/pages/appearance.vue', 'src/pages/themeWall.vue', 'src/pages/skinStudio.vue', 'src/components/theme/', 'src/stores/appearance.js', 'src/services/badges.js'],
    routes: ['/appearance', '/themes', '/settings/skin'],
    docs: ['W63', 'W66', 'W67', 'W67b'],
    shots: ['appearance', 'theme-wall']
  },
  {
    key: 'home',
    label: 'Home dashboard',
    patterns: ['src/pages/Index.vue', 'src/components/dashboard/', 'src/components/Home'],
    routes: ['/'],
    docs: ['W33', 'W37', 'W38', 'W39', 'W40', 'W65', 'W69'],
    shots: ['home', 'home-content-browser', 'widget-library']
  },
  {
    key: 'post',
    label: 'Posts and comments',
    patterns: ['src/pages/post.vue', 'src/components/post', 'src/components/comment', 'src/components/Comment', 'src/components/render'],
    routes: ['/{{post}}'],
    docs: ['W27', 'W30', 'W44', 'W45'],
    shots: ['post-reading']
  },
  {
    key: 'compose',
    label: 'Composer and drafts',
    patterns: ['src/pages/compose.vue', 'src/components/Markdown', 'src/services/drafts.js', 'src/services/publish.js'],
    routes: ['/compose'],
    docs: ['W26', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W59', 'W60', 'W61', 'W70'],
    shots: ['composer']
  },
  {
    key: 'search',
    label: 'Search and HiveSense',
    patterns: ['src/pages/search.vue', 'src/services/unifiedSearch.js', 'src/services/searchReads.js', 'src/services/hiveSense.js'],
    routes: ['/search?q={{search}}'],
    docs: ['W28', 'W32', 'W41'],
    shots: ['search']
  },
  {
    key: 'communities',
    label: 'Communities',
    patterns: ['src/pages/communities.vue', 'src/pages/communityIndex.vue', 'src/components/community', 'src/services/community.js'],
    routes: ['/@{{account}}/communities', '/communities', '/c/hive-139531'],
    docs: ['W29', 'W34', 'W38', 'W62', 'W64'],
    shots: ['community-directory']
  },
  {
    key: 'account',
    label: 'Account overview',
    patterns: ['src/pages/account.vue', 'src/components/account'],
    routes: ['/@{{account}}'],
    docs: ['W25', 'W34', 'W35'],
    shots: ['account']
  },
  {
    key: 'wallet',
    label: 'Wallet',
    patterns: ['src/pages/wallet.vue', 'src/components/wallet', 'src/services/wallet.js'],
    routes: ['/@{{account}}/wallet'],
    docs: ['W16', 'W35', 'W37'],
    shots: ['wallet', 'wallet-lightning-magi']
  },
  {
    key: 'connections',
    label: 'Followers and following',
    patterns: ['src/pages/connections.vue', 'src/components/userCard', 'src/components/connections'],
    routes: ['/@{{account}}/followers'],
    docs: ['W34', 'W35'],
    shots: ['connections']
  },
  {
    key: 'delegations',
    label: 'Delegations',
    patterns: ['src/pages/delegations.vue', 'src/services/delegations.js'],
    routes: ['/@{{account}}/delegations'],
    docs: ['W25'],
    shots: []
  },
  {
    key: 'witnesses',
    label: 'Witnesses and governance',
    patterns: ['src/pages/witness', 'src/components/witness', 'src/services/witness', 'src/services/governance.js'],
    routes: ['/witnesses', '/witness'],
    docs: ['W17', 'W25', 'W34'],
    shots: ['witnesses', 'witness-analytics']
  },
  {
    key: 'proposals',
    label: 'Proposals and DHF',
    patterns: ['src/pages/proposal', 'src/components/proposal'],
    routes: ['/proposals'],
    docs: ['W25'],
    shots: ['proposals', 'proposal-analytics']
  },
  {
    key: 'nodes',
    label: 'Nodes and network health',
    patterns: ['src/pages/nodes.vue', 'src/pages/health.vue', 'src/components/nodes', 'src/services/hiveNodes.js', 'src/services/beacon.js'],
    routes: ['/nodes', '/health'],
    docs: ['W17', 'W23', 'W31', 'W36'],
    shots: ['nodes-magi']
  },
  {
    key: 'magi',
    label: 'Magi',
    patterns: ['src/pages/magi.vue', 'src/services/magi.js'],
    routes: ['/magi'],
    docs: ['W36', 'W37'],
    shots: ['magi-contract']
  },
  {
    key: 'markets',
    label: 'Markets and HBD',
    patterns: ['src/pages/market', 'src/pages/markets.vue', 'src/components/internalMarket', 'src/components/TradingView', 'src/services/market'],
    routes: ['/markets', '/market', '/hbd', '/hbdstabilizer'],
    docs: ['W18', 'W20'],
    shots: ['markets', 'internal-market', 'hbd']
  },
  {
    key: 'lightning',
    label: 'Lightning',
    patterns: ['src/pages/lightning.vue', 'src/pages/pos.vue', 'src/components/lightning', 'src/services/lightning.js', 'src/services/v4vapp.js', 'src/services/bolt11.js'],
    routes: ['/lightning', '/@{{account}}/lightning', '/@{{account}}/pos'],
    docs: ['W36', 'W52', 'W53', 'W54', 'W55', 'W57', 'W58'],
    shots: ['lightning', 'pos']
  },
  {
    key: 'blocks',
    label: 'Blocks and transactions',
    patterns: ['src/pages/block', 'src/pages/blocks.vue', 'src/pages/tx.vue', 'src/components/tx'],
    routes: ['/blocks', '/b/{{block}}'],
    docs: ['W21', 'W22', 'W34'],
    shots: ['block']
  },
  {
    key: 'platform',
    label: 'Performance, SEO and reliability',
    patterns: ['src/services/api.js', 'src/services/cache.js', 'src/services/telemetry.js', 'src/services/chainData.js', 'src/boot/', 'src/components/ui/', 'scripts/', 'public/'],
    routes: [],
    docs: ['W20', 'W21', 'W22', 'W23', 'W24', 'W27b', 'W34'],
    shots: ['mobile-home']
  }
]

export const SECTIONS = [
  {
    key: 'theme',
    title: 'A Hive that looks like you',
    surfaces: ['theme'],
    promise: 'Lead with the new theme system and profile skins: built-in palettes, a skin studio, badge shelf, atmosphere and viewer controls. Explain what is safe to share and what stays local.'
  },
  {
    key: 'home',
    title: 'The home page is now your home page',
    surfaces: ['home'],
    promise: 'Lead with the feeling: the front page now shows what this reader cares about. Explain the widget catalogue, saved layouts and the default HiveDevs feed.'
  },
  {
    key: 'writing',
    title: 'Reading, writing and owning your words',
    surfaces: ['post', 'compose'],
    promise: 'Cover the reading view, editing and deleting, cross-post attribution, embedded media and the local-first composer.'
  },
  {
    key: 'discovery',
    title: 'Search that understands the question, not just the words',
    surfaces: ['search', 'communities'],
    promise: 'Explain semantic search in plain English, then the communities directory, feed sources and the canonical browse changes.'
  },
  {
    key: 'account',
    title: 'Your account, your wallet, your people',
    surfaces: ['account', 'wallet', 'connections', 'delegations'],
    promise: 'This is the money section. Explain the portfolio, pending actions, Hive-Engine, Magi, connections and authority risk without drowning the reader in protocol detail.'
  },
  {
    key: 'governance',
    title: 'Witnesses, proposals and the network behind them',
    surfaces: ['witnesses', 'proposals', 'nodes', 'magi'],
    promise: 'Explain what the new analytics actually answer: who controls the chain, where the DHF goes, which nodes are healthy and what Magi is.'
  },
  {
    key: 'markets',
    title: 'Markets, HBD and the internal exchange',
    surfaces: ['markets'],
    promise: 'Cover the chart, peg, savings APR and conversion tools, plus the order book and trading panel.'
  },
  {
    key: 'lightning',
    title: 'Lightning, without the scary parts',
    surfaces: ['lightning'],
    promise: 'Explain the user journey and the safety model: address, receive, pay, fees, no custody, queued active-key review.'
  },
  {
    key: 'explorer',
    title: 'The explorer itself',
    surfaces: ['blocks'],
    promise: 'A short section on block and transaction pages, grouped operations, raw JSON and noindex for missing records.'
  },
  {
    key: 'platform',
    title: 'Faster, sturdier, more shareable',
    surfaces: ['platform'],
    promise: 'Use the performance numbers, then explain reliability, SEO, accessibility, signing safety and testing in plain language.'
  }
]

export const TAG_DEFAULTS = ['hive', 'dev', 'update', 'open-source', 'lightning']

const HOME_BODY = `## What changed

This update covers the last few days of dashboard, wallet, search and network work.

- A dashboard you can arrange
- Semantic search with HiveSense
- Lightning receive and pay

| Area | Change |
| --- | --- |
| Home | Widgets and named layouts |
| Wallet | Magi balances |
| Nodes | Hive, Hive-Engine, Magi |`

export const SHOT_RECIPES = {
  appearance: {
    route: '/appearance',
    waitMs: 6000,
    viewport: { width: 1440, height: 1300 },
    crop: '1280x1200+80+50',
    alt: 'The appearance page with site theme cards, mode controls and a profile skin panel',
    caption: 'Site theme, mode and profile skin are separate: change how the site looks without changing your profile.'
  },
  'theme-wall': {
    route: '/themes',
    waitMs: 7000,
    viewport: { width: 1440, height: 1200 },
    crop: '1280x1050+80+50',
    alt: 'The theme wall showing built-in palettes with swatches, modes and moods',
    caption: 'The theme wall browses built-in palettes and, when signed in, skins from people you follow.'
  },
  home: {
    route: '/',
    waitMs: 26000,
    waitForText: 'Produced by',
    viewport: { width: 1440, height: 1100 },
    crop: '1280x820+80+50',
    alt: 'The banksia.io dashboard, with live block, coin prices, top witnesses and community feeds',
    caption: 'The new home dashboard: live chain data and community feeds in one arranged view.'
  },
  'home-content-browser': {
    route: '/',
    waitMs: 26000,
    viewport: { width: 1440, height: 1500 },
    scrollY: 860,
    crop: '1280x1350+80+50',
    alt: 'The content browser showing trending, account and community post cards',
    caption: 'The content browser is one widget with feed references and card, compact and list views.'
  },
  'dashboard-editor': {
    route: '/',
    waitMs: 24000,
    viewport: { width: 1440, height: 1100 },
    actions: [
      { clickRole: 'button', name: 'Customise', index: 0 },
      { waitMs: 1000 },
      { clickRole: 'button', name: 'Add widget', index: 0 }
    ],
    crop: '1360x1050+80+50',
    alt: 'Dashboard edit mode with the widget catalogue open',
    caption: 'Edit mode works on a draft: add, move, resize and configure widgets before saving.'
  },
  'widget-library': {
    route: '/',
    waitMs: 24000,
    viewport: { width: 1440, height: 1100 },
    actions: [
      { clickRole: 'button', name: 'Customise', index: 0 },
      { waitMs: 1000 },
      { clickRole: 'button', name: 'Add widget', index: 0 },
      { waitMs: 1000 },
      { wheelSelector: '.dw-drawer__body', deltaY: 1200 }
    ],
    crop: '880x1050+560+50',
    alt: 'The widget library showing wallet, notifications and live operations widgets',
    caption: 'The widget library includes the wallet, notifications, live operations and content browser.'
  },
  'post-reading': {
    route: '/{{post}}',
    waitMs: 22000,
    crop: '1280x1040+80+55',
    alt: 'A post page with the article, author card, post details and tip panel',
    caption: 'The post page keeps the article first and the author, tip and activity details in the sidebar.'
  },
  composer: {
    route: '/compose',
    waitMs: 5000,
    actions: [
      { fill: 'input[placeholder="A clear, specific title"]', value: 'Three days of building on Hive' },
      { type: 'textarea.compose-textarea', value: HOME_BODY, delay: 2 },
      { waitMs: 1800 }
    ],
    crop: '1280x1040+80+55',
    alt: 'The composer with live draft state, markdown tools and a publish checklist',
    caption: 'The composer autosaves locally, previews the rendered post and queues a normal posting-key comment.'
  },
  search: {
    route: '/search?q={{search}}',
    waitMs: 16000,
    actions: [{ scrollToText: 'Posts', offset: 90 }],
    crop: '1280x1040+80+55',
    alt: 'Search results showing semantic matches, facets and the Smart search panel',
    caption: 'HiveSense puts posts that are about the query first; keyword-only results are labelled separately.'
  },
  communities: {
    route: '/@{{account}}/communities',
    waitMs: 50000,
    actions: [{ scrollToText: 'Communities @{{account}} belongs to', offset: 60 }],
    crop: '1280x1000+80+50',
    alt: 'The communities directory with roles, subscriber counts and per-community links',
    caption: 'The communities directory shows role, size, activity, rewards and quick feed links.'
  },
  'community-directory': {
    route: '/communities',
    waitMs: 16000,
    viewport: { width: 1440, height: 1250 },
    crop: '1280x1100+80+50',
    alt: 'The public community directory with category filters, stats and community cards',
    caption: 'The public community directory works before you sign in: categories, size, activity and a feed link.'
  },
  account: {
    route: '/@{{account}}',
    waitMs: 22000,
    actions: [{ scrollToText: 'ACCOUNT OVERVIEW', offset: 60 }],
    crop: '1280x1000+80+50',
    alt: 'The account overview with voting power, resource credits, rewards and authority information',
    caption: 'The account overview pulls the numbers that usually need a calculator into one view.'
  },
  wallet: {
    route: '/@{{account}}/wallet',
    waitMs: 24000,
    actions: [{ scrollToText: 'WALLET PORTFOLIO', offset: 60 }],
    crop: '1280x1000+80+50',
    alt: 'The wallet portfolio with five asset cards and recent activity',
    caption: 'One portfolio total, five asset cards and a paginated activity history.'
  },
  'wallet-lightning-magi': {
    route: '/@{{account}}/wallet',
    waitMs: 24000,
    actions: [{ scrollToText: 'Lightning', last: true, offset: 120 }],
    crop: '1280x960+80+50',
    alt: 'The wallet Lightning and Magi sections',
    caption: 'The wallet also carries the Lightning address and the Magi balances and ledger activity.'
  },
  connections: {
    route: '/@{{account}}/followers',
    waitMs: 24000,
    actions: [{ scrollToSelector: 'h1.page-title', offset: 110 }],
    crop: '1280x1000+80+50',
    alt: 'The followers page with search, sorting, profile filters and compact cards',
    caption: 'Followers and following got a searchable, sortable and progressively loaded connection surface.'
  },
  witnesses: {
    route: '/witnesses',
    waitMs: 24000,
    crop: '1280x900+80+50',
    alt: 'The witness directory with health warnings, vote controls and a vote-weight calculator',
    caption: 'The witness directory shows health warnings, vote slots, proxy controls and a projection calculator.'
  },
  'witness-analytics': {
    route: '/witnesses',
    waitMs: 24000,
    element: 'section.gov-analytics',
    alt: 'Witness concentration, feed freshness, version drift and missed-block analytics',
    caption: 'The analytics answer who controls the chain, which feeds are stale and where missed blocks cluster.'
  },
  proposals: {
    route: '/proposals',
    waitMs: 26000,
    crop: '1280x800+80+50',
    alt: 'The DHF proposals page with funding status and daily pay',
    caption: 'The DHF page shows what is funded today, what is committed and what the fund can afford next.'
  },
  'proposal-analytics': {
    route: '/proposals',
    waitMs: 26000,
    element: 'section.prop-analytics',
    alt: 'Proposal funding outlook, monthly commitment and creator, receiver and topic mix',
    caption: 'Funding outlook, monthly commitments and where the money goes by creator, receiver and topic.'
  },
  markets: {
    route: '/markets',
    waitMs: 18000,
    actions: [
      { clickRole: 'button', name: 'Load chart', index: 0 },
      { waitMs: 7000 }
    ],
    crop: '1280x1040+80+50',
    alt: 'The markets page with a responsive TradingView chart and HBD peg tools',
    caption: 'The chart, HBD peg and conversion tools are one page, with pair and interval state in the URL.'
  },
  'internal-market': {
    route: '/market',
    waitMs: 18000,
    crop: '1280x830+80+50',
    alt: 'The internal market with cumulative order-book depth, recent trades and a limit-order panel',
    caption: 'The internal market shows real depth, recent trades and a balance-aware limit-order panel.'
  },
  hbd: {
    route: '/hbd',
    waitMs: 18000,
    crop: '1280x720+80+50',
    alt: 'The HBD monitor with debt ratio, haircut conditions and savings APR',
    caption: 'The HBD monitor explains the peg, the debt ratio and the conditions that would trigger a haircut.'
  },
  'nodes-magi': {
    route: '/nodes',
    waitMs: 26000,
    actions: [
      { clickRole: 'button', name: 'Magi', index: 0 },
      { waitMs: 16000 }
    ],
    crop: '1280x1040+80+50',
    alt: 'The Magi node tab with processed head, consensus version and registered witnesses',
    caption: 'The node tool now covers Hive L1, Hive-Engine and Magi, with independent selection and failover.'
  },
  'magi-contract': {
    route: '/magi',
    waitMs: 18000,
    actions: [
      { clickSelector: 'a[href*="vsc1"]', index: 0 },
      { waitMs: 10000 }
    ],
    crop: '1280x900+80+50',
    alt: 'The Magi contract viewer with contract metadata, a state reader and call simulation',
    caption: 'The Magi contract viewer reads metadata, recent outputs, state keys and read-only simulations.'
  },
  lightning: {
    route: '/@{{account}}/lightning',
    waitMs: 18000,
    crop: '1280x1040+80+50',
    alt: 'A Hive account Lightning page with address, QR code, receive card and fee explanation',
    caption: 'The Lightning page gives every account an address, QR code, receive flow and clear fee disclosure.'
  },
  pos: {
    route: '/@{{account}}/pos',
    waitMs: 7000,
    viewport: { width: 1440, height: 1150 },
    crop: '1280x1020+80+50',
    alt: 'The Lightning point of sale with an amount keypad, memo field and invoice panel',
    caption: 'The point of sale turns an account page into a till: amount, memo, a fresh invoice and a paid state.'
  },
  block: {
    route: '/b/{{block}}',
    waitMs: 18000,
    crop: '1280x930+80+50',
    alt: 'A block page with grouped transactions, friendly operation labels and raw JSON tabs',
    caption: 'Blocks group transactions and virtual operations and keep the raw JSON one click away.'
  },
  about: {
    route: '/about',
    waitMs: 5000,
    viewport: { width: 1440, height: 1500 },
    crop: '1280x1300+80+50',
    alt: 'The Banksia About page with the brand story, the flower-spike mark and the principles behind the app',
    caption: 'The About page explains the name, the mark and what Banksia is for.'
  },
  'about-mark': {
    route: '/about',
    waitMs: 5000,
    viewport: { width: 1440, height: 1500 },
    actions: [{ scrollToText: 'The name and the mark', offset: 90 }],
    crop: '1280x1050+80+50',
    alt: 'The Banksia name and mark cards, including the flower-spike illustration and the app icon',
    caption: 'A banksia flower spike built from honeycomb cells: the plant, the hive and the chain in one mark.'
  },
  join: {
    route: '/join',
    waitMs: 12000,
    viewport: { width: 1440, height: 1600 },
    crop: '1280x1400+80+50',
    alt: 'The Join Hive page with key generation, sponsor and verified provider paths',
    caption: 'There are now three honest ways in: make keys and a claim link, ask a sponsor, or buy from a verified provider.'
  },
  'join-keys': {
    route: '/join/keys',
    waitMs: 5000,
    viewport: { width: 1440, height: 1500 },
    crop: '1280x1300+80+50',
    alt: 'The create-your-keys page with the username field, local key generation and claim-link explanation',
    caption: 'Keys are generated in the browser; the claim link carries only the username and public keys.'
  },
  moderation: {
    route: '/settings/moderation',
    waitMs: 14000,
    viewport: { width: 1440, height: 1500 },
    crop: '1280x1300+80+50',
    alt: 'The moderation settings page with presets, the phishing safety floor and per-surface rules',
    caption: 'Moderation is local, visible and reversible: presets, a per-surface matrix, list subscriptions and a named safety floor.'
  },
  downvotes: {
    route: '/@{{account}}/downvotes',
    waitMs: 20000,
    viewport: { width: 1440, height: 1400 },
    crop: '1280x1200+80+50',
    alt: 'The downvotes page with summary cards, relationship filters and an explicit no-pattern verdict',
    caption: 'Downvote transparency shows the public votes, the relationships and the evidence behind a pattern hint; a missing pattern is stated plainly.'
  },
  'community-moderation': {
    route: '/c/hive-167922',
    waitMs: 22000,
    viewport: { width: 1440, height: 1500 },
    actions: [{ scrollToText: 'Community moderation context', offset: 90 }],
    crop: '1280x1200+80+50',
    alt: 'The community moderation context card with muted-reason counts, recent muted posts and team roles',
    caption: 'A community page now explains what the community muted, which bridge reason applied, and what it does not know.'
  },
  'quick-look': {
    route: '/created?peek=@worldmappin/travel-digest-3105',
    waitMs: 24000,
    viewport: { width: 1280, height: 1150 },
    crop: '1280x1150+0+0',
    alt: 'The quick-look sheet open over a feed, with the post title, body, vote control and a link to the full post',
    caption: 'Quick look opens a reading sheet from the feed, so a vote or a closer read does not cost your place.'
  },
  'mobile-home': {
    route: '/',
    waitMs: 26000,
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
    alt: 'The dashboard on a 390px phone with the same widgets in a single column',
    caption: 'The dashboard collapses to a single column on a phone without losing the widgets.'
  }
}

export const RECIPE_KEYS = Object.keys(SHOT_RECIPES)

export function surfaceByKey (key) {
  return SURFACES.find(surface => surface.key === key)
}

export function recipesForSurfaces (keys) {
  const out = []
  for (const key of keys) {
    const surface = surfaceByKey(key)
    if (!surface) continue
    for (const recipe of surface.shots) if (!out.includes(recipe)) out.push(recipe)
  }
  return out
}
