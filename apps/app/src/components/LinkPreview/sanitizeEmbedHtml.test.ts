// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeEmbedHtml } from './sanitizeEmbedHtml';

// The embed shape the app can render: an iframe on our own proxy, which
// `getLinkPreview` has already rewritten the iframely CDN host into.
const proxiedIframe =
  '<iframe src="/api/embeds/api/iframe?url=video" style="border: 0;" allowfullscreen allow="encrypted-media"></iframe>';

// Iframely's other shape: a wrapper whose anchor embed.js would expand in
// place, which it cannot do once the URL is proxy-relative.
const responsiveEmbed =
  '<div class="iframely-embed"><div class="iframely-responsive" style="padding-bottom: 56.25%;">' +
  '<a href="https://example.com/video" data-iframely-url="/api/embeds/api/iframe?url=video"></a>' +
  '</div></div><script async src="/api/embeds/embed.js"></script>';

describe('sanitizeEmbedHtml', () => {
  it('keeps a proxied iframe with the attributes it needs to render', () => {
    const sanitized = sanitizeEmbedHtml(proxiedIframe);

    expect(sanitized).toContain('src="/api/embeds/api/iframe?url=video"');
    expect(sanitized).toContain('allowfullscreen');
    expect(sanitized).toContain('allow="encrypted-media"');
    expect(sanitized).toContain('loading="lazy"');
  });

  it('keeps the responsive wrapper an iframe arrives in, sizing and all', () => {
    const sanitized = sanitizeEmbedHtml(
      '<div class="iframely-responsive" style="height: 0; padding-bottom: 56.25%;">' +
        '<iframe src="/api/embeds/api/iframe?url=video" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>' +
        '</div>',
    );

    expect(sanitized).toContain('class="iframely-responsive"');
    expect(sanitized).toContain('padding-bottom: 56.25%');
    expect(sanitized).toContain('position: absolute');
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

  it('strips positioning that would lift the embed out of its card', () => {
    const sanitized = sanitizeEmbedHtml(
      '<iframe src="/api/embeds/api/iframe?url=video" style="position: fixed; inset: 0; width: 100vw"></iframe>',
    );

    expect(sanitized).not.toContain('position');
    expect(sanitized).toContain('width: 100vw');
  });

  it('strips a position the style spells indirectly', () => {
    const sanitized = sanitizeEmbedHtml(
      '<iframe src="/api/embeds/api/iframe?url=video" style="--escape: fixed; position: var(--escape); inset: 0"></iframe>',
    );

    expect(sanitized).not.toContain('position');
  });

  it('strips app utility classes an embed brought with it', () => {
    const sanitized = sanitizeEmbedHtml(
      `<div class="iframely-embed fixed inset-0 z-50">${proxiedIframe}</div>`,
    );

    expect(sanitized).toContain('class="iframely-embed"');
    expect(sanitized).not.toContain('fixed');
    expect(sanitized).not.toContain('z-50');
  });

  it('drops text left behind by a stripped tag', () => {
    const sanitized = sanitizeEmbedHtml(
      `<noscript>Enable JavaScript</noscript>${proxiedIframe}`,
    );

    expect(sanitized).not.toContain('Enable JavaScript');
  });

  it('returns null for the anchor shape embed.js cannot expand', () => {
    expect(sanitizeEmbedHtml(responsiveEmbed)).toBeNull();
  });

  it('returns null for an iframe the provider serves itself', () => {
    expect(
      sanitizeEmbedHtml(
        '<iframe src="https://provider.example/embed"></iframe>',
      ),
    ).toBeNull();
  });

  it('returns null for an embed path that escapes the proxy', () => {
    expect(
      sanitizeEmbedHtml('<iframe src="/api/embeds/../elsewhere"></iframe>'),
    ).toBeNull();
    expect(
      sanitizeEmbedHtml(
        '<iframe src="/api/embeds/api/iframe/..%2felsewhere"></iframe>',
      ),
    ).toBeNull();
  });

  it('returns null for the proxy route that is not an embed view', () => {
    expect(
      sanitizeEmbedHtml('<iframe src="/api/embeds/embed.js"></iframe>'),
    ).toBeNull();
  });

  it('returns null for an iframe with no source to frame', () => {
    expect(sanitizeEmbedHtml('<iframe></iframe>')).toBeNull();
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
