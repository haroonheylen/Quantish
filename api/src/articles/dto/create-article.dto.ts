import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ARTICLE_CODE_PATTERN } from '../article-code.js';

// A DTO (data transfer object) describes the shape of a request body.
// The global ValidationPipe checks every incoming body against these
// decorators and returns a 400 listing every rule that failed.
export class CreateArticleDto {
  @Matches(ARTICLE_CODE_PATTERN, {
    message: 'code must look like "20." or "20.11.10." (digit groups ending in a dot)',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Rich text as HTML. Sanitised in the service before saving.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  // Omitted or null = top-level article.
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}