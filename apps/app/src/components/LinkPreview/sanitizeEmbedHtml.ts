import { EMBED_PROXY_PATH } from '@op/core';
import DOMPurify from 'dompurify';

// The one path under the proxy that serves an embed view, sandboxed by the CSP
// it sets (apps/app/src/app/api/embeds/api/iframe). Matched exactly: a prefix
// also admits the loader script, and reads as an allowance for whatever route
// is added under the proxy next.
const EMBED_VIEW_PATH = `${EMBED_PROXY_PATH}/api/iframe`;

// Only the iframes reach the page, so everything else here is about what an
// embed may arrive *inside*: a disallowed tag takes its subtree with it, which
// would lose an iframe a provider wrapped in a <figure>. Nothing in the list
// executes — no <script>, no event handlers, no <object>/<embed>.
const ALLOWED_TAGS = ['a', 'div', 'figure', 'iframe', 'p', 'section', 'span'];

// No `class` and no `style`: the card sizes the embed, and both are how an
// embed would size or position itself over the page instead — the app's own
// utilities ship in the stylesheet the embed renders against.
const ALLOWED_ATTR = [
  'allow',
  'allowfullscreen',
  'loading',
  'referrerpolicy',
  'src',
  'title',
];

/**
 * Sanitizes Iframely embed HTML for rendering via `dangerouslySetInnerHTML`.
 *
 * Returns `null` — never a blank-but-truthy string — when no embed survives,
 * so the caller falls back to the thumbnail instead of rendering an empty
 * video-sized box. Iframely's lazy wrapper shape is one such case: its anchor
 * only expands under embed.js, which needs an absolute URL that
 * `getLinkPreview`'s rewrite onto our proxy takes away.
 */
export const sanitizeEmbedHtml = (
  html: string | null | undefined,
): string | null => {
  // Without a DOM to parse with, DOMPurify returns its input UNSANITIZED, so
  // this has to answer before it is asked. Nothing renders an embed server
  // side today: the preview query resolves on the client.
  if (!html || !DOMPurify.isSupported) {
    return null;
  }

  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Both default to true, which would put `ALLOWED_ATTR` alongside every
    // `data-*` and `aria-*` an embed cares to bring — and this markup renders
    // inside the card's link, where an `aria-label` rewrites what a screen
    // reader announces the link as.
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    // A stripped tag's text would otherwise render as bare copy in the middle
    // of the embed box, which is a line a third-party site gets to write into
    // our card. An embed nested in a tag we don't allow goes with its wrapper
    // and the preview falls back to its thumbnail — the safer of the two.
    KEEP_CONTENT: false,
    RETURN_DOM_FRAGMENT: true,
  });

  const embeds = [...fragment.querySelectorAll('iframe')].filter(
    isRenderableEmbed,
  );

  if (embeds.length === 0) {
    return null;
  }

  for (const embed of embeds) {
    // A feed renders one preview per link, and a plain iframe loads as soon as
    // it is in the document — the deferral iframely's lazy wrapper used to
    // give us has to come from the attribute instead.
    embed.setAttribute('loading', 'lazy');
  }

  // The embeds alone, out of whatever iframely wrapped them in: a wrapper
  // sized by a padding hack needs embed.js's stylesheet to hold its iframe,
  // and the card supplies the box either way.
  const container = document.createElement('div');
  container.replaceChildren(...embeds);

  return container.innerHTML;
};

/**
 * An embed is only rendered when it frames the app's own embed proxy, which
 * `getLinkPreview` rewrites every iframely CDN URL onto and which serves the
 * view under a sandboxing CSP. A provider's own iframe would be framed with
 * none of that, so a preview that carries one falls back to its thumbnail.
 * The URL is resolved before it is read, so neither `/api/embeds/../elsewhere`
 * nor an encoded spelling of it passes as the proxy.
 */
const isRenderableEmbed = (element: Element): boolean => {
  const source = element.getAttribute('src');

  if (!source) {
    return false;
  }

  try {
    const resolved = new URL(source, window.location.href);

    return (
      resolved.origin === window.location.origin &&
      resolved.pathname === EMBED_VIEW_PATH
    );
  } catch {
    return false;
  }
};
