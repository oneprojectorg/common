/** Case-insensitive header lookup: the webhook route lowercases incoming
 *  header names, but vendors document them in mixed case. */
export const headerValue = (
  headers: Record<string, string>,
  name: string,
): string | undefined => {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
};
