<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '@/api/client';
import type { ArticleNode } from '@/api/types';
import AsyncState from '@/components/AsyncState.vue';
import { useAsync } from '@/composables/useAsync';
import { formatEuro } from '@/lib/format';

// Three independent requests, run in parallel:
// the tree, the summary (for its grand total, calculated by the API rather
// than adding money up in the browser) and the unassigned objects.
const { data, error, loading, run } = useAsync(async () => {
  const [tree, summary, unassigned] = await Promise.all([
    api.getTree(),
    api.getSummary(),
    api.listObjects({ unassigned: true }),
  ]);
  return { tree, summary, unassignedCount: unassigned.length };
});

onMounted(run);

// ---- Expand and collapse ----

// Ids of collapsed articles. Everything starts expanded.
const collapsed = ref(new Set<string>());

function toggle(id: string): void {
  // A new Set rather than mutating the old one, so the change is obvious.
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}

// Every article that has children, i.e. everything that can be collapsed.
const parentIds = computed(() => {
  const ids: string[] = [];
  const walk = (nodes: ArticleNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  walk(data.value?.tree ?? []);
  return ids;
});

function collapseAll(): void {
  collapsed.value = new Set(parentIds.value);
}

function expandAll(): void {
  collapsed.value = new Set();
}

// ---- Rows ----

interface Row {
  node: ArticleNode;
  depth: number;
  hasChildren: boolean;
}

// The tree is flattened into table rows, depth-first, skipping the children
// of collapsed articles. One flat v-for is simpler than a recursive component,
// and keeps it a real table for screen readers.
const rows = computed<Row[]>(() => {
  const result: Row[] = [];
  const walk = (nodes: ArticleNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      result.push({ node, depth, hasChildren });
      if (hasChildren && !collapsed.value.has(node.id)) walk(node.children, depth + 1);
    }
  };
  walk(data.value?.tree ?? [], 0);
  return result;
});
</script>

<template>
  <div class="page-header">
    <div>
      <h1>Bill of quantities</h1>
      <p class="muted">Every total includes the article's sub-articles.</p>
    </div>
    <RouterLink to="/articles/new" class="btn no-print">New article</RouterLink>
  </div>

  <AsyncState :loading="loading" :error="error" :ready="data !== null" @retry="run">
    <!-- The v-if narrows data's type from "maybe null" for the template. -->
    <template v-if="data">
      <div v-if="data.tree.length === 0" class="empty">
        <h2>No articles yet</h2>
        <p class="muted">
          Start with a top-level chapter, for example <span class="code">20.</span> Masonry.
        </p>
        <RouterLink to="/articles/new" class="btn">Create the first article</RouterLink>
      </div>

      <template v-else>
        <p v-if="data.unassignedCount > 0" class="notice">
          {{ data.unassignedCount }}
          {{ data.unassignedCount === 1 ? 'object is' : 'objects are' }}
          not assigned to an article yet, so {{ data.unassignedCount === 1 ? 'it is' : 'they are' }}
          not included in the totals.
        </p>

        <div class="toolbar no-print">
          <button type="button" class="link-button" @click="expandAll">Expand all</button>
          <button type="button" class="link-button" @click="collapseAll">Collapse all</button>
        </div>

        <div class="table-wrap">
          <table class="ledger">
            <thead>
              <tr>
                <th scope="col" class="col-code">Code</th>
                <th scope="col">Article</th>
                <th scope="col" class="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.node.id"
                :class="{ chapter: row.depth === 0 }"
              >
                <td class="code col-code">{{ row.node.code }}</td>
                <td>
                  <!-- Indentation shows the hierarchy, instead of nested boxes. -->
                  <div class="title-cell" :style="{ paddingLeft: `${row.depth * 20}px` }">
                    <button
                      v-if="row.hasChildren"
                      type="button"
                      class="toggle no-print"
                      :aria-expanded="!collapsed.has(row.node.id)"
                      :aria-label="`${collapsed.has(row.node.id) ? 'Expand' : 'Collapse'} ${row.node.code} ${row.node.title}`"
                      @click="toggle(row.node.id)"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        aria-hidden="true"
                        :class="{ closed: collapsed.has(row.node.id) }"
                      >
                        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
                      </svg>
                    </button>
                    <!-- Keeps titles aligned whether or not a row has a toggle. -->
                    <span v-else class="toggle-spacer" aria-hidden="true"></span>

                    <RouterLink :to="{ name: 'article-detail', params: { id: row.node.id } }">
                      {{ row.node.title }}
                    </RouterLink>
                  </div>
                </td>
                <td class="amount">{{ formatEuro(row.node.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">Grand total</td>
                <td class="amount">{{ formatEuro(data.summary.grandTotal) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </template>
    </template>
  </AsyncState>
</template>

<style scoped>
.col-code {
  width: 120px;
}

/* Top-level chapters carry more weight, like headings in a printed bill. */
.chapter td {
  font-weight: 600;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.toggle,
.toggle-spacer {
  flex: 0 0 20px;
  height: 20px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius);
  background: none;
  color: var(--ink-muted);
  cursor: pointer;
}
.toggle:hover {
  background: var(--accent-soft);
  color: var(--ink);
}
.toggle svg {
  transition: transform 0.15s ease;
}
.toggle svg.closed {
  transform: rotate(-90deg);
}

.toolbar {
  display: flex;
  gap: var(--space-4);
  justify-content: flex-end;
  margin-bottom: var(--space-2);
}

.link-button {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}
.link-button:hover {
  text-decoration: underline;
}

@media (prefers-reduced-motion: reduce) {
  .toggle svg {
    transition: none;
  }
}
</style>