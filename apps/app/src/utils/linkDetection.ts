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

export function linkifyText(text: string): React.ReactElement[] {
  if (!text) {
    return [];
  }

  const parts = text.split(URL_REGEX);
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part && part.match(URL_REGEX)) {
      elements.push(
        React.createElement(
          'a',
          {
            key: i,
            href: part,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-primary-teal hover:underline',
          },
          part,
        ),
      );
    } else if (part) {
      elements.push(React.createElement('span', { key: i }, part));
    }
  }

  return elements;
}
