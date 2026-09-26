// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeEmbedHtml } from './sanitizeEmbedHtml';

// Iframely's responsive embed: embed.js expands the anchor in place using
// `data-iframely-url`. `getLinkPreview` has already rewritten the CDN host to
// the app's proxy by the time the HTML reaches the component.
const responsiveEmbed =
  '<div class="iframely-embed"><div class="iframely-responsive" style="padding-bottom: 56.25%;">' +
  '<a href="https://example.com/video" data-iframely-url="/api/embeds/api/iframe?url=video"></a>' +
  '</div></div><script async src="/api/embeds/embed.js"></script>';

// Iframely's other shape: the embed is the iframe itself.
const proxiedIframe =
  '<iframe src="/api/embeds/api/iframe?url=video" style="border: 0;" allowfullscreen allow="encrypted-media"></iframe>';

describe('sanitizeEmbedHtml', () => {
  it('keeps a responsive embed and drops the inline embed.js script', () => {
    const sanitized = sanitizeEmbedHtml(responsiveEmbed);

    expect(sanitized).toContain(
      'data-iframely-url="/api/embeds/api/iframe?url=video"',
    );
    expect(sanitized).toContain('class="iframely-responsive"');
    expect(sanitized).toContain('padding-bottom: 56.25%');
    expect(sanitized).not.toContain('<script');
  });

  it('keeps a proxied iframe with the attributes it needs to render', () => {
    const sanitized = sanitizeEmbedHtml(proxiedIframe);

    expect(sanitized).toContain('src="/api/embeds/api/iframe?url=video"');
    expect(sanitized).toContain('allowfullscreen');
    expect(sanitized).toContain('allow="encrypted-media"');
  });

  it('strips scripts and event handlers wrapped around an embed', () => {
    const sanitized = sanitizeEmbedHtml(
      `<script>steal()</script><div onclick="hijack()"><img src=x onerror="exfiltrate()">${proxiedIframe}</div>`,
    );

    expect(sanitized).toContain('src="/api/embeds/api/iframe?url=video"');
    expect(sanitized).not.toContain('steal');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('exfiltrate');
  });

  it('strips the link out of the wrapper anchor', () => {
    expect(sanitizeEmbedHtml(responsiveEmbed)).not.toContain('href');
  });

  it('returns null for an iframe the provider serves itself', () => {
    expect(
      sanitizeEmbedHtml(
        '<iframe src="https://provider.example/embed"></iframe>',
      ),
    ).toBeNull();
  });

  it('strips positioning that would lift the embed out of its card', () => {
    const sanitized = sanitizeEmbedHtml(
      '<iframe src="/api/embeds/api/iframe?url=video" style="position: fixed; inset: 0; z-index: 9999; width: 100vw"></iframe>',
    );

    expect(sanitized).not.toContain('position');
    expect(sanitized).not.toContain('z-index');
    expect(sanitized).toContain('width: 100vw');
  });

  it('strips app utility classes an embed brought with it', () => {
    const sanitized = sanitizeEmbedHtml(
      '<div class="iframely-embed fixed inset-0 z-50">' +
        '<a data-iframely-url="/api/embeds/api/iframe?url=video"></a></div>',
    );

    expect(sanitized).toContain('class="iframely-embed"');
    expect(sanitized).not.toContain('fixed');
    expect(sanitized).not.toContain('z-50');
  });

  it('drops an embed whose second URL attribute leaves the proxy', () => {
    expect(
      sanitizeEmbedHtml(
        '<iframe src="https://attacker.example/phish" data-iframely-url="/api/embeds/api/iframe?url=video"></iframe>',
      ),
    ).toBeNull();
  });

  it('drops text left behind by a stripped tag', () => {
    const sanitized = sanitizeEmbedHtml(
      `<noscript>Enable JavaScript</noscript>${proxiedIframe}`,
    );

    expect(sanitized).not.toContain('Enable JavaScript');
  });

  it('returns null for an embed path that escapes the proxy', () => {
    expect(
      sanitizeEmbedHtml('<iframe src="/api/embeds/../elsewhere"></iframe>'),
    ).toBeNull();
  });

  it('returns null for an embed anchor pointing at a script URL', () => {
    expect(
      sanitizeEmbedHtml(
        '<div class="iframely-embed"><a data-iframely-url="javascript:steal()"></a></div>',
      ),
    ).toBeNull();
  });

  it('returns null when the markup holds no embed at all', () => {
    expect(sanitizeEmbedHtml('<p class="lead">A description</p>')).toBeNull();
  });

  it('returns null for missing HTML', () => {
    expect(sanitizeEmbedHtml(undefined)).toBeNull();
    expect(sanitizeEmbedHtml(null)).toBeNull();
    expect(sanitizeEmbedHtml('')).toBeNull();
  });
});
