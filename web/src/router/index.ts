import { createRouter, createWebHistory } from 'vue-router';

// Lazy imports: each screen is its own chunk, loaded when first visited.
const router = createRouter({
  // Real URLs (/articles/abc) instead of hash URLs (/#/articles/abc).
  // This is why nginx needs the try_files fallback.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'articles', component: () => import('@/views/ArticlesView.vue') },
    {
      // Must come before /articles/:id, or "new" would be read as an id.
      path: '/articles/new',
      name: 'article-create',
      component: () => import('@/views/CreateArticleView.vue'),
    },
    {
      path: '/articles/:id',
      name: 'article-detail',
      component: () => import('@/views/ArticleDetailView.vue'),
      // Pass the :id param to the component as a prop.
      props: true,
    },
    { path: '/summary', name: 'summary', component: () => import('@/views/SummaryView.vue') },
  ],
});

export default router;