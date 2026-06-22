import { serverExtensions } from '@op/common/client';
// Import from the editorConfig subpath (not the RichTextEditor barrel) so this
// server component doesn't pull the client editor (useRichTextEditor/useEffect)
// into the RSC graph — viewerProseStyles is a plain style string.
import { viewerProseStyles } from '@op/ui/RichTextEditor/editorConfig';
import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';

import { LinkPreview } from '../LinkPreview';
import { ProposalHtmlContent } from './ProposalHtmlContent';

/**
 * Static (SSR-friendly) renderer for stored TipTap rich-text content.
 *
 * This is the principled replacement for {@link ProposalHtmlContent}'s
 * `dangerouslySetInnerHTML` + Iframely regex path. `renderToReactElement` is
 * pure JS (no DOM), so it runs in a React Server Component — the rendered prose
 * ships as server HTML with zero client JS, and custom nodes render as real
 * React components (e.g. embeds, and — once authored — Details/summary).
 *
 * Input is dual-read:
 *  - a TipTap JSON doc (object) → static React render via the `nodeMapping`.
 *  - a legacy HTML string → delegates to {@link ProposalHtmlContent} so existing
 *    HTML-stored bodies (and their Iframely placeholders) still render until the
 *    content is migrated/backfilled to JSON.
 *
 * The module itself is server-capable (no `'use client'`); only the
 * {@link LinkPreview} embed leaf is a client island within the rendered tree.
 *
 * Extensions are shared with `generateProposalHtml`'s `serverExtensions` so the
 * recognized node set can't drift between the two render paths (an unknown node
 * is silently dropped, so this single source of truth matters).
 */
export function RichTextRenderer({
  content,
}: {
  content: JSONContent | string | null | undefined;
}) {
  if (!content) {
    return null;
  }

  // Legacy HTML string → existing innerHTML + Iframely path. JSON is an object.
  if (typeof content === 'string') {
    return <ProposalHtmlContent html={content} />;
  }

  return (
    <div className={viewerProseStyles}>
      {renderToReactElement({
        content,
        extensions: serverExtensions,
        options: { nodeMapping },
      })}
    </div>
  );
}

/**
 * Custom-node renderers. Standard nodes/marks render automatically from
 * `serverExtensions`; only nodes whose static markup differs from a plain
 * `renderHTML` need an entry here.
 */
const nodeMapping = {
  // `iframely` is a schema-only atom (a `<div data-iframely data-src>`
  // placeholder); render the live embed in-tree instead, preserving tRPC access.
  iframely: ({ node }: { node: { attrs?: { src?: string } } }) => {
    const src = node.attrs?.src;
    return src ? <LinkPreview url={src} className="my-4" /> : null;
  },
};
