import { serverExtensions, tiptapDocToPlainText } from '@op/common/client';
import { logger } from '@op/logging';
// Import from the editorConfig subpath (not the RichTextEditor barrel) so this
// server component doesn't pull the client editor (useRichTextEditor/useEffect)
// into the RSC graph — viewerProseStyles is a plain style string.
import { viewerProseStyles } from '@op/ui/RichTextEditor/editorConfig';
import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import type { ReactNode } from 'react';

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
 * recognized node set can't drift between the two render paths. An unregistered
 * node type THROWS during the parse (`Node.fromJSON`), so the render is wrapped
 * and degrades to plain text — one unsupported node can't crash the whole tab.
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

  let body: ReactNode;
  try {
    body = renderToReactElement({
      content,
      extensions: serverExtensions,
      options: { nodeMapping },
    });
  } catch (error) {
    // `renderToReactElement` parses the JSON into a ProseMirror doc eagerly
    // (Node.fromJSON), which throws on an unregistered node type. Without this
    // guard the throw escapes into the server render and takes down the whole
    // surrounding tab, not just the body. Degrade to plain text so a node the
    // server doesn't recognize yet (deploy skew / rollback / drift) stays readable.
    logger.warn(
      'RichTextRenderer: static render failed, falling back to text',
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    const text = tiptapDocToPlainText(content);
    body = text ? <p>{text}</p> : null;
  }

  return <div className={viewerProseStyles}>{body}</div>;
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
