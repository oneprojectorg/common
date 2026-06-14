/**
 * proposalData keys that never carry user-written prose: structured values,
 * references, and bookkeeping. Everything else that holds a string is treated
 * as moderatable text — proposal templates can define any number of custom
 * text fields, so an allowlist of known field names would silently skip them.
 */
const NON_TEXT_KEYS: ReadonlySet<string> = new Set([
  'category',
  'budget',
  'attachmentIds',
  'collaborationDocId',
  'collaborationDocVersionId',
]);

/**
 * Collects the moderatable text of a proposal's data record: every own string
 * field except the known non-prose keys, joined for a single moderation pass.
 * Works on raw `proposalData` and on the assembled template-validation data
 * (which carries the latest TipTap fragment text per template field).
 */
export const extractProposalText = (data: unknown): string => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return '';
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (NON_TEXT_KEYS.has(key)) {
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      parts.push(value);
    }
  }
  return parts.join('\n\n');
};
