import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

// Two tokens now: the raw connection pool, and the Drizzle instance built on it.
// Splitting them lets tests replace just the pool with one pointing at the
// test database, and lets the module close the pool on shutdown.
export const PG_POOL = Symbol('PG_POOL');
export const DB = Symbol('DB');

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new pg.Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    },
    {
      // Nest resolves PG_POOL first, then passes it into this factory.
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  // Nest calls this when the app closes (app.close() in tests, or a Docker
  // stop signal in production). Ending the pool closes every open connection.
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}