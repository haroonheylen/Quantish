import { Controller, Get } from '@nestjs/common';
import { SummaryService } from './summary.service.js';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  // GET /summary
  @Get()
  getSummary() {
    return this.summaryService.getSummary();
  }
}