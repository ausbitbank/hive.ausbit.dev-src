// Routes served on `<account>.banksia.io`.
//
// A blog host is a different product surface from the explorer: it has its own
// layout, its own tiny route table and no wallet, governance or block routes.
// Keeping the tables separate means the explorer bundle is never pulled into a
// blog page and a blog path can never shadow an explorer path.

const blogRoutes = [
  {
    path: '/',
    component: () => import('layouts/BlogLayout.vue'),
    children: [
      { path: '', name: 'blog-home', component: () => import('pages/blog/BlogHome.vue') },
      { path: 'about', name: 'blog-about', component: () => import('pages/blog/BlogAbout.vue') },
      { path: 'contact', name: 'blog-contact', component: () => import('pages/blog/BlogContact.vue') },
      { path: 'p/:permlink', name: 'blog-post-fallback', component: () => import('pages/blog/BlogPost.vue') },
      { path: '@:author/:permlink', name: 'blog-post-author', component: () => import('pages/blog/BlogPost.vue') },
      { path: ':permlink', name: 'blog-post', component: () => import('pages/blog/BlogPost.vue') },
      { path: ':catchAll(.*)*', name: 'blog-not-found', component: () => import('pages/blog/BlogNotFound.vue') }
    ]
  }
]

export default blogRoutes
