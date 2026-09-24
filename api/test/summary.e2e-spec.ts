import { existsSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DB, PG_POOL } from '../src/db/database.module.js';
import type { Database } from '../src/db/database.module.js';

// Load .env so TEST_DATABASE_URL is available.
if (existsSync('../.env')) process.loadEnvFile('../.env');

const testUrl = process.env.TEST_DATABASE_URL;

// Safety net: these tests TRUNCATE tables. Refuse to run against dev data.
if (!testUrl || testUrl === process.env.DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a separate database. These tests wipe it.');
}

describe('GET /summary (e2e)', () => {
  let app: INestApplication;
  let db: Database;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Swap only the connection pool. Everything else is the real app.
      .overrideProvider(PG_POOL)
      .useValue(new pg.Pool({ connectionString: testUrl }))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    db = app.get<Database>(DB);
    await migrate(db, { migrationsFolder: './drizzle' });
  }, 30_000);

  // Every test starts from an empty bill.
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE objects, articles`);
  });

  // Runs shutdown hooks, which closes the pool so Jest can exit.
  afterAll(async () => {
    await app.close();
  });

  // Small helpers that go through the real API, including validation.
  const createArticle = async (code: string, parentId?: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/articles')
      .send({ code, title: `Article ${code}`, parentId })
      .expect(201);
    return res.body.id;
  };

  const createObject = async (body: Record<string, unknown>): Promise<void> => {
    await request(app.getHttpServer())
      .post('/objects')
      .send({ name: 'Test object', type: 'wall', unit: 'm2', ...body })
      .expect(201);
  };

  it('returns zero for an empty bill', async () => {
    const res = await request(app.getHttpServer()).get('/summary').expect(200);
    expect(res.body).toEqual({ currency: 'EUR', articles: [], grandTotal: '0.00' });
  });

  it('rolls nested articles up into their top-level subtotal', async () => {
    const a20 = await createArticle('20.');
    const a2011 = await createArticle('20.11.', a20);
    const a201110 = await createArticle('20.11.10.', a2011);
    const a30 = await createArticle('30.');

    await createObject({ articleId: a20, quantity: 10, unitPrice: 10 }); // 100.00
    await createObject({ articleId: a2011, quantity: 5, unitPrice: 2 }); // 10.00
    await createObject({ articleId: a201110, quantity: 3, unitPrice: 1.5 }); // 4.50
    await createObject({
      articleId: a30,
      type: 'door',
      unit: 'piece',
      quantity: 1,
      unitPrice: 850,
    }); // 850.00
    await createObject({ quantity: 1000, unitPrice: 1 }); // unassigned: excluded

    const res = await request(app.getHttpServer()).get('/summary').expect(200);

    // Only top-level articles appear, in code order.
    expect(res.body.articles.map((a: { code: string }) => a.code)).toEqual(['20.', '30.']);
    expect(res.body.articles[0].subtotal).toBe('114.50');
    expect(res.body.articles[1].subtotal).toBe('850.00');
    expect(res.body.grandTotal).toBe('964.50');
  });

  it('rounds each line before summing', async () => {
    const a20 = await createArticle('20.');

    // Each line: 1.5 x 1.11 = 1.665, rounded to 1.67.
    // Rounded per line: 3 x 1.67 = 5.01. Rounded once at the end: 5.00.
    for (let i = 0; i < 3; i++) {
      await createObject({ articleId: a20, quantity: 1.5, unitPrice: 1.11 });
    }

    const res = await request(app.getHttpServer()).get('/summary').expect(200);
    expect(res.body.articles[0].subtotal).toBe('5.01');
    expect(res.body.grandTotal).toBe('5.01');
  });

  it('drops a deleted subtree from the totals but keeps its objects', async () => {
    const a20 = await createArticle('20.');
    const a2011 = await createArticle('20.11.', a20);
    await createObject({ articleId: a2011, quantity: 2, unitPrice: 50 }); // 100.00

    await request(app.getHttpServer()).delete(`/articles/${a2011}`).expect(204);

    const summary = await request(app.getHttpServer()).get('/summary').expect(200);
    expect(summary.body.grandTotal).toBe('0.00');

    // The object survives, now unassigned.
    const unassigned = await request(app.getHttpServer())
      .get('/objects?unassigned=true')
      .expect(200);
    expect(unassigned.body).toHaveLength(1);
  });
});