import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';
import { articles, objects } from './schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// An object row as it's inserted, minus articleId (set while inserting).
// line_total is a generated column, so Drizzle leaves it out of insert types.
type NewObject = Omit<typeof objects.$inferInsert, 'articleId'>;

// The bill is written as a nested tree, mirroring how it reads on paper.
interface SeedArticle {
  code: string;
  title: string;
  description?: string;
  objects?: NewObject[];
  children?: SeedArticle[];
}

// ---------------------------------------------------------------------------
// Helpers: keep the data below readable. Quantities as numbers here,
// converted to strings because Drizzle takes numeric columns as strings.
// All dimensions are in metres.
// ---------------------------------------------------------------------------

const wall = (
  name: string,
  area: number,
  thickness: number,
  unitPrice: number,
  height?: number,
): NewObject => ({
  name,
  type: 'wall',
  unit: 'm2',
  quantity: String(area),
  unitPrice: String(unitPrice),
  properties: height ? { thickness, height } : { thickness },
});

const slab = (name: string, volume: number, thickness: number, unitPrice: number): NewObject => ({
  name,
  type: 'slab',
  unit: 'm3',
  quantity: String(volume),
  unitPrice: String(unitPrice),
  properties: { thickness },
});

// Doors are counted per piece, so quantity is always 1.
const door = (name: string, width: number, height: number, unitPrice: number): NewObject => ({
  name,
  type: 'door',
  unit: 'piece',
  quantity: '1',
  unitPrice: String(unitPrice),
  properties: { width, height },
});

// Windows are priced per m2 of glazing. toFixed(3) avoids float noise
// like 1.4 * 1.4 = 1.9599999999999997.
const windowPane = (name: string, width: number, height: number, unitPrice: number): NewObject => ({
  name,
  type: 'window',
  unit: 'm2',
  quantity: (width * height).toFixed(3),
  unitPrice: String(unitPrice),
  properties: { width, height },
});

// ---------------------------------------------------------------------------
// The demo bill of quantities: a small detached house.
// ---------------------------------------------------------------------------

const BILL: SeedArticle[] = [
  {
    code: '20.',
    title: 'Masonry',
    description: '<p>All masonry works, including mortar and wall ties.</p>',
    children: [
      {
        code: '20.10.',
        title: 'Masonry - load-bearing walls',
        children: [
          {
            code: '20.10.10.',
            title: 'Interior walls, 14cm snelbouw',
            description: '<p>Ceramic snelbouw blocks, <strong>14cm</strong>, glued joints.</p>',
            objects: [
              wall('W-01 Living room partition', 18.36, 0.14, 92.5, 2.7),
              wall('W-02 Hallway', 11.34, 0.14, 92.5, 2.7),
              wall('W-03 Bathroom', 9.72, 0.14, 92.5, 2.7),
              wall('W-04 Bedroom partition', 12.15, 0.14, 92.5, 2.7),
            ],
          },
          {
            code: '20.10.20.',
            title: 'Exterior inner leaf, 19cm snelbouw',
            objects: [
              wall('W-10 North inner leaf', 32.4, 0.19, 118),
              wall('W-11 South inner leaf', 29.16, 0.19, 118),
              wall('W-12 East inner leaf', 21.87, 0.19, 118),
              wall('W-13 West inner leaf', 21.87, 0.19, 118),
            ],
          },
        ],
      },
      {
        code: '20.20.',
        title: 'Masonry - facade',
        children: [
          {
            code: '20.20.10.',
            title: 'Facing brick',
            description: '<p>Clay facing brick, net areas excluding openings.</p>',
            objects: [
              wall('F-01 North facade', 30.12, 0.09, 125),
              wall('F-02 South facade', 24.3, 0.09, 125),
              wall('F-03 East facade', 20.25, 0.09, 125),
              wall('F-04 West facade', 20.25, 0.09, 125),
            ],
          },
        ],
      },
    ],
  },
  {
    code: '30.',
    title: 'Concrete works',
    children: [
      {
        code: '30.10.',
        title: 'Floor slabs',
        objects: [
          slab('S-01 Ground floor slab', 18.4, 0.2, 185),
          slab('S-02 First floor slab', 15.66, 0.18, 185),
        ],
      },
    ],
  },
  {
    code: '40.',
    title: 'Joinery',
    children: [
      {
        code: '40.10.',
        title: 'Exterior doors',
        objects: [door('D-01 Front door', 1.0, 2.3, 1450), door('D-02 Back door', 0.9, 2.2, 1450)],
      },
      {
        code: '40.20.',
        title: 'Interior doors',
        objects: [
          door('D-10 Living room door', 0.83, 2.11, 395),
          door('D-11 Kitchen door', 0.83, 2.11, 395),
          door('D-12 Bathroom door', 0.83, 2.11, 395),
          door('D-13 Bedroom 1 door', 0.83, 2.11, 395),
          door('D-14 Bedroom 2 door', 0.83, 2.11, 395),
        ],
      },
      {
        code: '40.30.',
        title: 'Windows',
        description: '<p>Aluminium frames, double glazing. Priced per m² of opening.</p>',
        objects: [
          windowPane('WI-01 Living room', 3.0, 1.6, 520),
          windowPane('WI-02 Kitchen', 1.5, 1.2, 520),
          windowPane('WI-03 Bedroom 1', 1.4, 1.4, 520),
          windowPane('WI-04 Bedroom 2', 1.4, 1.4, 520),
        ],
      },
    ],
  },
];

// Not yet in the bill. Two 14cm walls let a reviewer try:
// POST /objects/assign { articleId: <20.10.10.>, type: "wall", properties: { thickness: 0.14 } }
const UNASSIGNED: NewObject[] = [
  wall('W-05 Storage room', 7.29, 0.14, 92.5, 2.7),
  wall('W-06 Attic partition', 6.48, 0.14, 92.5),
  windowPane('WI-05 Bathroom', 0.6, 1.0, 520),
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // On your laptop, load the root .env. In the container the file doesn't
  // exist and DATABASE_URL comes from Compose instead.
  if (existsSync('../.env')) process.loadEnvFile('../.env');

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  try {
    // Make sure the tables exist, even on a brand-new database.
    await migrate(db, { migrationsFolder: './drizzle' });

    // One transaction: either the whole demo bill is loaded, or nothing changes.
    await db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE objects, articles`);

      // Depth-first: insert the article, then its objects, then its children,
      // passing the new id down as the children's parentId.
      const insertArticle = async (node: SeedArticle, parentId: string | null): Promise<void> => {
        const [row] = await tx
          .insert(articles)
          .values({
            code: node.code,
            title: node.title,
            description: node.description ?? null,
            parentId,
          })
          .returning({ id: articles.id });

        if (node.objects?.length) {
          await tx.insert(objects).values(node.objects.map((o) => ({ ...o, articleId: row.id })));
        }

        for (const child of node.children ?? []) {
          await insertArticle(child, row.id);
        }
      };

      for (const topLevel of BILL) await insertArticle(topLevel, null);
      await tx.insert(objects).values(UNASSIGNED);
    });

    const [{ articleCount }] = await db
      .select({ articleCount: sql<number>`count(*)::int` })
      .from(articles);
    const [{ objectCount }] = await db
      .select({ objectCount: sql<number>`count(*)::int` })
      .from(objects);

    console.log(`Seeded ${articleCount} articles and ${objectCount} objects.`);
  } finally {
    // Always close the pool, or the process never exits.
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});