import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleDto } from './create-article.dto.js';

// Same rules as create, but every field is optional,
// so a PATCH can send only what changes.
export class UpdateArticleDto extends PartialType(CreateArticleDto) {}