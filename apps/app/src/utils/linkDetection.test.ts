import { describe, expect, it } from 'vitest';

import { linkifyOptionalText, linkifyText } from './linkDetection';

describe('linkifyText', () => {
  it('turns a URL into an anchor that opens safely in a new tab', () => {
    const [anchor] = linkifyText('https://example.com/help');

    expect(anchor?.type).toBe('a');
    expect(anchor?.props).toMatchObject({
      href: 'https://example.com/help',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('keeps the surrounding text and its order', () => {
    const nodes = linkifyText('See https://example.com for details');

    expect(nodes.map((node) => node.type)).toEqual(['span', 'a', 'span']);
    expect(nodes.map((node) => node.props.children)).toEqual([
      'See ',
      'https://example.com',
      ' for details',
    ]);
  });

  it('leaves text with no URL alone', () => {
    const nodes = linkifyText('Plain help text');

    expect(nodes.map((node) => node.type)).toEqual(['span']);
  });

  it('does not link a bare domain with no scheme', () => {
    const nodes = linkifyText('Ask us at example.com');

    expect(nodes.map((node) => node.type)).toEqual(['span']);
  });
});

describe('linkifyOptionalText', () => {
  // An optional description slot renders its own wrapper element, so empty
  // input has to come back as `undefined` rather than an empty node list.
  it('returns undefined when there is nothing to render', () => {
    expect(linkifyOptionalText(undefined)).toBeUndefined();
    expect(linkifyOptionalText(null)).toBeUndefined();
    expect(linkifyOptionalText('')).toBeUndefined();
  });

  it('linkifies text that is present', () => {
    const nodes = linkifyOptionalText('Read https://example.com first');

    expect(nodes?.map((node) => node.type)).toEqual(['span', 'a', 'span']);
  });
});
