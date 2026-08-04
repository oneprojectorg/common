'use client';

// viewerStyles subpath, not the @op/sense/RichTextEditor barrel: the barrel
// re-exports a hook (useEffect) and importing it from a server-rendered tree
// breaks the RSC build. Keep this subpath import — it has regressed before.
import { viewerProseStyles } from '@op/sense/RichTextEditor/viewerStyles';
import { useMemo } from 'react';

import { LinkPreview } from '../LinkPreview';

/**
 * Renders pre-generated HTML content for a proposal, replacing the read-only
 * TipTap editor with zero JS overhead for the prose content.
 *
 * Typography styles are shared with the TipTap editor via `viewerProseStyles`.
 *
 * Iframely embed placeholders (`<div data-iframely data-src="..."></div>`) are
 * replaced with `LinkPreview` components rendered within the same React tree,
 * preserving access to tRPC and other providers.
 */
export function ProposalHtmlContent({ html }: { html: string }) {
  const segments = useMemo(() => splitHtmlSegments(html), [html]);

  const hasEmbeds = segments.some((s) => s.type === 'embed');

  if (!hasEmbeds) {
    return (
      <div
        dir="auto"
        className={viewerProseStyles}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div dir="auto" className={viewerProseStyles}>
      {segments.map((segment, i) => {
        if (segment.type === 'embed') {
          return <LinkPreview key={i} url={segment.url} className="my-4" />;
        }
        return (
          <div key={i} dangerouslySetInnerHTML={{ __html: segment.content }} />
        );
      })}
    </div>
  );
}

/**
 * Regex matching iframely placeholder divs emitted by `IframelyServerNode.renderHTML()`.
 * Accounts for extra attributes like `xmlns` that `@tiptap/html` (happy-dom) injects.
 */
const IFRAMELY_PLACEHOLDER_RE =
  /<div[^>]*\sdata-iframely=""[^>]*\sdata-src="([^"]+)"[^>]*>\s*<\/div>/g;

/**
 * Split HTML string into segments of plain HTML and iframely embed URLs.
 * Each segment is either `{ type: 'html', content }` or `{ type: 'embed', url }`.
 */
function splitHtmlSegments(html: string) {
  const segments: Array<
    { type: 'html'; content: string } | { type: 'embed'; url: string }
  > = [];

  let lastIndex = 0;

  for (const match of html.matchAll(IFRAMELY_PLACEHOLDER_RE)) {
    const matchIndex = match.index ?? 0;
    const url = match[1];
    if (!url) {
      continue;
    }

    if (matchIndex > lastIndex) {
      segments.push({
        type: 'html',
        content: html.slice(lastIndex, matchIndex),
      });
    }
    segments.push({ type: 'embed', url: url.replaceAll('&amp;', '&') });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIndex) });
  }

  return segments;
}
