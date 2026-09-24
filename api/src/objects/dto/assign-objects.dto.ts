import { IsBoolean, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';
import { OBJECT_TYPES } from '../object-types.js';
import type { ObjectType } from '../object-types.js';

// The brief's example: "all walls with a thickness of 14cm go to article 20.11.10."
// becomes { articleId, type: "wall", properties: { thickness: 0.14 } }
export class AssignObjectsDto {
  @IsUUID()
  articleId!: string;

  @IsIn(OBJECT_TYPES)
  type!: ObjectType;

  // Every listed property must match exactly. Omit to match all of this type.
  @IsOptional()
  @IsObject()
  properties?: Record<string, number>;

  // By default only unassigned objects are picked up, so a broad rule
  // can't silently pull objects out of articles they're already in.
  @IsOptional()
  @IsBoolean()
  includeAssigned?: boolean;
}