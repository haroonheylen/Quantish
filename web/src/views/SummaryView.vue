<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '@/api/client';
import AsyncState from '@/components/AsyncState.vue';
import { useAsync } from '@/composables/useAsync';
import { formatEuro } from '@/lib/format';

const { data, error, loading, run } = useAsync(() => api.getSummary());
onMounted(run);

const percentFormat = new Intl.NumberFormat('nl-BE', {
  style: 'percent',
  maximumFractionDigits: 1,
});

// Each chapter's share of the grand total. Number() is fine here:
// this is a proportion for display, not money being added up.
function share(subtotal: string, grandTotal: string): number {
  const total = Number(grandTotal);
  return total > 0 ? Number(subtotal) / total : 0;
}

function print(): void {
  window.print();
}
</script>

<template>
  <div class="page-header">
    <div>
      <h1>Summary</h1>
      <p class="muted">
        Subtotal per top-level article. Objects not yet assigned to an article are not included.
      </p>
    </div>
    <button
      v-if="data && data.articles.length > 0"
      type="button"
      class="btn btn-secondary no-print"
      @click="print"
    >
      Print
    </button>
  </div>

  <AsyncState :loading="loading" :error="error" :ready="data !== null" @retry="run">
    <template v-if="data">
      <div v-if="data.articles.length === 0" class="empty">
        <h2>Nothing to summarise yet</h2>
        <p class="muted">Totals appear here once the bill has articles.</p>
        <RouterLink to="/articles/new" class="btn">Create an article</RouterLink>
      </div>

      <div v-else class="table-wrap">
        <table class="ledger">
          <thead>
            <tr>
              <th scope="col" class="col-code">Code</th>
              <th scope="col">Chapter</th>
              <th scope="col" class="col-share">Share</th>
              <th scope="col" class="amount">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="article in data.articles" :key="article.id">
              <td class="code col-code">{{ article.code }}</td>
              <td>
                <RouterLink :to="{ name: 'article-detail', params: { id: article.id } }">
                  {{ article.title }}
                </RouterLink>
              </td>
              <td class="col-share">
                <div class="share">
                  <!-- The bar is decoration; the percentage next to it carries the information. -->
                  <span class="bar" aria-hidden="true">
                    <span
                      class="bar-fill"
                      :style="{ width: `${share(article.subtotal, data.grandTotal) * 100}%` }"
                    ></span>
                  </span>
                  <span class="muted">
                    {{ percentFormat.format(share(article.subtotal, data.grandTotal)) }}
                  </span>
                </div>
              </td>
              <td class="amount">{{ formatEuro(article.subtotal) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Grand total</td>
              <td class="amount">{{ formatEuro(data.grandTotal) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </AsyncState>
</template>

<style scoped>
.col-code {
  width: 120px;
}

.col-share {
  width: 220px;
}

.share {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.bar {
  flex: 1;
  height: 6px;
  background: var(--rule);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  background: var(--accent);
}

@media print {
  .bar-fill {
    /* Browsers skip background colours when printing unless told otherwise. */
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>