import { headingClasses } from '@op/styles/constants';
import { Extension, mergeAttributes } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
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
  // Details/Summary (collapsible) chrome lives in one raw-CSS block in
  // `@op/styles` (`.details` in shared-styles.css), shared by the editor's
  // built-in node view AND the viewer's native <details>. Nothing here.
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
 * Per-node placeholder for an empty Details summary. Scoped to `summary.is-empty`
 * (not the global `.is-empty`) so only the Details summary gets a hint — other
 * empty blocks are unaffected. Requires `Placeholder.configure({ includeChildren:
 * true })`, which `useRichTextEditor` wires when the Details extension is present.
 */
const detailsSummaryPlaceholderStyles = [
  '[&_summary.is-empty]:before:pointer-events-none',
  // float-start + h-0 pull the ::before out of the text flow so the caret sits
  // at the start of the summary, not after the placeholder text.
  '[&_summary.is-empty]:before:float-start',
  '[&_summary.is-empty]:before:h-0',
  '[&_summary.is-empty]:before:text-neutral-gray3',
  '[&_summary.is-empty]:before:content-[attr(data-placeholder)]',
  '[&_summary.is-empty]:before:font-serif',
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
export const baseEditorStyles = `${viewerProseStyles} outline-hidden placeholder:text-neutral-gray2 ${placeholderStyles} ${detailsSummaryPlaceholderStyles}`;

/**
 * Adds an `is-focused` class to the `details` node that currently contains the
 * selection. ProseMirror is a single contentEditable host, so DOM `:focus`
 * never lands inside an individual node — `:focus`/`:focus-within`/`:has(:focus)`
 * can't target "the details the caret is in". This node decoration can. It's
 * painted only while the editor is focused (CSS gates on `.ProseMirror-focused`).
 */
const DetailsFocus = Extension.create({
  name: 'detailsFocus',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('detailsFocus'),
        props: {
          decorations(state) {
            const { $from } = state.selection;
            for (let depth = $from.depth; depth > 0; depth--) {
              if ($from.node(depth).type.name === 'details') {
                const pos = $from.before(depth);
                return DecorationSet.create(state.doc, [
                  Decoration.node(pos, pos + $from.node(depth).nodeSize, {
                    class: 'is-focused',
                  }),
                ]);
              }
            }

            return DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/**
 * Base extensions shared by both editor and viewer
 */
const baseExtensions = [
  StarterKit,
  DetailsFocus,
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
  // Vanilla Details extension — its built-in node view provides the toggle
  // button + `is-open` class; all chrome is styled via `.details` CSS in
  // @op/styles. `persist` stores the open state in the doc.
  Details.configure({ persist: true, HTMLAttributes: { class: 'details' } }),
  DetailsSummary,
  DetailsContent,
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
