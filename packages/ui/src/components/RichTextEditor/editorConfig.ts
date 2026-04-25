import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';

/**
 * Prose typography styles shared between the TipTap editor/viewer and the
 * static HTML proposal viewer (`ProposalHtmlContent`).
 *
 * Covers link colors, list spacing, blockquote weight, heading typography,
 * and general text layout. Does NOT include focus or placeholder styles.
 */
export const viewerProseStyles = [
  'prose prose-lg !text-base text-neutral-black',
  '[&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline',
  '[&_li_p]:my-0',
  '[&_blockquote]:font-normal',
  '[&_:is(h1,h2)]:my-4 [&_:is(h1,h2)]:font-serif',
  '[&_h1]:text-title-lg [&_h2]:text-title-md [&_h3]:text-title-base',
  'leading-5 max-w-none break-words overflow-wrap-anywhere',
].join(' ');

/**
 * Styles applied to the editor element
 */
export const baseEditorStyles = `${viewerProseStyles} outline-hidden placeholder:text-neutral-gray2`;

/**
 * Base extensions shared by both editor and viewer.
 *
 * StarterKit v3 bundles link, underline, strike, blockquote, heading,
 * and horizontalRule. We disable heading and link here because they
 * need different configuration per context (editor vs viewer).
 */
const baseExtensions = [
  StarterKit.configure({
    heading: false,
    link: false,
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
  }),
  Heading.configure({
    levels: [1, 2, 3],
  }),
];

/**
 * Default editor extensions for editable content
 */
export const defaultEditorExtensions = [
  ...baseExtensions,
  Link.configure({
    openOnClick: false,
  }),
];

/**
 * Default viewer extensions for read-only content (links open on click)
 */
export const defaultViewerExtensions = [
  ...baseExtensions,
  Link.configure({
    openOnClick: true, // Allow clicking links in view mode
  }),
];
