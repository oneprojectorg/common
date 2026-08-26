// next-intl reads a period in a key as a path separator, but our keys are the
// English source strings, which contain periods. Both ends of the lookup — the
// dictionary loaded in `request.ts` and the key passed to `t()` — have to apply
// the same substitution, so it lives here rather than in either one.

/** The lookup form of a single message key. */
export const normalizeMessageKey = (key: string): string =>
  key.replaceAll('.', '_');

/** The same substitution applied to every key in a dictionary. */
export const normalizeMessageKeys = (
  messages: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      normalizeMessageKey(key),
      value,
    ]),
  );
