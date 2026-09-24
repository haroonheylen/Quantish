import { ref, type Ref } from 'vue';
import { ApiError } from '@/api/client';

// Wraps any API call with the three states every screen needs:
// loading, error, and data. Screens call run() to (re)load.
// A composable is Vue's way of sharing stateful logic between components.
export function useAsync<T>(loader: () => Promise<T>) {
  // The cast keeps Vue from deep-unwrapping T's type.
  const data = ref(null) as Ref<T | null>;
  const error = ref<ApiError | null>(null);
  const loading = ref(false);

  async function run(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      data.value = await loader();
    } catch (e) {
      error.value = e instanceof ApiError ? e : new ApiError(0, ['Something went wrong.']);
    } finally {
      loading.value = false;
    }
  }

  return { data, error, loading, run };
}