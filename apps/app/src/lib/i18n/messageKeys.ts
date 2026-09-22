// next-intl reads a period in a key as a path separator. Legacy keys are the
// English source strings, which contain periods, so both ends of the lookup —
// the dictionary loaded in `request.ts` and the key passed to `t()` — have to
// apply the same substitution, and it lives here rather than in either one.
//
// Keys added under a namespace (ADR 0005) contain no period and are addressed
// by their real path, so only top-level string entries are rewritten. The
// substitution disappears with the last legacy key.

/** A dictionary: top-level labels plus at most two levels of namespace. */
export type MessageTree = { [key: string]: string | MessageTree };

/** The lookup form of a single legacy message key. */
export const normalizeMessageKey = (key: string): string =>
  key.replaceAll('.', '_');

/**
 * The same substitution applied to a dictionary's top-level string entries.
 * A namespace object keeps its key — a namespace name never holds a period,
 * and its contents are addressed as a path.
 */
export const normalizeMessageKeys = (messages: MessageTree): MessageTree =>
  Object.fromEntries(
    Object.entries(messages).map(([key, value]) =>
      typeof value === 'string'
        ? [normalizeMessageKey(key), value]
        : [key, value],
    ),
  );
