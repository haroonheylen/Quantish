import type {
  Article,
  ArticleDetail,
  ArticleNode,
  CreateArticleInput,
  Summary,
} from './types';

// One error type for every failure, so screens handle errors the same way.
// Nest sends validation errors as an array of messages and other errors as
// a single string, so both are normalised into a list here.
export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(' '));
    this.status = status;
    this.messages = messages;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    // fetch only throws on network failure (server down, offline).
    throw new ApiError(0, ['Could not reach the server. Check that the API is running.']);
  }

  // 204 No Content (e.g. a delete) has no body to parse.
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const raw = body?.message ?? response.statusText;
    throw new ApiError(response.status, Array.isArray(raw) ? raw : [raw]);
  }

  return body as T;
}

// Every call the frontend makes, in one place. Components never call fetch directly.
export const api = {
  getTree: () => request<ArticleNode[]>('/articles'),

  getArticle: (id: string) => request<ArticleDetail>(`/articles/${id}`),

  createArticle: (input: CreateArticleInput) =>
    request<Article>('/articles', { method: 'POST', body: JSON.stringify(input) }),

  deleteArticle: (id: string) => request<void>(`/articles/${id}`, { method: 'DELETE' }),

  getSummary: () => request<Summary>('/summary'),
};