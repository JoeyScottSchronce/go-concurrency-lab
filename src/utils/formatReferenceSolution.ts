/**
 * Normalize model output for display: real newlines, no markdown fences,
 * so <pre> renders a readable multi-line Go example.
 */
export function formatReferenceSolution(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (s.startsWith('```')) {
    s = s.replace(/^```(?:go|golang)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }

  s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');

  return s.replace(/\n{5,}/g, '\n\n\n\n').trimEnd();
}
