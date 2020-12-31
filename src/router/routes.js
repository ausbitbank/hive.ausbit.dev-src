
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Index.vue') },
      { path: '@:username', component: () => import('pages/account.vue') },
      { path: '@:username/wallet', component: () => import('pages/wallet.vue') },
      { path: '@:username/transfers', component: () => import('pages/wallet.vue') },
      { path: 'hiveworld/@:username', component: () => import('pages/hiveworld.vue') },
      { path: 'account/@:username', component: () => import('pages/account.vue') },
      { path: '@:account/trail', component: () => import('pages/trail.vue') },
      { path: '@:author/:permlink', component: () => import('pages/post.vue') },
      { path: ':tag/@:author/:permlink', component: () => import('pages/post.vue') },
      { path: 'block/:blockNum', component: () => import('pages/block.vue') },
      { path: 'b/:blockNum', component: () => import('pages/block.vue') },
      { path: 'tx/:txId', component: () => import('pages/tx.vue') },
      { path: 'nodes', component: () => import('pages/nodes.vue') },
      { path: 'witnesses', component: () => import('pages/witnesses.vue') },
      { path: 'markets', component: () => import('pages/markets.vue') },
      { path: 'hbd', component: () => import('pages/hbd.vue') },
      { path: 'twittergiveaway', component: () => import('pages/twittergiveaway.vue') },
      { path: 'health', component: () => import('pages/health.vue') }
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
