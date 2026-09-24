import { BadRequestException } from '@nestjs/common';
import { unitEnum } from '../db/schema.js';

// Supported object types, loosely matching IFC classes (IfcWall, IfcDoor...).
// Validated here rather than as a database enum, so adding a type
// is a one-line change with no migration.
export const OBJECT_TYPES = ['wall', 'door', 'window', 'slab'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

// Reuse the database enum's values so the API and database can't disagree.
export const UNITS = unitEnum.enumValues;
export type Unit = (typeof UNITS)[number];

// Which descriptive properties each type may carry, all in metres.
// These are for assignment criteria and display, not for quantity:
// quantity comes from the drawing (IFC net values account for openings).
const ALLOWED_PROPERTIES: Record<ObjectType, readonly string[]> = {
  wall: ['thickness', 'height', 'length'],
  door: ['width', 'height'],
  window: ['width', 'height'],
  slab: ['thickness'],
};

// JSONB can hold anything, so the database won't check its shape.
// This function is where that shape gets enforced.
export function assertValidProperties(type: ObjectType, properties: Record<string, unknown>): void {
  const allowed = ALLOWED_PROPERTIES[type];

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.includes(key)) {
      throw new BadRequestException(
        `Property "${key}" is not valid for a ${type}. Allowed: ${allowed.join(', ')}`,
      );
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`Property "${key}" must be a positive number (metres)`);
    }
  }
}

// Mirrors the database CHECK constraint, but with a readable message.
export function assertPieceQuantity(unit: Unit, quantity: number): void {
  if (unit === 'piece' && quantity !== 1) {
    throw new BadRequestException('Objects measured per piece must have quantity 1');
  }
}