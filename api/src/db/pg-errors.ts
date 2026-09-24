// Postgres reports errors with 5-character codes. 23505 means a unique
// constraint was violated, e.g. inserting an article code that already exists.
const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  // Depending on the Drizzle version, the pg error is either the error itself
  // or wrapped inside error.cause. Check both.
  const direct = (error as { code?: string })?.code;
  const wrapped = (error as { cause?: { code?: string } })?.cause?.code;
  return direct === UNIQUE_VIOLATION || wrapped === UNIQUE_VIOLATION;
}
// 23514 = a CHECK constraint failed, e.g. a "piece" object with quantity 2.
// The API validates these rules first, so this is a safety net that turns
// a would-be 500 into a clear 400.
const CHECK_VIOLATION = '23514';

export function isCheckViolation(error: unknown): boolean {
  const direct = (error as { code?: string })?.code;
  const wrapped = (error as { cause?: { code?: string } })?.cause?.code;
  return direct === CHECK_VIOLATION || wrapped === CHECK_VIOLATION;
}