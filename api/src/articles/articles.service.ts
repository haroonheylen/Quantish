import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import type { Database } from '../db/database.module.js';
import { DB } from '../db/database.module.js';
import { isUniqueViolation } from '../db/pg-errors.js';
import { articles, objects } from '../db/schema.js';
import { assertCodeFitsParent, compareCodes } from './article-code.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { formatTotal } from '../summary/rollup.js';
import { SummaryService } from '../summary/summary.service.js';

// Types inferred from the schema, so they can never drift from the table.
type ArticleRow = typeof articles.$inferSelect;
export type ArticleNode = ArticleRow & { total: string; children: ArticleNode[] };
@Injectable()
export class ArticlesService {
  // @Inject(DB) asks Nest for the provider registered under the DB token.
    constructor(
    @Inject(DB) private readonly db: Database,
    private readonly summary: SummaryService,
  ) {}

  // The whole bill as a nested tree.
  // One flat query, then assembled in memory. A bill has hundreds of
  // articles, not millions, so this is simpler than a recursive SQL query
  // and just as fast.
  async findTree(): Promise<ArticleNode[]> {
    const [rows, totals] = await Promise.all([
      this.db.select().from(articles),
      this.summary.getArticleTotals(),
    ]);
    rows.sort((a, b) => compareCodes(a.code, b.code));

    const byId = new Map<string, ArticleNode>();
    for (const row of rows) {
      // Each node carries its rolled-up total, including all sub-articles.
      byId.set(row.id, { ...row, total: formatTotal(totals, row.id), children: [] });
    }

    const roots: ArticleNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId) byId.get(node.parentId)?.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async findOne(id: string) {
    const article = await this.findRowOrThrow(id);

    const [children, articleObjects, totals] = await Promise.all([
      this.db.select().from(articles).where(eq(articles.parentId, id)),
      this.db.select().from(objects).where(eq(objects.articleId, id)),
      this.summary.getArticleTotals(),
    ]);

    children.sort((a, b) => compareCodes(a.code, b.code));

    return {
      ...article,
      // Includes sub-articles. `objects` below lists only this article's own.
      total: formatTotal(totals, id),
      children: children.map((child) => ({ ...child, total: formatTotal(totals, child.id) })),
      objects: articleObjects,
    };
  }
  async create(dto: CreateArticleDto): Promise<ArticleRow> {
    const parent = dto.parentId ? await this.findParentOrThrow(dto.parentId) : null;
    assertCodeFitsParent(dto.code, parent?.code ?? null);

    try {
      // .returning() makes Postgres send back the inserted row,
      // including the generated id and timestamps.
      const [created] = await this.db
        .insert(articles)
        .values({
          code: dto.code,
          title: dto.title,
          description: this.clean(dto.description),
          parentId: dto.parentId ?? null,
        })
        .returning();
      return created;
    } catch (error) {
      // Let the database enforce uniqueness (no race conditions),
      // then translate its error into a clear 409.
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Article code "${dto.code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateArticleDto): Promise<ArticleRow> {
    const current = await this.findRowOrThrow(id);

    // undefined = "not sent, leave it alone". null = "move to top level".
    const parentChanging = dto.parentId !== undefined && dto.parentId !== current.parentId;
    const codeChanging = dto.code !== undefined && dto.code !== current.code;

    if (parentChanging || codeChanging) {
      if (dto.parentId === id) {
        throw new BadRequestException('An article cannot be its own parent');
      }

      // MVP rule: an article with sub-articles can't be moved or renumbered,
      // because its children's codes would no longer match.
      // This also makes cycles impossible: you can only move an article under
      // one of its own descendants if it has descendants.
      // Renumbering a whole subtree is listed under future improvements.
      const [child] = await this.db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.parentId, id))
        .limit(1);
      if (child) {
        throw new ConflictException(
          'Articles with sub-articles cannot be moved or renumbered yet',
        );
      }

      const newParentId = dto.parentId !== undefined ? dto.parentId : current.parentId;
      const parent = newParentId ? await this.findParentOrThrow(newParentId) : null;
      assertCodeFitsParent(dto.code ?? current.code, parent?.code ?? null);
    }

    try {
      // Drizzle skips undefined keys in .set(), so only sent fields change.
      const [updated] = await this.db
        .update(articles)
        .set({
          code: dto.code,
          title: dto.title,
          description: dto.description !== undefined ? this.clean(dto.description) : undefined,
          parentId: dto.parentId,
        })
        .where(eq(articles.id, id))
        .returning();
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Article code "${dto.code}" already exists`);
      }
      throw error;
    }
  }

  // The database does the heavy lifting: ON DELETE CASCADE removes the
  // subtree, ON DELETE SET NULL unassigns the objects.
  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(articles)
      .where(eq(articles.id, id))
      .returning({ id: articles.id });

    if (deleted.length === 0) {
      throw new NotFoundException(`Article ${id} not found`);
    }
  }

  private async findRowOrThrow(id: string): Promise<ArticleRow> {
    const [row] = await this.db.select().from(articles).where(eq(articles.id, id));
    if (!row) throw new NotFoundException(`Article ${id} not found`);
    return row;
  }

  // A missing parent is the client's mistake in the request body,
  // so it's a 400, not a 404.
  private async findParentOrThrow(parentId: string): Promise<ArticleRow> {
    const [row] = await this.db.select().from(articles).where(eq(articles.id, parentId));
    if (!row) throw new BadRequestException(`Parent article ${parentId} does not exist`);
    return row;
  }

  // Strips scripts, event handlers and anything outside sanitize-html's
  // default safe list, so stored HTML can't run code in the browser (XSS).
  private clean(html: string | undefined): string | null {
    return html ? sanitizeHtml(html) : null;
  }
}