const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a user-supplied value for safe interpolation into HTML (emails, etc.). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
