
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Index.vue') },
      { path: '@:username', component: () => import('pages/account.vue') },
      { path: '@:username/wallet/:token', component: () => import('pages/token.vue') },
      { path: '@:username/wallet', component: () => import('pages/wallet.vue') },
      { path: '@:username/transfers', component: () => import('pages/wallet.vue') },
      { path: '@:username/~owners', component: () => import('pages/owners.vue') },
      // { path: 'hiveworld/@:username', component: () => import('pages/hiveworld.vue') },
      { path: 'account/@:username', component: () => import('pages/account.vue') },
      { path: '@:account/trail', component: () => import('pages/trail.vue') },
      { path: '@:account/followers', component: () => import('pages/connections.vue') },
      { path: '@:account/following', component: () => import('pages/connections.vue') },
      { path: '@:account/posts', component: () => import('pages/browse.vue') },
      { path: '@:account/blog', component: () => import('pages/browse.vue') },
      { path: '@:account/feed', component: () => import('pages/browse.vue') },
      { path: '@:account/replies', component: () => import('pages/browse.vue') },
      { path: '@:account/comments', component: () => import('pages/browse.vue') },
      { path: '@:account/tip', component: () => import('pages/tip.vue') },
      { path: '@:account/communities', component: () => import('pages/communities.vue') },
      { path: '@:author/:permlink', component: () => import('pages/post.vue') },
      { path: ':tag/@:author/:permlink', component: () => import('pages/post.vue') },
      { path: 'block/:blockNum', component: () => import('pages/block.vue') },
      { path: 'b/:blockNum', component: () => import('pages/block.vue') },
      { path: 'tx/:txId', component: () => import('pages/tx.vue') },
      { path: 'nodes', component: () => import('pages/nodes.vue') },
      { path: 'witnesses', component: () => import('pages/witnesses.vue') },
      { path: 'witness', component: () => import('pages/witness.vue') },
      { path: 'market', component: () => import('pages/market.vue') },
      { path: 'markets', component: () => import('pages/markets.vue') },
      { path: 'hbd', component: () => import('pages/hbd.vue') },
      { path: 'twittergiveaway', component: () => import('pages/twittergiveaway.vue') },
      { path: 'health', component: () => import('pages/health.vue') },
      { path: 'browse', component: () => import('pages/browse.vue') },
      { path: 'proposals/:proposal', component: () => import('pages/proposals.vue') },
      { path: 'proposals', component: () => import('pages/proposals.vue') },
      { path: 'dao', component: () => import('pages/proposals.vue') },
      { path: 'downvoter', component: () => import('pages/downvoter.vue') },
      { path: 'hbdstabilizer', component: () => import('pages/hbdstabilizer.vue') },
      { path: 'tax', component: () => import('pages/tax.vue') },
      { path: 'submit', component: () => import('pages/submit.vue') },
      /* { path: 'trending/:tag', component: () => import('pages/browse.vue') },
      { path: 'trending', component: () => import('pages/browse.vue') },
      { path: 'created/:tag', component: () => import('pages/browse.vue') },
      { path: 'created', component: () => import('pages/browse.vue') },
      { path: 'hot/:tag', component: () => import('pages/browse.vue') },
      { path: 'hot', component: () => import('pages/browse.vue') },
      { path: 'promoted/:tag', component: () => import('pages/browse.vue') },
      { path: 'promoted', component: () => import('pages/browse.vue') },
      { path: 'payout/:tag', component: () => import('pages/browse.vue') },
      { path: 'payout', component: () => import('pages/browse.vue') },
      { path: 'payout_comments/:tag', component: () => import('pages/browse.vue') },
      { path: 'payout_comments', component: () => import('pages/browse.vue') }, */
      { path: 'c/:username/:sortMethod', component: () => import('pages/browse.vue') },
      { path: 'c/:username', component: () => import('pages/browse.vue') },
      { path: 'tribes', component: () => import('pages/tribes.vue') },
      { path: 'tribes/:token', component: () => import('pages/tribes.vue') },
      { path: 'tribes/:token/:sortMethod', component: () => import('pages/tribes.vue') },
      { path: 'tribes/:token/:sortMethod/:tag', component: () => import('pages/tribes.vue') },
      { path: ':sortMethod', component: () => import('pages/browse.vue') },
      { path: ':sortMethod/:tag', component: () => import('pages/browse.vue') }
    ]
  }
]

// Always leave this as last one
if (process.env.MODE !== 'ssr') {
  routes.push({
    path: '*',
    component: () => import('pages/Error404.vue')
  })
}

export default routes
