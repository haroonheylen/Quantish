<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '@/api/client';
import type { ArticleNode } from '@/api/types';
import AsyncState from '@/components/AsyncState.vue';
import { useAsync } from '@/composables/useAsync';
import { CODE_PATTERN, codeSegments, suggestNextCode } from '@/lib/codes';
import { plainTextToHtml } from '@/lib/text';

const route = useRoute();
const router = useRouter();

// The tree feeds the parent picker, code suggestions and the duplicate check.
const { data: tree, error, loading, run } = useAsync(() => api.getTree());

// ---- Parent options ----

interface ParentOption {
  id: string;
  code: string;
  title: string;
  depth: number;
  childCodes: string[];
}

const parentOptions = computed<ParentOption[]>(() => {
  const result: ParentOption[] = [];
  const walk = (nodes: ArticleNode[], depth: number) => {
    for (const node of nodes) {
      result.push({
        id: node.id,
        code: node.code,
        title: node.title,
        depth,
        childCodes: node.children.map((child) => child.code),
      });
      walk(node.children, depth + 1);
    }
  };
  walk(tree.value ?? [], 0);
  return result;
});

const existingCodes = computed(() => new Set(parentOptions.value.map((option) => option.code)));

// ---- Form state ----

// parentId '' means "top-level", because a <select> can't hold null.
const form = reactive({ parentId: '', code: '', title: '', description: '' });

// Once the user edits the code, stop overwriting it with suggestions.
const codeTouched = ref(false);
// Errors only show after the first submit, so the form doesn't shout while you type.
const submitted = ref(false);
const saving = ref(false);
const serverErrors = ref<string[]>([]);

const selectedParent = computed(
  () => parentOptions.value.find((option) => option.id === form.parentId) ?? null,
);

const suggestedCode = computed(() => {
  const parent = selectedParent.value;
  const siblings = parent ? parent.childCodes : (tree.value ?? []).map((node) => node.code);
  return suggestNextCode(parent?.code ?? null, siblings);
});

// Keep the code in step with the chosen parent until the user takes over.
watch(
  suggestedCode,
  (code) => {
    if (!codeTouched.value) form.code = code;
  },
  { immediate: true },
);

onMounted(async () => {
  await run();
  // "Add sub-article" on a detail page links here with ?parentId=...
  const requested = route.query.parentId;
  if (typeof requested === 'string' && parentOptions.value.some((option) => option.id === requested)) {
    form.parentId = requested;
  }
});

// ---- Validation ----

// The same rules as the API, checked instantly. The API still has the final say.
const errors = computed(() => {
  const result: { code?: string; title?: string } = {};
  const parent = selectedParent.value;
  const depth = codeSegments(form.code).length;

  if (!CODE_PATTERN.test(form.code)) {
    result.code = 'Use groups of digits that each end in a dot, for example 20.10.';
  } else if (existingCodes.value.has(form.code)) {
    result.code = `${form.code} is already used by another article.`;
  } else if (
    parent &&
    (!form.code.startsWith(parent.code) || depth !== codeSegments(parent.code).length + 1)
  ) {
    result.code = `A sub-article of ${parent.code} adds one group to its code, for example ${suggestedCode.value}`;
  } else if (!parent && depth !== 1) {
    result.code = `A top-level article has a single group, for example ${suggestedCode.value}`;
  }

  if (!form.title.trim()) {
    result.title = 'Give the article a title.';
  }

  return result;
});

const hasErrors = computed(() => Object.keys(errors.value).length > 0);

// Cancel returns to where the user came from.
const cancelTarget = computed(() =>
  selectedParent.value
    ? { name: 'article-detail', params: { id: selectedParent.value.id } }
    : { name: 'articles' },
);

// ---- Submit ----

async function submit(): Promise<void> {
  submitted.value = true;
  if (hasErrors.value) return;

  saving.value = true;
  serverErrors.value = [];
  try {
    const created = await api.createArticle({
      code: form.code,
      title: form.title.trim(),
      description: plainTextToHtml(form.description),
      parentId: form.parentId || null,
    });
    // Go straight to the new article.
    await router.push({ name: 'article-detail', params: { id: created.id } });
  } catch (e) {
    serverErrors.value = e instanceof ApiError ? e.messages : ['The article could not be created.'];
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page-header">
    <div>
      <h1>New article</h1>
      <p class="muted">Add a chapter or a sub-article to the bill.</p>
    </div>
  </div>

  <AsyncState :loading="loading" :error="error" :ready="tree !== null" @retry="run">
    <!-- novalidate: our own validation replaces the browser's popups. -->
    <form class="form" novalidate @submit.prevent="submit">
      <div v-if="serverErrors.length > 0" class="form-error" role="alert">
        <p v-for="message in serverErrors" :key="message">{{ message }}</p>
      </div>

      <div class="field">
        <label for="parent">Parent</label>
        <select id="parent" v-model="form.parentId">
          <option value="">None, this is a top-level chapter</option>
          <!-- Non-breaking spaces indent the options to show the hierarchy. -->
          <option v-for="option in parentOptions" :key="option.id" :value="option.id">
            {{ '\u00a0\u00a0\u00a0'.repeat(option.depth) }}{{ option.code }} {{ option.title }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="code">Code</label>
        <input
          id="code"
          v-model.trim="form.code"
          class="mono"
          autocomplete="off"
          :aria-invalid="submitted && !!errors.code"
          aria-describedby="code-hint code-error"
          @input="codeTouched = true"
        />
        <p id="code-hint" class="hint">
          Suggested from the parent. Steps of 10 leave room to insert articles later.
        </p>
        <p v-if="submitted && errors.code" id="code-error" class="field-error">{{ errors.code }}</p>
      </div>

      <div class="field">
        <label for="title">Title</label>
        <input
          id="title"
          v-model="form.title"
          autocomplete="off"
          :aria-invalid="submitted && !!errors.title"
          aria-describedby="title-error"
        />
        <p v-if="submitted && errors.title" id="title-error" class="field-error">
          {{ errors.title }}
        </p>
      </div>

      <div class="field">
        <label for="description">Description <span class="muted">(optional)</span></label>
        <textarea id="description" v-model="form.description" rows="5" aria-describedby="description-hint" />
        <p id="description-hint" class="hint">Separate paragraphs with a blank line.</p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? 'Creating…' : 'Create article' }}
        </button>
        <RouterLink :to="cancelTarget" class="btn btn-secondary">Cancel</RouterLink>
      </div>
    </form>
  </AsyncState>
</template>

<style scoped>
.form {
  max-width: 560px;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--space-5);
}

.field {
  margin-bottom: var(--space-5);
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: var(--space-2);
}

input,
select,
textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}
input:focus,
select:focus,
textarea:focus {
  border-color: var(--accent);
}
textarea {
  resize: vertical;
}

.mono {
  font-family: var(--font-mono);
}

/* Styled from the aria attribute, so the visual state and the
   accessible state can never disagree. */
[aria-invalid='true'] {
  border-color: var(--danger);
}

.hint,
.field-error {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
}
.hint {
  color: var(--ink-muted);
}
.field-error {
  color: var(--danger);
}

.form-actions {
  display: flex;
  gap: var(--space-2);
}
</style>