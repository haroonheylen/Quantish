import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { OBJECT_TYPES, UNITS } from '../object-types.js';
import type { ObjectType, Unit } from '../object-types.js';

export class CreateObjectDto {
  // Objects come from the drawing with their own UUID, so the client may
  // supply it. If omitted, the database generates one.
  @IsOptional()
  @IsUUID()
  id?: string;

  // Omitted or null = unassigned.
  @IsOptional()
  @IsUUID()
  articleId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsIn(OBJECT_TYPES)
  type!: ObjectType;

  @IsIn(UNITS)
  unit!: Unit;

  // The API accepts plain JSON numbers for convenience. maxDecimalPlaces
  // matches the column's scale, so nothing is silently rounded on save.
  // Responses return these as strings to preserve exact decimal precision.
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice!: number;

  // Shape is checked per type in the service.
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}