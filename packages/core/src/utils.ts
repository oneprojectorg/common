import he from 'he';

/**
 * Sanitizes a URL to prevent XSS attacks via javascript: or data: URI schemes.
 * Only allows http: and https: protocols.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '#';
    }
    return parsed.href;
  } catch {
    return '#';
  }
}

/*
 * A Rust-like match util
 *
 * @example
 * const schema = match(slug, {
 *   'people-powered': () => 'simple',
 *   'cowop': () => {
 *     // Could add complex logic here
 *     console.log('Using cowop schema');
 *     return 'cowop';
 *   },
 *   _: () => 'horizon'
 * });
 *
 * */
export const match = <T>(
  value: any,
  cases: Record<string | number, T | (() => T)>,
): T => {
  for (const [pattern, result] of Object.entries(cases)) {
    if (pattern === '_' || pattern == value || String(value) === pattern) {
      return typeof result === 'function' ? (result as () => T)() : result;
    }
  }

  throw new Error(`No matching case found for value: ${value}`);
};

// Checks for if a value is nullish and return TRUE if it is
export const isNullish = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'number' && isNaN(value));

/**
 * Safely extract text content from HTML without XSS vulnerability
 * Preserves line breaks from block-level HTML elements and slices by lines
 */
export function getTextPreview({
  content,
  maxLines = 1,
  maxLength = 300,
}: {
  content: string;
  maxLines?: number;
  maxLength?: number;
}): string {
  // First decode HTML entities (e.g., &lt;p&gt; becomes <p>)
  const decodedHtml = he.decode(content);

  // Replace block-level elements with newline markers before stripping HTML
  // This preserves semantic line breaks from paragraphs, divs, lists, etc.
  const withLineBreaks = decodedHtml
    .replace(/<\/?(p|div|li|h[1-6]|blockquote|tr)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // Strip HTML tags with a loop to handle nested/malformed tags like <<script>script>
  // A single-pass regex can miss tags that reassemble after replacement
  let text = withLineBreaks;
  const tagPattern = /<[^>]*>/g;
  let previous: string;
  do {
    previous = text;
    text = text.replace(tagPattern, '');
  } while (text !== previous);

  // Handle incomplete tags at end and orphaned closing brackets
  text = text
    .replace(/<[^>]*$/g, '') // Incomplete tags at end
    .replace(/^[^<]*>/g, (m) => (m.includes('<') ? m : '')) // Orphaned closing >
    .replace(/</g, '&lt;') // Escape any remaining < as a safety measure
    .replace(/>/g, '&gt;'); // Escape any remaining >

  // Split by newlines and filter out empty lines
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Take first N lines
  const previewLines = lines.slice(0, maxLines);
  const preview = previewLines.join(' ');

  // Truncate if still too long and add ellipsis if there's more content
  const hasMoreLines = lines.length > maxLines;
  const truncated =
    preview.length > maxLength ? preview.substring(0, maxLength) : preview;

  return hasMoreLines || truncated.length < preview.length
    ? truncated + '…'
    : truncated;
}
