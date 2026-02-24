import { z } from 'zod';

const emailSchema = z.string().email();

export const isValidEmail = (email: string) =>
  emailSchema.safeParse(email).success;

/**
 * Parse a pasted string of comma/semicolon/newline-separated emails into
 * deduplicated, validated email entries. Returns null if the text
 * doesn't look like a multi-email paste.
 */
export function parseEmailPaste(
  text: string,
  existingEmails: Set<string>,
): { id: string; name: string; email: string }[] | null {
  if (!text.includes(',') && !text.includes(';') && !text.includes('\n')) {
    return null;
  }

  const seen = new Set(existingEmails);
  const items: { id: string; name: string; email: string }[] = [];

  const candidates = text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const email of candidates) {
    if (isValidEmail(email) && !seen.has(email.toLowerCase())) {
      seen.add(email.toLowerCase());
      items.push({ id: `email-${email}`, name: email, email });
    }
  }

  return items;
}
