import { Inject, Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { isNotNull, isNull, sql } from 'drizzle-orm';
import { compareCodes } from '../articles/article-code.js';
import { DB } from '../db/database.module.js';
import type { Database } from '../db/database.module.js';
import { articles, objects } from '../db/schema.js';
import { rollUpTotals } from './rollup.js';

@Injectable()
export class SummaryService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Rolled-up totals for every article. Shared by /summary and the
  // articles endpoints, so every screen shows the same numbers.
  async getArticleTotals(): Promise<Map<string, Decimal>> {
    const [articleRows, directRows] = await Promise.all([
      this.db.select({ id: articles.id, parentId: articles.parentId }).from(articles),

      // SELECT article_id, sum(line_total) FROM objects
      // WHERE article_id IS NOT NULL GROUP BY article_id
      // line_total is already rounded per line by Postgres, so this sums
      // rounded lines: the printed lines always add up to the printed total.
      // Unassigned objects are excluded, since they're not in the bill yet.
      this.db
        .select({
          articleId: objects.articleId,
          // sum() of numeric returns numeric, which arrives as a string.
          total: sql<string>`sum(${objects.lineTotal})`,
        })
        .from(objects)
        .where(isNotNull(objects.articleId))
        .groupBy(objects.articleId),
    ]);

    const direct = new Map(directRows.map((row) => [row.articleId as string, row.total]));
    return rollUpTotals(articleRows, direct);
  }

  // GET /summary: a subtotal per top-level article, plus a grand total.
  async getSummary() {
    const [topLevel, totals] = await Promise.all([
      this.db
        .select({ id: articles.id, code: articles.code, title: articles.title })
        .from(articles)
        .where(isNull(articles.parentId)),
      this.getArticleTotals(),
    ]);

    topLevel.sort((a, b) => compareCodes(a.code, b.code));

    let grandTotal = new Decimal(0);
    const rows = topLevel.map((article) => {
      const subtotal = totals.get(article.id) ?? new Decimal(0);
      grandTotal = grandTotal.plus(subtotal);
      return { ...article, subtotal: subtotal.toFixed(2) };
    });

    return { currency: 'EUR', articles: rows, grandTotal: grandTotal.toFixed(2) };
  }
}