import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { AppModule } from './app.module.js';
import { DB, Database } from './db/database.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties not declared on the DTO...
      whitelist: true,
      // ...and reject the request with a 400.
      forbidNonWhitelisted: true,
      // Give controllers real DTO instances and convert route params to declared types.
      transform: true,
    }),
  );

  const db = app.get<Database>(DB);
  await migrate(db, { migrationsFolder: './drizzle' });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();