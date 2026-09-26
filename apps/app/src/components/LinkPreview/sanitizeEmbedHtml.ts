import { EMBED_PROXY_PATH } from '@op/core';
import DOMPurify from 'dompurify';

// Iframely embeds arrive as either a bare <iframe>, or a responsive wrapper
// whose anchor carries `data-iframely-url` for embed.js to expand in place.
const EMBED_SELECTOR = 'iframe, [data-iframely-url]';

// Every attribute an embed loads from. An element is kept only when all of
// them resolve to somewhere we are willing to frame.
const EMBED_URL_ATTRIBUTES = ['data-iframely-url', 'src'];

// Iframely's own wrapper classes (`iframely-embed`, `iframely-responsive`),
// which embed.js styles. Every other class is dropped: the app's utilities
// ship in the same stylesheet, so `fixed inset-0 z-50` on an embed would lift
// it out of the card just as inline positioning would.
const IFRAMELY_CLASS_PREFIX = 'iframely';

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
  for (const element of fragment.querySelectorAll<HTMLElement>(
    '[class], [style]',
  )) {
    element.style.removeProperty('position');
    element.style.removeProperty('z-index');
    keepIframelyClasses(element);
  }

  if (!fragment.querySelector(EMBED_SELECTOR)) {
    return null;
  }

  const container = document.createElement('div');
  container.append(fragment);

  return container.innerHTML;
};

const keepIframelyClasses = (element: Element) => {
  const kept = [...element.classList].filter((name) =>
    name.startsWith(IFRAMELY_CLASS_PREFIX),
  );

  if (kept.length > 0) {
    element.setAttribute('class', kept.join(' '));
  } else {
    element.removeAttribute('class');
  }
};

/**
 * An embed is only rendered when it frames the app's own `/api/embeds` proxy,
 * which `getLinkPreview` rewrites every iframely CDN URL onto and which serves
 * embed views under a sandboxing CSP. A provider's own iframe would be framed
 * with none of that, so a preview that carries one falls back to its
 * thumbnail. A same-origin URL still has to resolve inside the proxy:
 * `/api/embeds/../elsewhere` does not.
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

    return (
      resolved.origin === window.location.origin &&
      resolved.pathname.startsWith(`${EMBED_PROXY_PATH}/`)
    );
  } catch {
    return false;
  }
};
