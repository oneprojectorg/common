'use client';

import { viewerProseStyles } from '@op/ui/RichTextEditor';
import { useEffect, useRef } from 'react';
import { type Root, createRoot } from 'react-dom/client';

import { LinkPreview } from '../LinkPreview';

/**
 * Renders pre-generated HTML content for a proposal, replacing the read-only
 * TipTap editor with zero JS overhead for initial render.
 *
 * Typography styles are shared with the TipTap editor via `viewerProseStyles`.
 *
 * Iframely embed nodes are output by `generateHTML` as empty
 * `<div data-iframely data-src="..."></div>` placeholders. After mount, this
 * component hydrates them into interactive `LinkPreview` cards.
 */
export function ProposalHtmlContent({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const embedNodes =
      containerRef.current.querySelectorAll<HTMLElement>('[data-iframely]');

    if (embedNodes.length === 0) {
      return;
    }

    const roots: Root[] = [];

    for (const node of embedNodes) {
      const src = node.getAttribute('data-src');
      if (!src) {
        continue;
      }

      const root = createRoot(node);
      root.render(<LinkPreview url={src} className="my-4" />);
      roots.push(root);
    }

    return () => {
      for (const root of roots) {
        root.unmount();
      }
    };
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={viewerProseStyles}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
