import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateObjectDto } from './create-object.dto.js';

// Every field optional, except the id, which can't be changed after creation.
export class UpdateObjectDto extends PartialType(OmitType(CreateObjectDto, ['id'] as const)) {}