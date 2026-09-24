<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/" class="brand">Quantish</RouterLink>
      <nav aria-label="Main">
        <!-- RouterLink adds an "active" class to the current page's link. -->
        <RouterLink to="/" class="nav-link" exact-active-class="active">Bill of quantities</RouterLink>
        <RouterLink to="/summary" class="nav-link" active-class="active">Summary</RouterLink>
      </nav>
    </div>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>

<style scoped>
.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
}

.topbar-inner {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-3) var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.brand {
  font-weight: 600;
  font-size: var(--text-lg);
  color: var(--ink);
  letter-spacing: -0.01em;
}
.brand:hover {
  text-decoration: none;
}

nav {
  display: flex;
  gap: var(--space-5);
}

.nav-link {
  color: var(--ink-muted);
  font-weight: 500;
  padding: var(--space-1) 0;
  border-bottom: 2px solid transparent;
}
.nav-link:hover {
  color: var(--ink);
  text-decoration: none;
}
.nav-link.active {
  color: var(--ink);
  border-bottom-color: var(--accent);
}

.page {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-5);
}

@media (max-width: 600px) {
  .topbar-inner,
  .page {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  .topbar-inner {
    gap: var(--space-4);
  }
}
</style>