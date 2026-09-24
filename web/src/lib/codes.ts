// Mirrors the API's rule, so the form can give instant feedback.
// The API still validates everything: it's the source of truth.
export const CODE_PATTERN = /^(\d{1,3}\.)+$/;

// "20.11.10." -> [20, 11, 10]
export function codeSegments(code: string): number[] {
  return code.split('.').filter(Boolean).map(Number);
}

// Bills are usually numbered in steps of 10 (20.10., 20.20., ...),
// which leaves room to insert articles in between later.
// Suggests the next free code after the existing siblings.
export function suggestNextCode(parentCode: string | null, siblingCodes: string[]): string {
  const lastSegments = siblingCodes.map((code) => codeSegments(code).at(-1) ?? 0);
  const next = lastSegments.length > 0 ? Math.max(...lastSegments) + 10 : 10;
  return `${parentCode ?? ''}${next}.`;
}