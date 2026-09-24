import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { OBJECT_TYPES } from '../object-types.js';
import type { ObjectType } from '../object-types.js';

// Query string filters: GET /objects?articleId=...&type=wall&unassigned=true
export class ListObjectsQuery {
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @IsOptional()
  @IsIn(OBJECT_TYPES)
  type?: ObjectType;

  // Query string values always arrive as text, so "true" must be
  // converted explicitly. Without this, "false" would count as truthy.
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unassigned?: boolean;
}