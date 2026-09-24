<script setup lang="ts">
import type { ApiError } from '@/api/client';

// Every screen has the same three states. This component handles
// loading and errors, and only renders the screen's content (the slot)
// once data is ready. Screens never repeat this logic.
defineProps<{
  loading: boolean;
  error: ApiError | null;
  ready: boolean;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <!-- role="alert" makes screen readers announce the error immediately. -->
  <div v-if="error" class="state state-error" role="alert">
    <p class="state-title">
      {{ error.status === 0 ? 'Connection problem' : 'This page could not be loaded' }}
    </p>
    <p v-for="message in error.messages" :key="message">{{ message }}</p>
    <button type="button" class="btn btn-secondary" @click="$emit('retry')">Try again</button>
  </div>

  <!-- aria-busy tells assistive tech this region is still loading. -->
  <div v-else-if="loading && !ready" class="state" aria-busy="true" aria-live="polite">
    Loading…
  </div>

  <slot v-else-if="ready" />
</template>

<style scoped>
.state {
  padding: var(--space-6) var(--space-5);
  text-align: center;
  color: var(--ink-muted);
}

.state-error {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  color: var(--ink);
}
.state-error p {
  margin: 0 0 var(--space-3);
}

.state-title {
  font-weight: 600;
}
</style>