import { EMBED_PROXY_PATH } from '@op/core';
import DOMPurify from 'dompurify';

// Iframely embeds arrive as either a bare <iframe>, or a responsive wrapper
// whose anchor carries `data-iframely-url` for embed.js to expand in place.
const EMBED_SELECTOR = 'iframe, [data-iframely-url]';

// Enough to render an iframely embed and its responsive wrapper, and nothing
// that executes: no <script>, no event handlers, no <object>/<embed>.
const ALLOWED_TAGS = ['a', 'div', 'iframe'];
const ALLOWED_ATTR = [
  'allow',
  'allowfullscreen',
  'class',
  'frameborder',
  'height',
  'href',
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
    RETURN_DOM_FRAGMENT: true,
  });

  for (const element of fragment.querySelectorAll(EMBED_SELECTOR)) {
    const source =
      element.getAttribute('data-iframely-url') ?? element.getAttribute('src');

    if (!isProxiedEmbed(source)) {
      element.remove();
    }
  }

  if (!fragment.querySelector(EMBED_SELECTOR)) {
    return null;
  }

  const container = document.createElement('div');
  container.append(fragment);

  return container.innerHTML;
};

/**
 * `getLinkPreview` rewrites every iframely CDN URL in the embed HTML onto the
 * app's own sandboxed proxy, so an embed sourced from anywhere else is not one
 * we serve: a third-party site controls what its meta tags advertise, and an
 * arbitrary iframe on our origin is a phishing surface.
 *
 * The URL is resolved before it is tested — a prefix match on the raw value
 * accepts `/api/embeds/../elsewhere`, which the browser loads from the app.
 */
const isProxiedEmbed = (source: string | null): boolean => {
  if (!source) {
    return false;
  }

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
