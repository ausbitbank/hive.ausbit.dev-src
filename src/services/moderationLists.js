// Curated list discovery.
//
// Hive has no global "all mute lists" index. These are explicit seeds verified
// against the live chain on 2026-11-24, plus a live count refresh for the
// smaller lists. They are shown default-unsubscribed; subscribing is a normal
// posting-key follow operation and never automatic.

export const DISCOVERY_LISTS = [
  {
    id: 'hive-blog-phishing',
    owner: 'hive.blog',
    type: 'mute',
    group: 'phishing',
    title: 'Phishing accounts',
    description: "Hive.blog's phishing and hacked-account mute list. It overlaps the Plenty of Phish source (785 shared names) and adds newer entries.",
    status: 'maintained',
    statusLabel: 'Maintained',
    knownCount: 956,
    asOf: '2026-11-24',
    fetchCount: true,
    caution: 'Narrow phishing/hacked-account list. Safe starting point for most viewers.'
  },
  {
    id: 'plentyofphish',
    owner: 'plentyofphish',
    type: 'mute',
    group: 'phishing',
    title: 'Plenty of Phish — source list',
    description: 'The Plenty of Phish project list, used as a source by hive.blog and several anti-abuse tools. Static since 2021; the GitHub file is still the canonical phishing reference.',
    status: 'static',
    statusLabel: 'Static source',
    knownCount: 914,
    asOf: '2021-02-26',
    fetchCount: true,
    caution: 'Older than the hive.blog list; use both only if you want the extra 129 legacy entries.'
  },
  {
    id: 'ecency-spam',
    owner: 'ecency',
    type: 'mute',
    group: 'active',
    title: 'Ecency team mute list',
    description: "Ecency's active team mute list for spam, airdrop and bot accounts. It is app-maintained, not a published anti-abuse policy.",
    status: 'active',
    statusLabel: 'Active',
    knownCount: 71,
    asOf: '2026-11-24',
    fetchCount: true,
    caution: 'Review before subscribing: it is broader than phishing and includes spam/bot accounts.'
  },
  {
    id: 'spaminator-blacklist',
    owner: 'spaminator',
    type: 'blacklist',
    group: 'legacy',
    title: 'Spaminator / Hivewatchers blacklist',
    description: 'A legacy Spaminator/Hivewatchers warning list with a documented Discord appeal path. Only 35 on-chain names; the last on-chain list update was 2023.',
    status: 'legacy',
    statusLabel: 'Legacy',
    knownCount: 35,
    asOf: '2023-03-05',
    fetchCount: true,
    caution: 'Legacy list. Prefer a current list unless you specifically want this provenance.'
  },
  {
    id: 'themarkymark-blacklist',
    owner: 'themarkymark',
    type: 'blacklist',
    group: 'advanced',
    title: 'Hive Analytics blacklist (very large)',
    description: 'An actively updated Hive Analytics warning list with roughly 70,963 on-chain names. The client indexes at most 10,000 names, so treat the count as a lower bound in this view.',
    status: 'large',
    statusLabel: 'Active / very large',
    knownCount: 70963,
    asOf: '2026-11-24',
    fetchCount: false,
    caution: 'Advanced use only. This is a broad bot/spam label set; it can add a label to a large share of accounts.'
  }
]

export const DISCOVERY_GROUP_LABELS = {
  phishing: 'Phishing and hacked accounts',
  active: 'Active app-maintained lists',
  legacy: 'Legacy',
  advanced: 'Advanced / very large'
}

export function discoveryListById (id) {
  return DISCOVERY_LISTS.find(item => item.id === id) || null
}
