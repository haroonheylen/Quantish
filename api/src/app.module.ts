import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module.js';
import { HealthModule } from './health/health.module.js';
import { validateEnv } from './config/env.validation.js';
import { ArticlesModule } from './articles/articles.module.js';


@Module({
  imports: [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '../.env',
    validate: validateEnv,
  }),
  DatabaseModule,
  HealthModule,
  ArticlesModule,
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
