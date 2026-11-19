function redirectDiscontinuedSort (to) {
  if (String(to.params.sortMethod || '').toLowerCase() !== 'promoted') return true
  if (to.name === 'community-sorted') {
    return { name: 'community', params: { username: to.params.username }, query: to.query }
  }
  if (to.params.tag) {
    return { name: 'trending', params: { tag: to.params.tag }, query: to.query }
  }
  return { name: 'browse', query: to.query }
}

const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/Index.vue') },
      { path: '@:username', name: 'account', component: () => import('pages/account.vue') },
      { path: '@:username/wallet/:token', name: 'wallet-token', component: () => import('pages/token.vue') },
      { path: '@:username/wallet', name: 'wallet', component: () => import('pages/wallet.vue') },
      { path: '@:username/delegations', name: 'account-delegations', component: () => import('pages/delegations.vue') },
      { path: '@:username/transfers', name: 'wallet-transfers', component: () => import('pages/wallet.vue') },
      { path: 'account/@:username', name: 'account-alias', component: () => import('pages/account.vue') },
      { path: '@:account/trail', name: 'trail', component: () => import('pages/trail.vue') },
      { path: '@:account/followers', name: 'followers', component: () => import('pages/connections.vue') },
      { path: '@:account/following', name: 'following', component: () => import('pages/connections.vue') },
      { path: '@:account/posts', name: 'account-posts', component: () => import('pages/browse.vue') },
      { path: '@:account/blog', name: 'account-blog', component: () => import('pages/browse.vue') },
      { path: '@:account/feed', name: 'account-feed', component: () => import('pages/browse.vue') },
      { path: '@:account/replies', name: 'account-replies', component: () => import('pages/browse.vue') },
      { path: '@:account/comments', name: 'account-comments', component: () => import('pages/browse.vue') },
      { path: '@:account/tip', name: 'account-tip', component: () => import('pages/tip.vue') },
      { path: '@:account/communities', name: 'account-communities', component: () => import('pages/communities.vue') },
      { path: '@:author/:permlink', name: 'post', component: () => import('pages/post.vue') },
      { path: ':tag/@:author/:permlink', name: 'post-tagged', component: () => import('pages/post.vue') },
      { path: 'block/:blockNum', name: 'block', redirect: to => ({ name: 'block-short', params: { blockNum: to.params.blockNum }, query: to.query, hash: to.hash }) },
      { path: 'b/:blockNum', name: 'block-short', component: () => import('pages/block.vue') },
      { path: 'blocks', name: 'blocks', component: () => import('pages/blocks.vue') },
      { path: 'tx/:txId', name: 'tx', component: () => import('pages/tx.vue') },
      { path: 'nodes', name: 'nodes', component: () => import('pages/nodes.vue') },
      { path: 'witnesses', name: 'witnesses', component: () => import('pages/witnesses.vue') },
      { path: 'witness', name: 'witness', component: () => import('pages/witness.vue') },
      { path: 'market', name: 'market', component: () => import('pages/market.vue') },
      { path: 'markets', name: 'markets', component: () => import('pages/markets.vue') },
      { path: 'hbd', name: 'hbd', component: () => import('pages/hbd.vue') },
      { path: 'health', name: 'health', component: () => import('pages/health.vue') },
      { path: 'browse', name: 'browse', component: () => import('pages/browse.vue') },
      { path: 'search/:type(accounts|posts|tags|communities|blocks|transactions|proposals|witnesses)?/:term?', name: 'search', component: () => import('pages/search.vue') },      { path: 'browse/:sortMethod/:tag?', name: 'browse-sorted', component: () => import('pages/browse.vue'), beforeEnter: redirectDiscontinuedSort },
      { path: 'trending/:tag?', name: 'trending', component: () => import('pages/browse.vue'), props: { defaultSort: 'trending' } },
      { path: 'created/:tag?', name: 'created', component: () => import('pages/browse.vue'), props: { defaultSort: 'created' } },
      { path: 'hot/:tag?', name: 'hot', component: () => import('pages/browse.vue'), props: { defaultSort: 'hot' } },
      { path: 'payout/:tag?', name: 'payout', component: () => import('pages/browse.vue'), props: { defaultSort: 'payout' } },
      { path: 'payout_comments/:tag?', name: 'payout-comments', component: () => import('pages/browse.vue'), props: { defaultSort: 'payout_comments' } },
      { path: 'muted/:tag?', name: 'muted', component: () => import('pages/browse.vue'), props: { defaultSort: 'muted' } },
      { path: 'proposals', name: 'proposals', component: () => import('pages/proposals.vue') },
      { path: 'dao', name: 'dao', component: () => import('pages/proposals.vue') },
      { path: 'proposals/:proposalId', name: 'proposal-detail', component: () => import('pages/proposal.vue') },
      { path: 'hbdstabilizer', name: 'hbdstabilizer', component: () => import('pages/hbdstabilizer.vue') },
      { path: 'tax', name: 'tax', component: () => import('pages/tax.vue') },
      { path: 'compose/:draftId?', name: 'compose', component: () => import('pages/compose.vue') },
      { path: 'drafts', redirect: { name: 'compose' } },
      { path: 'create', name: 'create', component: () => import('pages/create.vue') },
      { path: '/token/:token', name: 'token', component: () => import('pages/token.vue') },
      { path: 'c/:username/:sortMethod', name: 'community-sorted', component: () => import('pages/browse.vue'), beforeEnter: redirectDiscontinuedSort },
      { path: 'c/:username', name: 'community', component: () => import('pages/browse.vue') },
      { path: 'shorts', name: 'shorts-index', component: () => import('pages/ShortForm.vue') },
      { path: 'shorts/:formatId', name: 'short-form', component: () => import('pages/ShortFormPage.vue'), props: route => ({ formatId: String(route.params.formatId || '').toLowerCase() }) },
      { path: 'shorts/:formatId/@:author/:permlink', name: 'short-form-post', component: () => import('pages/ShortFormPost.vue'), props: route => ({ formatId: String(route.params.formatId || '').toLowerCase(), author: route.params.author, permlink: route.params.permlink }) }
    ]
  },
  {
    path: '/:catchAll(.*)*',
    name: 'not-found',
    component: () => import('pages/Error404.vue')
  }
]

export default routes
