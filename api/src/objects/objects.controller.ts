import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AssignObjectsDto } from './dto/assign-objects.dto.js';
import { CreateObjectDto } from './dto/create-object.dto.js';
import { ListObjectsQuery } from './dto/list-objects.query.js';
import { UpdateObjectDto } from './dto/update-object.dto.js';
import { ObjectsService } from './objects.service.js';

@Controller('objects')
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  // GET /objects?articleId=...&type=wall&unassigned=true
  // @Query() collects the query string into the DTO, and the global
  // ValidationPipe validates it like a body.
  @Get()
  findAll(@Query() query: ListObjectsQuery) {
    return this.objectsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.objectsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateObjectDto) {
    return this.objectsService.create(dto);
  }

  // POST /objects/assign
  // A POST rather than a PATCH because it acts on a set of objects chosen
  // by criteria, not on one known resource. 200 because nothing is created.
  @Post('assign')
  @HttpCode(200)
  assign(@Body() dto: AssignObjectsDto) {
    return this.objectsService.assignByCriteria(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObjectDto) {
    return this.objectsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.objectsService.remove(id);
  }
}