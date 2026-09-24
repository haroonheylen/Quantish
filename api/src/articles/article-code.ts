import { BadRequestException } from '@nestjs/common';

// One or more groups of 1 to 3 digits, each ending in a dot.
// Matches "20.", "20.11.", "20.11.10." Rejects "20", "20..11.", "a.".
export const ARTICLE_CODE_PATTERN = /^(\d{1,3}\.)+$/;

// "20.11.10." -> [20, 11, 10]
export function codeSegments(code: string): number[] {
  return code.split('.').filter(Boolean).map(Number);
}

// Sorts by numeric segments, so "20.2." comes before "20.11."
// (plain text sorting would put "20.11." first).
// A missing segment counts as -1, so a parent sorts before its children.
export function compareCodes(a: string, b: string): number {
  const as = codeSegments(a);
  const bs = codeSegments(b);
  const length = Math.max(as.length, bs.length);

  for (let i = 0; i < length; i++) {
    const x = as[i] ?? -1;
    const y = bs[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

// Enforces the hierarchy rule:
// - a top-level article has exactly one segment ("20.")
// - a child starts with its parent's code and adds exactly one segment
//   ("20.11." under "20.")
export function assertCodeFitsParent(code: string, parentCode: string | null): void {
  const depth = codeSegments(code).length;

  if (parentCode === null) {
    if (depth !== 1) {
      throw new BadRequestException(
        `Top-level article codes have one segment, e.g. "20.". Got "${code}".`,
      );
    }
    return;
  }

  const parentDepth = codeSegments(parentCode).length;
  if (!code.startsWith(parentCode) || depth !== parentDepth + 1) {
    throw new BadRequestException(
      `Code "${code}" must extend its parent "${parentCode}" by one segment, e.g. "${parentCode}10.".`,
    );
  }
}