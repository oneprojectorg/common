import { headingClasses } from '@op/styles/constants';
import { mergeAttributes } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

/**
 * Prose typography styles shared between the TipTap editor/viewer and the
 * static HTML proposal viewer (`ProposalHtmlContent`).
 *
 * Covers link colors, list spacing, blockquote weight, prose-context heading
 * margins, and general text layout. Heading typography itself is applied on
 * the heading tags via `StyledHeading` so it stays in sync with the
 * `Header*` design-system components.
 */
export const viewerProseStyles = [
  'prose prose-lg !text-base text-neutral-black',
  '[&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline',
  '[&_li_p]:my-0',
  '[&_blockquote]:font-normal',
  '[&_:is(h1,h2,h3)]:my-4',
  'leading-5 max-w-none break-words overflow-wrap-anywhere',
].join(' ');

/**
 * Placeholder hint shown once when the editor is empty. Targets the
 * Placeholder extension's `is-editor-empty` class (root-empty only), so it
 * never repeats per block. Inert unless the Placeholder extension is active
 * (i.e. a `placeholder` was passed), since `data-placeholder` is absent otherwise.
 */
const placeholderStyles = [
  '[&_.is-editor-empty:first-child]:before:pointer-events-none',
  '[&_.is-editor-empty:first-child]:before:float-start',
  '[&_.is-editor-empty:first-child]:before:h-0',
  '[&_.is-editor-empty:first-child]:before:text-neutral-gray3',
  '[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ');

/**
 * Per-line placeholder hint (Notion-style "press / for commands…"). Scoped to
 * TOP-LEVEL empty paragraphs only (`& > p`): not headings, and not paragraphs
 * nested in lists/blockquotes (a "press /" hint next to a list marker reads
 * oddly and the float/caret interaction is janky there). `:not(.is-editor-empty)`
 * keeps it from doubling with `placeholderStyles` on the whole-editor-empty line.
 * Opt-in: only added to the editor class (by `useRichTextEditor`) when a
 * `linePlaceholder` is passed, so existing single-placeholder editors are
 * unaffected.
 */
export const linePlaceholderStyles = [
  // Absolute (not float) so the hint never displaces the caret — absolute with
  // no offsets pins the ::before at the paragraph's text start (block made
  // `relative`) and stays out of flow, so the caret sits at the true start.
  '[&>p.is-empty:not(.is-editor-empty)]:relative',
  '[&>p.is-empty:not(.is-editor-empty)]:before:pointer-events-none',
  '[&>p.is-empty:not(.is-editor-empty)]:before:absolute',
  '[&>p.is-empty:not(.is-editor-empty)]:before:text-neutral-gray3',
  '[&>p.is-empty:not(.is-editor-empty)]:before:content-[attr(data-placeholder)]',
].join(' ');

/**
 * TipTap heading extension that bakes the design-system `headingClasses` onto
 * each rendered `<h1>`–`<h4>` tag, keeping editor output visually identical to
 * the `Header1/2/3/4` components in `@op/ui`. Any level without a mapped class
 * renders without a baked class.
 */
export const StyledHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as 1 | 2 | 3 | 4;
    const className =
      headingClasses[`h${level}` as keyof typeof headingClasses];
    return [
      `h${level}`,
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        className ? { class: className } : {},
      ),
      0,
    ];
  },
});

/**
 * Styles applied to the editor element
 */
export const baseEditorStyles = `${viewerProseStyles} outline-hidden placeholder:text-neutral-gray2 ${placeholderStyles}`;

/**
 * Base extensions shared by both editor and viewer
 */
const baseExtensions = [
  StarterKit,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
  }),
  StyledHeading.configure({
    levels: [1, 2, 3, 4],
  }),
  Underline,
  Strike,
  Blockquote,
  HorizontalRule,
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
