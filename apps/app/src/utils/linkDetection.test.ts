import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { linkifyOptionalText, linkifyText } from './linkDetection';

const render = (text: string) => renderToStaticMarkup(linkifyText(text));

describe('linkifyText', () => {
  it('turns a URL into an anchor that opens safely in a new tab', () => {
    expect(render('https://example.com/help')).toBe(
      '<a href="https://example.com/help" target="_blank" rel="noopener noreferrer" dir="ltr" class="text-primary underline underline-offset-4">https://example.com/help</a>',
    );
  });

  it('keeps the surrounding text, as text, in order', () => {
    expect(render('See https://example.com for details')).toContain(
      '<span>See </span><a',
    );
    expect(render('See https://example.com for details')).toContain(
      '</a><span> for details</span>',
    );
  });

  it('links every URL in the text', () => {
    expect(render('https://a.example and https://b.example')).toContain(
      'href="https://b.example"',
    );
  });

  it('does not link a bare domain with no scheme', () => {
    expect(render('Ask us at example.com')).toBe(
      '<span>Ask us at example.com</span>',
    );
  });

  it('returns nothing for empty text', () => {
    expect(linkifyText('')).toEqual([]);
  });

  // Help text is prose, so a URL that ends a sentence is the common case, not
  // the edge: the sentence's punctuation must not end up inside the href.
  it('leaves sentence punctuation out of the href', () => {
    expect(render('Read https://example.com/guide.')).toBe(
      '<span>Read </span><a href="https://example.com/guide" target="_blank" rel="noopener noreferrer" dir="ltr" class="text-primary underline underline-offset-4">https://example.com/guide</a><span>.</span>',
    );
    expect(render('See (https://example.com/a) first')).toContain(
      'href="https://example.com/a"',
    );
  });

  it('keeps a bracket the URL itself opened', () => {
    expect(render('https://example.com/Foo_(bar).')).toContain(
      'href="https://example.com/Foo_(bar)"',
    );
  });
});

describe('linkifyOptionalText', () => {
  it('returns undefined when there is nothing to render', () => {
    expect(linkifyOptionalText(undefined)).toBeUndefined();
    expect(linkifyOptionalText(null)).toBeUndefined();
    expect(linkifyOptionalText('')).toBeUndefined();
  });

  it('linkifies text that is present', () => {
    expect(
      renderToStaticMarkup(linkifyOptionalText('https://example.com')),
    ).toContain('<a href="https://example.com"');
  });
});
