import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, sql, SQL } from 'drizzle-orm';
import { DB } from '../db/database.module.js';
import type { Database } from '../db/database.module.js';
import { isCheckViolation, isUniqueViolation } from '../db/pg-errors.js';
import { articles, objects } from '../db/schema.js';
import { AssignObjectsDto } from './dto/assign-objects.dto.js';
import { CreateObjectDto } from './dto/create-object.dto.js';
import { ListObjectsQuery } from './dto/list-objects.query.js';
import { UpdateObjectDto } from './dto/update-object.dto.js';
import { assertPieceQuantity, assertValidProperties } from './object-types.js';

type ObjectRow = typeof objects.$inferSelect;

@Injectable()
export class ObjectsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findAll(query: ListObjectsQuery): Promise<ObjectRow[]> {
    // Build the WHERE clause from whichever filters were sent.
    // and() ignores undefined entries, so unused filters simply drop out.
    const conditions: (SQL | undefined)[] = [
      query.articleId ? eq(objects.articleId, query.articleId) : undefined,
      query.type ? eq(objects.type, query.type) : undefined,
      query.unassigned ? isNull(objects.articleId) : undefined,
    ];

    return this.db
      .select()
      .from(objects)
      .where(and(...conditions))
      .orderBy(objects.name);
  }

  async findOne(id: string): Promise<ObjectRow> {
    const [row] = await this.db.select().from(objects).where(eq(objects.id, id));
    if (!row) throw new NotFoundException(`Object ${id} not found`);
    return row;
  }

  async create(dto: CreateObjectDto): Promise<ObjectRow> {
    const properties = dto.properties ?? {};
    assertValidProperties(dto.type, properties);
    assertPieceQuantity(dto.unit, dto.quantity);
    if (dto.articleId) await this.assertArticleExists(dto.articleId);

    try {
      const [created] = await this.db
        .insert(objects)
        .values({
          // undefined id -> the database default generates one
          id: dto.id,
          articleId: dto.articleId ?? null,
          name: dto.name,
          type: dto.type,
          unit: dto.unit,
          // numeric columns take strings in Drizzle, keeping them exact
          quantity: String(dto.quantity),
          unitPrice: String(dto.unitPrice),
          properties,
        })
        .returning();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`An object with id ${dto.id} already exists`);
      }
      if (isCheckViolation(error)) {
        throw new BadRequestException('Object violates a database constraint');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateObjectDto): Promise<ObjectRow> {
    const current = await this.findOne(id);

    // Validate the object as it WILL look after the update,
    // combining sent fields with current values.
    const type = dto.type ?? (current.type as CreateObjectDto['type']);
    const unit = dto.unit ?? current.unit;
    const quantity = dto.quantity ?? Number(current.quantity);
    // Properties are replaced as a whole when sent, not merged key by key.
    const properties = dto.properties ?? current.properties;

    assertValidProperties(type, properties);
    assertPieceQuantity(unit, quantity);
    if (dto.articleId) await this.assertArticleExists(dto.articleId);

    try {
      const [updated] = await this.db
        .update(objects)
        .set({
          // null unassigns; undefined leaves it alone (Drizzle skips undefined)
          articleId: dto.articleId,
          name: dto.name,
          type: dto.type,
          unit: dto.unit,
          quantity: dto.quantity !== undefined ? String(dto.quantity) : undefined,
          unitPrice: dto.unitPrice !== undefined ? String(dto.unitPrice) : undefined,
          properties: dto.properties,
        })
        .where(eq(objects.id, id))
        .returning();
      return updated;
    } catch (error) {
      if (isCheckViolation(error)) {
        throw new BadRequestException('Object violates a database constraint');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(objects)
      .where(eq(objects.id, id))
      .returning({ id: objects.id });
    if (deleted.length === 0) throw new NotFoundException(`Object ${id} not found`);
  }

  // Bulk assignment by criteria, in a single UPDATE statement.
  async assignByCriteria(dto: AssignObjectsDto) {
    await this.assertArticleExists(dto.articleId);
    if (dto.properties) assertValidProperties(dto.type, dto.properties);

    const conditions: SQL[] = [eq(objects.type, dto.type)];

    if (dto.properties && Object.keys(dto.properties).length > 0) {
      // @> is Postgres' JSONB containment operator: "the stored properties
      // contain at least these key/value pairs". The JSON is sent as a bound
      // parameter, never concatenated into the SQL, so it can't inject.
      conditions.push(sql`${objects.properties} @> ${JSON.stringify(dto.properties)}::jsonb`);
    }

    if (!dto.includeAssigned) {
      conditions.push(isNull(objects.articleId));
    }

    const assigned = await this.db
      .update(objects)
      .set({ articleId: dto.articleId })
      .where(and(...conditions))
      .returning({ id: objects.id });

    return { assigned: assigned.length, objectIds: assigned.map((o) => o.id) };
  }

  // A missing article in the request body is a client error: 400, not 404.
  private async assertArticleExists(articleId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, articleId));
    if (!row) throw new BadRequestException(`Article ${articleId} does not exist`);
  }
}