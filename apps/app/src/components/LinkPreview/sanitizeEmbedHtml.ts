import { EMBED_PROXY_PATH } from '@op/core';
import DOMPurify from 'dompurify';

// Iframely embeds arrive as either a bare <iframe>, or a responsive wrapper
// whose anchor carries `data-iframely-url` for embed.js to expand in place.
const EMBED_SELECTOR = 'iframe, [data-iframely-url]';

// Every attribute an embed loads from. An element is kept only when all of
// them resolve to somewhere we are willing to frame.
const EMBED_URL_ATTRIBUTES = ['data-iframely-url', 'src'];

// Enough to render an iframely embed and its responsive wrapper, and nothing
// that executes: no <script>, no event handlers, no <object>/<embed>. `href`
// is deliberately absent — embed.js replaces the wrapper anchor with the
// iframe, and an anchor that survived could cover the card and send the click
// somewhere the preview does not name.
const ALLOWED_TAGS = ['a', 'div', 'iframe'];
const ALLOWED_ATTR = [
  'allow',
  'allowfullscreen',
  'class',
  'frameborder',
  'height',
  'loading',
  'referrerpolicy',
  'scrolling',
  'src',
  'style',
  'title',
  'width',
];

/**
 * Sanitizes Iframely embed HTML for rendering via `dangerouslySetInnerHTML`.
 *
 * Returns `null` — never a blank-but-truthy string — when no embed survives,
 * so the caller falls back to the thumbnail instead of rendering an empty
 * video-sized box.
 */
export const sanitizeEmbedHtml = (
  html: string | null | undefined,
): string | null => {
  // Without a DOM to parse with, DOMPurify returns its input UNSANITIZED.
  // Server renders therefore get the thumbnail; the embed appears once the
  // client takes over.
  if (!html || !DOMPurify.isSupported) {
    return null;
  }

  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // A stripped tag's text would otherwise render as bare copy in the middle
    // of the embed box.
    KEEP_CONTENT: false,
    RETURN_DOM_FRAGMENT: true,
  });

  for (const element of fragment.querySelectorAll(EMBED_SELECTOR)) {
    if (!isRenderableEmbed(element)) {
      element.remove();
    }
  }

  // Inline style is how iframely sizes a responsive embed, so it stays — but
  // a positioned element leaves the card's `overflow-hidden` behind and can
  // cover the page with content of its own choosing.
  for (const element of fragment.querySelectorAll<HTMLElement>('[style]')) {
    element.style.removeProperty('position');
    element.style.removeProperty('z-index');
  }

  if (!fragment.querySelector(EMBED_SELECTOR)) {
    return null;
  }

  const container = document.createElement('div');
  container.append(fragment);

  return container.innerHTML;
};

/**
 * An embed may frame the app's own sandboxed `/api/embeds` proxy — which
 * `getLinkPreview` rewrites every iframely CDN URL onto — or the previewed
 * site itself over https. Anything else is neither: a same-origin path is the
 * app wearing an embed's clothes (`/api/embeds/../elsewhere` resolves right
 * out of the proxy), and any other scheme is not something we frame at all.
 */
const isRenderableEmbed = (element: Element): boolean => {
  const sources = EMBED_URL_ATTRIBUTES.map((attribute) =>
    element.getAttribute(attribute),
  ).filter((source) => source !== null);

  return sources.length > 0 && sources.every(isRenderableEmbedUrl);
};

const isRenderableEmbedUrl = (source: string): boolean => {
  try {
    const resolved = new URL(source, window.location.href);

    return resolved.origin === window.location.origin
      ? resolved.pathname.startsWith(`${EMBED_PROXY_PATH}/`)
      : resolved.protocol === 'https:';
  } catch {
    return false;
  }
};
