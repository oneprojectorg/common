import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { extractUrls, linkifyOptionalText, linkifyText } from './linkDetection';

const render = (text: string) => renderToStaticMarkup(linkifyText(text));

describe('linkifyText', () => {
  it('turns a URL into an anchor that opens safely in a new tab', () => {
    const markup = render('https://example.com/help');

    expect(markup).toContain('href="https://example.com/help"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('>https://example.com/help</a>');
  });

  it('keeps the surrounding text, as text, in order', () => {
    const markup = render('See https://example.com for details');

    expect(markup).toContain('<span>See </span><a');
    expect(markup).toContain('</a><span> for details</span>');
  });

  it('links every URL in the text', () => {
    const markup = render('https://a.example and https://b.example');

    expect(markup).toContain('href="https://a.example"');
    expect(markup).toContain('<span> and </span>');
    expect(markup).toContain('href="https://b.example"');
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
  // the edge.
  it('leaves sentence punctuation out of the href', () => {
    const markup = render('Read https://example.com/guide.');

    expect(markup).toContain('href="https://example.com/guide"');
    expect(markup).toContain('</a><span>.</span>');
  });

  it('leaves Arabic sentence punctuation out of the href', () => {
    const markup = render('زوروا https://example.com/guide، ثم املأ النموذج');

    expect(markup).toContain('href="https://example.com/guide"');
    expect(markup).toContain('</a><span>،</span>');
  });

  it('closes a bracket the prose opened, keeps one the URL opened', () => {
    expect(render('See (https://example.com/a) first')).toContain(
      'href="https://example.com/a"',
    );
    expect(render('(https://example.com/Foo_(bar))')).toContain(
      'href="https://example.com/Foo_(bar)"',
    );
  });
});

describe('extractUrls', () => {
  // The post feed renders a link preview per extracted URL beside the anchors
  // `linkifyText` builds, so the two have to agree on where the URL ends.
  it('agrees with linkifyText on where a URL ends', () => {
    expect(extractUrls('Read https://example.com/guide.')).toEqual([
      'https://example.com/guide',
    ]);
  });
});

describe('linkifyOptionalText', () => {
  it('returns undefined when there is nothing to render', () => {
    expect(linkifyOptionalText(undefined)).toBeUndefined();
    expect(linkifyOptionalText(null)).toBeUndefined();
    expect(linkifyOptionalText('')).toBeUndefined();
  });
});
