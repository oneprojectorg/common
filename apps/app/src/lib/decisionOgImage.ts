import { OPURLConfig } from '@op/core';

/** The decision OG card's dimensions and type, shared by its route and the meta tags. */
export const decisionOgImage = {
  // A static alt: the card text is localized per request, but localizing an
  // accessibility-only string isn't worth a per-locale image URL.
  alt: 'A decision on One Project',
  size: { width: 1200, height: 630 },
  contentType: 'image/png',
} as const;

/**
 * The og:image meta tags for a decision page whose card is served at
 * `<page path>/opengraph-image`.
 */
export const decisionOgImageMeta = (pagePath: string) => [
  {
    property: 'og:image',
    content: `${OPURLConfig('APP').ENV_URL}${pagePath}/opengraph-image`,
  },
  { property: 'og:image:type', content: decisionOgImage.contentType },
  {
    property: 'og:image:width',
    content: String(decisionOgImage.size.width),
  },
  {
    property: 'og:image:height',
    content: String(decisionOgImage.size.height),
  },
  { property: 'og:image:alt', content: decisionOgImage.alt },
];
