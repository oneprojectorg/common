const FORBIDDEN_TOKENS = new Set(['__proto__', 'prototype', 'constructor']);

const ARRAY_INDEX_PATTERN = /^(0|[1-9]\d*)$/;

const INVALID_ESCAPE_PATTERN = /~(?![01])/;

/**
 * Splits an RFC 6901 JSON Pointer into unescaped tokens. Returns undefined
 * for a malformed pointer or one that names a prototype key.
 */
export const parseJsonPointer = (pointer: string): string[] | undefined => {
  if (pointer === '') {
    return [];
  }
  if (!pointer.startsWith('/') || INVALID_ESCAPE_PATTERN.test(pointer)) {
    return undefined;
  }

  const tokens = pointer
    .slice(1)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'));

  if (tokens.some((token) => FORBIDDEN_TOKENS.has(token))) {
    return undefined;
  }
  return tokens;
};

export const readJsonPointer = ({
  data,
  pointer,
}: {
  data: unknown;
  pointer: string;
}): unknown => {
  const tokens = parseJsonPointer(pointer);
  if (!tokens) {
    return undefined;
  }

  let current = data;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX_PATTERN.test(token)) {
        return undefined;
      }
      current = current[Number(token)];
    } else if (isRecord(current) && Object.hasOwn(current, token)) {
      current = current[token];
    } else {
      return undefined;
    }
  }
  return current;
};

/**
 * Writes `value` into `target` at an object-key pointer, creating missing
 * objects on the way. Returns false when the pointer is invalid or passes
 * through a value that is not an object.
 */
export const writeJsonPointer = ({
  target,
  pointer,
  value,
}: {
  target: Record<string, unknown>;
  pointer: string;
  value: unknown;
}): boolean => {
  const tokens = parseJsonPointer(pointer);
  const lastToken = tokens?.at(-1);
  if (!tokens || lastToken === undefined) {
    return false;
  }

  let current = target;
  for (const token of tokens.slice(0, -1)) {
    const existing = Object.hasOwn(current, token) ? current[token] : undefined;
    if (existing === undefined) {
      const created: Record<string, unknown> = {};
      current[token] = created;
      current = created;
    } else if (isRecord(existing)) {
      current = existing;
    } else {
      return false;
    }
  }
  current[lastToken] = value;
  return true;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
