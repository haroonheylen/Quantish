import { INestApplication, ValidationPipe } from '@nestjs/common';

// Everything that configures the app, in one place, used by both main.ts
// and the e2e tests. Tests then exercise exactly the app that ships.
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lets Nest react to stop signals (e.g. `docker compose down`) by running
  // shutdown hooks, such as closing the database pool.
  app.enableShutdownHooks();
}