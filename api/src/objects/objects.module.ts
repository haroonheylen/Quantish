import { Module } from '@nestjs/common';
import { ObjectsController } from './objects.controller.js';
import { ObjectsService } from './objects.service.js';

// Groups everything for the objects feature. Nest only knows a controller
// or service exists if a module lists it here.
@Module({
  controllers: [ObjectsController],
  providers: [ObjectsService],
})
export class ObjectsModule {}