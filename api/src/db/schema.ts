import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';


//  Units of measurement to acccept
export const unitEnum = pgEnum('unit', ['m', 'm2', 'm3', 'kg', 'piece']);

// Timestamps...
const timestamps = {
  // timestamptz: stores in UTC, might want to change this later to be localised?
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const articles = pgTable(
  'articles',
  {
    // Article key, codes can be rewritten so using a seperate uuid for id
    id: uuid('id').primaryKey().defaultRandom(),

    // Self-reference... an article's parent is another article.
    parentId: uuid('parent_id').references((): AnyPgColumn => articles.id, {
      // Deleting an article deletes its whole subtree.
      onDelete: 'cascade',
    }),

    // e.g. "20.11.10." Format and parent-prefix rules are enforced in the API.
    code: text('code').notNull().unique(),
    title: text('title').notNull(),

    // Rich text stored as sanitised HTML... Optional.
    description: text('description'),

    ...timestamps,
  },
  // Queries constantly look up children by parent.
  (t) => [index('articles_parent_id_idx').on(t.parentId)],
);

export const objects = pgTable(
  'objects',
  {
    // Objects come from drawing with UUID. defaultRandom() is for when none is supplied.
    id: uuid('id').primaryKey().defaultRandom(),

    // The article this object is assigned to... One article at most.
    articleId: uuid('article_id').references(() => articles.id, {
      // Deleting an article frees its objects instead of deleting them.
      onDelete: 'set null',
    }),

    name: text('name').notNull(),

    // wall, door, window, slab. Validated in the API rather than a DB enum
    type: text('type').notNull(),

    unit: unitEnum('unit').notNull(),

    // 3 decimals = millimetre precision in metres.
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),

    // 4 decimals, per-kg prices can carry fractional cents.
    unitPrice: numeric('unit_price', { precision: 12, scale: 4 }).notNull(),

    // Computed by Postgres on every insert and update, per-line rounding rule, in exactly one place.
    lineTotal: numeric('line_total', { precision: 14, scale: 2 }).generatedAlwaysAs(
      sql`round(quantity * unit_price, 2)`,
    ),

    // Type-specific attributes (e.g. a wall's thickness).
    // For assignment criteria and display.
    properties: jsonb('properties').$type<Record<string, unknown>>().notNull().default({}),

    ...timestamps,
  },
    (t) => [
    // Speed up "all objects in this article", the most common query. Indexing...
    index('objects_article_id_idx').on(t.articleId),

    // Constraints enforced by the database, even if the API is bypassed.
    check('objects_quantity_non_negative', sql`${t.quantity} >= 0`),
    check('objects_unit_price_non_negative', sql`${t.unitPrice} >= 0`),

    // A "piece" object is one physical thing, so its quantity must be 1.
    check('objects_piece_is_one', sql`${t.unit} <> 'piece' OR ${t.quantity} = 1`),
  ],
);