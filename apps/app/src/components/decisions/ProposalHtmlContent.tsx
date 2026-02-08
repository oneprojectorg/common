'use client';

import { useEffect, useRef } from 'react';
import { type Root, createRoot } from 'react-dom/client';

import { LinkPreview } from '../LinkPreview';

/**
 * Prose styles that match the TipTap editor/viewer output.
 *
 * These replicate the styles from:
 * - `baseEditorStyles` in packages/ui/src/components/RichTextEditor/editorConfig.ts
 * - `StyledRichTextContent` in packages/ui/src/components/RichTextEditor/StyledRichTextContent.tsx
 *
 * @see packages/ui/src/components/RichTextEditor/editorConfig.ts
 * @see packages/ui/src/components/RichTextEditor/StyledRichTextContent.tsx
 */
const proseStyles = [
  // Base prose typography
  'prose prose-lg !text-base text-neutral-black',
  // Link styles
  '[&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline',
  // List styles
  '[&_li_p]:my-0',
  // Blockquote styles
  '[&_blockquote]:font-normal',
  // Heading styles
  '[&_:is(h1,h2)]:my-4 [&_:is(h1,h2)]:font-serif',
  '[&_h1]:text-title-lg [&_h2]:text-title-md [&_h3]:text-title-base',
  // Layout
  'leading-5 max-w-none break-words overflow-wrap-anywhere',
].join(' ');

/**
 * Renders pre-sanitized HTML content for proposal view.
 * Replaces the read-only TipTap editor with zero JS overhead for initial render.
 *
 * HTML is sanitized server-side by `generateProposalHtml()` using DOMPurify.
 * This component applies the same typography styles as the TipTap editor
 * so the visual output is identical.
 *
 * Iframely embed nodes render as `<div data-iframely data-src="..."></div>`.
 * After mounting, these are hydrated into `LinkPreview` cards.
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
      className={proseStyles}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
