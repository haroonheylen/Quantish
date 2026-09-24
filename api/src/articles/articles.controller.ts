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
} from '@nestjs/common';
import { ArticlesService } from './articles.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';

// Every route here is prefixed with /articles.
// The controller only maps HTTP to service calls. All logic lives in the service.
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // GET /articles -> the full tree
  @Get()
  findTree() {
    return this.articlesService.findTree();
  }

  // GET /articles/:id
  // ParseUUIDPipe returns a 400 for a malformed id before it reaches Postgres,
  // which would otherwise throw a confusing database error.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.findOne(id);
  }

  // POST /articles -> 201 with the created article
  @Post()
  create(@Body() dto: CreateArticleDto) {
    return this.articlesService.create(dto);
  }

  // PATCH /articles/:id -> partial update
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto);
  }

  // DELETE /articles/:id -> 204 No Content
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.remove(id);
  }
}