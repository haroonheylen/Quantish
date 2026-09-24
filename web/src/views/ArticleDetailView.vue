<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api, ApiError } from '@/api/client';
import type { ArticleNode } from '@/api/types';
import AsyncState from '@/components/AsyncState.vue';
import { useAsync } from '@/composables/useAsync';
import {
  formatEuro,
  formatProperties,
  formatQuantity,
  formatType,
  formatUnit,
  formatUnitPrice,
  sumMoney,
} from '@/lib/format';

// The router passes the :id from the URL as a prop (props: true in the router).
const props = defineProps<{ id: string }>();
const router = useRouter();

// The tree is loaded alongside the article to build the breadcrumb.
const { data, error, loading, run } = useAsync(async () => {
  const [article, tree] = await Promise.all([api.getArticle(props.id), api.getTree()]);
  return { article, breadcrumb: ancestorsOf(tree, props.id) ?? [] };
});

// Moving from one article to another (e.g. clicking a sub-article) reuses
// this component with a new id, so reload whenever the id changes.
// immediate: true also runs it on first load.
watch(() => props.id, run, { immediate: true });

// The chain of parents above an article, top-level first.
// Returns null if the article isn't in this part of the tree.
function ancestorsOf(nodes: ArticleNode[], id: string, trail: ArticleNode[] = []): ArticleNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return trail;
    const found = ancestorsOf(node.children, id, [...trail, node]);
    if (found) return found;
  }
  return null;
}

// Sum of this article's own objects, excluding sub-articles.
// Done with exact cent arithmetic, never floats.
const ownTotal = computed(() =>
  data.value ? sumMoney(data.value.article.objects.map((object) => object.lineTotal)) : '0.00',
);

// ---- Delete ----

const deleting = ref(false);
const deleteError = ref<string | null>(null);

async function remove(): Promise<void> {
  if (!data.value) return;
  const { article } = data.value;

  // Spell out the consequences, since they differ for sub-articles and objects.
  const confirmed = window.confirm(
    `Delete ${article.code} ${article.title}?\n\n` +
      'Its sub-articles will be deleted too. ' +
      'Its objects are kept and become unassigned.',
  );
  if (!confirmed) return;

  deleting.value = true;
  deleteError.value = null;
  try {
    await api.deleteArticle(article.id);
    // Land on the parent if there is one, otherwise back on the bill.
    await router.push(
      article.parentId
        ? { name: 'article-detail', params: { id: article.parentId } }
        : { name: 'articles' },
    );
  } catch (e) {
    deleteError.value = e instanceof ApiError ? e.message : 'This article could not be deleted.';
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <AsyncState :loading="loading" :error="error" :ready="data !== null" @retry="run">
    <template v-if="data">
      <nav class="breadcrumb no-print" aria-label="Breadcrumb">
        <ol>
          <li><RouterLink to="/">Bill of quantities</RouterLink></li>
          <li v-for="ancestor in data.breadcrumb" :key="ancestor.id">
            <RouterLink :to="{ name: 'article-detail', params: { id: ancestor.id } }">
              {{ ancestor.code }} {{ ancestor.title }}
            </RouterLink>
          </li>
          <li aria-current="page">{{ data.article.code }}</li>
        </ol>
      </nav>

      <div class="page-header">
        <div>
          <p class="code">{{ data.article.code }}</p>
          <h1>{{ data.article.title }}</h1>
        </div>
        <div class="actions no-print">
          <RouterLink
            :to="{ name: 'article-create', query: { parentId: data.article.id } }"
            class="btn btn-secondary"
          >
            Add sub-article
          </RouterLink>
          <button type="button" class="btn btn-danger" :disabled="deleting" @click="remove">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>

      <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>

      <!--
        The description is HTML. v-html is normally an XSS risk, but the API
        runs every description through sanitize-html before storing it,
        which is what makes rendering it here safe.
      -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="data.article.description" class="description" v-html="data.article.description" />

      <dl class="totals">
        <div>
          <dt>Total, incl. sub-articles</dt>
          <dd>{{ formatEuro(data.article.total) }}</dd>
        </div>
        <div>
          <dt>Own objects</dt>
          <dd>{{ formatEuro(ownTotal) }}</dd>
        </div>
        <div>
          <dt>Number of objects</dt>
          <dd>{{ data.article.objects.length }}</dd>
        </div>
      </dl>

      <section v-if="data.article.children.length > 0" class="section">
        <h2>Sub-articles</h2>
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
              <tr v-for="child in data.article.children" :key="child.id">
                <td class="code col-code">{{ child.code }}</td>
                <td>
                  <RouterLink :to="{ name: 'article-detail', params: { id: child.id } }">
                    {{ child.title }}
                  </RouterLink>
                </td>
                <td class="amount">{{ formatEuro(child.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>Objects</h2>

        <p v-if="data.article.objects.length === 0" class="muted">
          {{
            data.article.children.length > 0
              ? 'No objects are assigned directly to this article. Its objects sit in the sub-articles above.'
              : 'No objects are assigned to this article yet.'
          }}
        </p>

        <div v-else class="table-wrap">
          <table class="ledger">
            <thead>
              <tr>
                <th scope="col">Object</th>
                <th scope="col">Type</th>
                <th scope="col" class="amount">Quantity</th>
                <th scope="col" class="amount">Unit price</th>
                <th scope="col" class="amount">Line total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="object in data.article.objects" :key="object.id">
                <td>
                  <div>{{ object.name }}</div>
                  <div v-if="formatProperties(object.properties)" class="properties muted">
                    {{ formatProperties(object.properties) }}
                  </div>
                </td>
                <td>{{ formatType(object.type) }}</td>
                <td class="amount">
                  {{ formatQuantity(object.quantity) }} {{ formatUnit(object.unit) }}
                </td>
                <td class="amount">
                  {{ formatUnitPrice(object.unitPrice) }}
                  <span class="muted">/ {{ formatUnit(object.unit) }}</span>
                </td>
                <td class="amount">{{ formatEuro(object.lineTotal) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total of own objects</td>
                <td class="amount">{{ formatEuro(ownTotal) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </template>
  </AsyncState>
</template>

<style scoped>
.breadcrumb ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}
/* A slash between items, drawn in CSS so screen readers skip it. */
.breadcrumb li + li::before {
  content: '/';
  margin-right: var(--space-2);
  color: var(--rule-strong);
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.description {
  max-width: 68ch;
  margin-bottom: var(--space-5);
}
.description :deep(p) {
  margin: 0 0 var(--space-3);
}

.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 0;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
}
.totals > div {
  padding: var(--space-4);
  border-right: 1px solid var(--rule);
}
.totals > div:last-child {
  border-right: none;
}
.totals dt {
  font-size: var(--text-sm);
  color: var(--ink-muted);
}
.totals dd {
  margin: var(--space-1) 0 0;
  font-size: var(--text-lg);
  font-weight: 600;
}

.col-code {
  width: 120px;
}

.properties {
  font-size: var(--text-sm);
}
</style>