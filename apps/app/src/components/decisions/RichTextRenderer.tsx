import {
  sanitizeTiptapDoc,
  serverExtensions,
  tiptapDocToPlainText,
} from '@op/common/client';
import { logger } from '@op/logging';
// Import from the viewerStyles subpath (not editorConfig or the barrel) so
// this server component pulls neither the client editor nor the TipTap
// extension set into the RSC graph — viewerProseStyles is a plain style string.
import { viewerProseStyles } from '@op/sense/RichTextEditor/viewerStyles';
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
 * node type THROWS during the parse (`Node.fromJSON`), so the doc is sanitized
 * first (`sanitizeTiptapDoc` coerces unknown nodes/marks to known ones) — known
 * content stays rich, only the unsupported pieces degrade. A try/catch backstop
 * still falls back to whole-doc plain text for failures sanitizing can't prevent.
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
    // Sanitize first: coerce any node/mark the server schema doesn't know into a
    // known shape, so the parse can't throw on an unsupported type (deploy skew /
    // rollback / drift). Known content renders rich; only unknown pieces degrade.
    body = renderToReactElement({
      content: sanitizeTiptapDoc(content),
      extensions: serverExtensions,
      options: { nodeMapping },
    });
  } catch (error) {
    // Backstop: sanitizing can't prevent every failure (e.g. a content-model
    // violation from the coercion). Degrade the whole body to plain text rather
    // than let the throw crash the surrounding tab.
    logger.warn(
      'RichTextRenderer: static render failed, falling back to text',
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    // Render each block as its own <p> so block breaks survive (a single <p>
    // with newlines collapses them to spaces in HTML). prose spacing on the
    // wrapper gives the blocks readable separation.
    const text = tiptapDocToPlainText(content);
    body = text
      ? text.split('\n').map((block, index) => <p key={index}>{block}</p>)
      : null;
  }

  return (
    <div dir="auto" className={viewerProseStyles}>
      {body}
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
  // Details/summary need no entry: they render via their renderHTML to a native
  // `<details><summary>…` (collapsible with zero JS), styled by the shared
  // `.details` CSS in @op/styles — the same block that styles the editor.
};
