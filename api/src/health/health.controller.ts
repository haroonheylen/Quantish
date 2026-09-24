import { Controller, Get } from '@nestjs/common';

//Setup an endpoint at .../health
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}