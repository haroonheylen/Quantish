import { Decimal } from 'decimal.js';

// Just the tree structure: which article sits under which.
export interface ArticleLink {
  id: string;
  parentId: string | null;
}

// Given the tree and each article's DIRECT total (the sum of its own objects'
// line totals), returns each article's ROLLED-UP total: its own objects plus
// everything in every descendant.
//
// Pure function: no database, no Nest. Same input, same output. That's what
// makes it easy to unit test.
export function rollUpTotals(
  articles: ArticleLink[],
  directTotals: Map<string, string>,
): Map<string, Decimal> {
  // Invert parentId into a children lookup, so we can walk downwards.
  const childrenOf = new Map<string, string[]>();
  for (const article of articles) {
    if (article.parentId) {
      const siblings = childrenOf.get(article.parentId) ?? [];
      siblings.push(article.id);
      childrenOf.set(article.parentId, siblings);
    }
  }

  // Memo: each article's total is computed once, even though parents
  // ask for their children's totals.
  const totals = new Map<string, Decimal>();

  // Depth-first: an article's total = its own objects + its children's totals.
  // `path` holds the articles on the current branch. Seeing one twice means
  // a cycle. The API prevents cycles, but this stops an infinite loop if bad
  // data ever gets in.
  const visit = (id: string, path: Set<string>): Decimal => {
    const known = totals.get(id);
    if (known) return known;
    if (path.has(id)) throw new Error(`Cycle detected at article ${id}`);

    path.add(id);
    // Decimal parses the numeric string exactly. Never parseFloat money.
    let total = new Decimal(directTotals.get(id) ?? 0);
    for (const childId of childrenOf.get(id) ?? []) {
      // Decimal is immutable: plus() returns a new value.
      total = total.plus(visit(childId, path));
    }
    path.delete(id);

    totals.set(id, total);
    return total;
  };

  for (const article of articles) visit(article.id, new Set());
  return totals;
}

// Money leaves the API as a string with exactly two decimals, e.g. "114.50".
export function formatTotal(totals: Map<string, Decimal>, id: string): string {
  return (totals.get(id) ?? new Decimal(0)).toFixed(2);
}