
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Index.vue') },
      { path: 'exodus', component: () => import('pages/exodus.vue') },
      { path: '@:username', component: () => import('pages/hiveworld.vue') },
      { path: '@:author/:permlink', component: () => import('pages/post.vue') },
      { path: ':tag/@:author/:permlink', component: () => import('pages/post.vue') }
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
