import { Module } from '@nestjs/common';
import { SummaryController } from './summary.controller.js';
import { SummaryService } from './summary.service.js';

@Module({
  controllers: [SummaryController],
  providers: [SummaryService],
  // Makes SummaryService injectable in any module that imports SummaryModule.
  exports: [SummaryService],
})
export class SummaryModule {}