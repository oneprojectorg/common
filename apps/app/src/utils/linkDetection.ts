import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Characters that end the sentence rather than the URL. Covers the shipped
 * locales, not just ASCII: Arabic writes `،` and `؟`, Bengali ends a sentence
 * with `।`.
 */
const SENTENCE_PUNCTUATION = new Set([
  ...'.,;:!?\'"',
  '،',
  '؛',
  '؟',
  '।',
  '॥',
  '…',
  '’',
  '”',
  '»',
]);

/** Closing delimiter to the opener that would make it part of the URL. */
const BRACKETS = new Map([
  [')', '('],
  [']', '['],
  ['>', '<'],
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
            // A URL reads left-to-right inside Arabic prose too; without this
            // its trailing `/` renders at the visual start of the link.
            dir: 'ltr',
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
  // Closing brackets the URL never opened, counted once and decremented as
  // they come off: recounting per character makes a long run quadratic.
  const surplus = new Map(
    [...BRACKETS].map(([close, open]) => [
      close,
      countChar(match, close) - countChar(match, open),
    ]),
  );

  let end = match.length;

  while (end > 0) {
    const char = match.charAt(end - 1);
    const unopened = surplus.get(char);

    if (unopened !== undefined) {
      if (unopened <= 0) {
        break;
      }

      surplus.set(char, unopened - 1);
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
