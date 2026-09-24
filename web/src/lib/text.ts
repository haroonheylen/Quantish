// The API stores descriptions as HTML. Until a proper rich text editor is
// added (a future improvement), the form accepts plain text and converts it
// here: blank lines become paragraphs, single newlines become line breaks.

// Escape HTML characters so "<b>" typed by a user displays as text
// instead of turning into markup.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function plainTextToHtml(text: string): string | undefined {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return undefined;

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}