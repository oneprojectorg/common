/**
 * Parse emails from input string, supporting both comma and line break separators
 * Returns both the emails and info about which separator was primarily used
 */
export const parseEmails = (
  input: string,
): { emails: string[]; hasLineBreaks: boolean } => {
  if (!input.trim()) return { emails: [], hasLineBreaks: false };

  const hasLineBreaks = /[\n\r]/.test(input);

  const emails = input
    .split(/[,\n\r]+/) // Split by comma, newline, or carriage return
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  return { emails, hasLineBreaks };
};

/**
 * Check if a key press should trigger email parsing
 */
export const shouldParseEmails = (key: string): boolean => {
  return key === ',' || key === 'Enter';
};
