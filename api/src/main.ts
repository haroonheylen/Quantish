import { NestFactory } from '@nestjs/core';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { DB } from './db/database.module.js';
import type { Database } from './db/database.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Apply pending migrations before accepting requests.
  const db = app.get<Database>(DB);
  await migrate(db, { migrationsFolder: './drizzle' });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();