import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

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
  let key = 0;

  for (const part of parts) {
    if (part && part.match(URL_REGEX)) {
      elements.push(
        React.createElement(
          'a',
          {
            key: key++,
            href: part,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-primary-teal hover:underline',
          },
          part,
        ),
      );
    } else if (part) {
      const lines = part.split('\n');
      for (let j = 0; j < lines.length; j++) {
        if (j > 0) {
          elements.push(React.createElement('br', { key: key++ }));
        }
        if (lines[j]) {
          elements.push(React.createElement('span', { key: key++ }, lines[j]));
        }
      }
    }
  }

  return elements;
}
