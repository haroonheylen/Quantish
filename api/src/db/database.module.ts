import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

// Using ESM so explicilty importing pg.
import pg from 'pg';

// Every table definition.
import * as schema from './schema.js';

// The injection token.
export const DB = Symbol('DB');

// Type alias so services get autocompletion on your tables.
export type Database = NodePgDatabase<typeof schema>;

// Global: available in every module without importing DatabaseModule each time...
@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],

      useFactory: (config: ConfigService): Database => {
        // Pool keeps several connections open, reuses them, instead of opening a connection per query.
        const pool = new pg.Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
        });

        return drizzle(pool, { schema });
      },
    },
  ],

  // Make the DB token available to other modules.
  exports: [DB],
})
export class DatabaseModule {}