import { Module } from '@nestjs/common';
import { SummaryModule } from '../summary/summary.module.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';

@Module({
  // Gives ArticlesService access to the exported SummaryService.
  imports: [SummaryModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}