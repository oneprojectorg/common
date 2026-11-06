/**
 * Replaces each `{{token}}` from `tokens` in one pass. A value that contains a
 * token is not expanded again, and any other text in double braces stays as
 * typed.
 */
export function renderMessageTemplate<Token extends string>({
  template,
  tokens,
  values,
}: {
  template: string;
  tokens: ReadonlyArray<Token>;
  values: Record<Token, string>;
}): string {
  if (tokens.length === 0) {
    return template;
  }

  const pattern = new RegExp(
    `\\{\\{(${tokens.map(escapeRegExp).join('|')})\\}\\}`,
    'g',
  );
  const isToken = (value: string): value is Token =>
    tokens.some((token) => token === value);

  return template.replace(pattern, (match, token: string) =>
    isToken(token) ? values[token] : match,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
