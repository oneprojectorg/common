import React from 'react';

export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/** One run of linkified text: an `<a>` for a URL, a `<span>` for anything else. */
type LinkifiedNode = React.ReactElement<{ children: string }>;

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

/**
 * `linkifyText` for an optional slot: `undefined` when there is nothing to
 * render, so a caller that wraps its description in its own element renders no
 * element at all rather than an empty one.
 */
export function linkifyOptionalText(
  text: string | null | undefined,
): LinkifiedNode[] | undefined {
  return text ? linkifyText(text) : undefined;
}

export function linkifyText(text: string): LinkifiedNode[] {
  if (!text) {
    return [];
  }

  const parts = text.split(URL_REGEX);
  const elements: LinkifiedNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part && part.match(URL_REGEX)) {
      elements.push(
        React.createElement('a', {
          key: i,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-primary hover:underline',
          children: part,
        }),
      );
    } else if (part) {
      elements.push(React.createElement('span', { key: i, children: part }));
    }
  }

  return elements;
}
