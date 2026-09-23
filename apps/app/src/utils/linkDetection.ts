import React from 'react';

export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
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
            // A URL reads left-to-right inside Arabic help text too, and
            // without this its trailing `/` migrates to the visual start.
            dir: 'ltr',
            className: 'text-primary underline underline-offset-4',
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
 * Splits a matched run into the href and the sentence punctuation that follows
 * it — `[^\s]+` cannot tell `…/guide.` from a path that really ends in a dot.
 */
function splitTrailingPunctuation(match: string): [string, string] {
  // A closing bracket belongs to the URL only when the URL opened one.
  const trailing = /[([]/.test(match) ? /[.,;:!?'"]+$/ : /[.,;:!?'")\]]+$/;
  const href = match.replace(trailing, '');

  return [href, match.slice(href.length)];
}
