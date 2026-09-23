import React from 'react';

export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Characters that end the sentence rather than the URL. Includes the Arabic
 * comma, semicolon and question mark, and the curly quotes: the app ships
 * locales that write them.
 */
const SENTENCE_PUNCTUATION = new Set([
  ...'.,;:!?\'"',
  '،',
  '؛',
  '؟',
  '‘',
  '’',
  '“',
  '”',
  '»',
]);

const BRACKET_OPENERS = new Map([
  [')', '('],
  [']', '['],
]);

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];

  return matches.map((match) => splitTrailingPunctuation(match)[0]);
}

export function detectLinks(text: string): { text: string; urls: string[] } {
  if (!text) {
    return { text, urls: [] };
  }

  const urls = extractUrls(text);
  return { text, urls };
}

/** Returns `undefined` for empty text: an empty array is truthy, so a caller
 *  that wraps its content in an element would render an empty one. */
export function linkifyOptionalText(
  text: string | null | undefined,
): React.ReactElement[] | undefined {
  return text ? linkifyText(text) : undefined;
}

export function linkifyText(text: string): React.ReactElement[] {
  if (!text) {
    return [];
  }

  const parts = text.split(URL_REGEX);
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part && part.match(URL_REGEX)) {
      const [href, trailing] = splitTrailingPunctuation(part);

      elements.push(
        React.createElement(
          'a',
          {
            key: i,
            href,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-primary hover:underline',
          },
          href,
        ),
      );

      if (trailing) {
        elements.push(
          React.createElement('span', { key: `${i}-trailing` }, trailing),
        );
      }
    } else if (part) {
      elements.push(React.createElement('span', { key: i }, part));
    }
  }

  return elements;
}

/**
 * Splits a matched run into the URL and the punctuation that follows it —
 * `[^\s]+` cannot tell `…/guide.` from a path that really ends in a dot.
 */
function splitTrailingPunctuation(match: string): [string, string] {
  let end = match.length;

  while (end > 0) {
    const char = match.charAt(end - 1);
    const opener = BRACKET_OPENERS.get(char);

    if (opener) {
      // A closing bracket is the URL's own only while it has one still open.
      const candidate = match.slice(0, end);

      if (countChar(candidate, opener) >= countChar(candidate, char)) {
        break;
      }
    } else if (!SENTENCE_PUNCTUATION.has(char)) {
      break;
    }

    end -= 1;
  }

  return [match.slice(0, end), match.slice(end)];
}

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}
