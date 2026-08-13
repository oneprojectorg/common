import { headingClasses } from '@op/styles/constants';
import { Extension, mergeAttributes } from '@tiptap/core';
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';

/**
 * TipTap heading extension that bakes the design-system `headingClasses` onto
 * each rendered `<h1>`–`<h4>` tag, keeping editor output visually identical to
 * the `Header1`–`Header4` components. Any level without a mapped class
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
  // StarterKit already bundles underline, strike, blockquote and
  // horizontalRule — don't re-add them or tiptap warns about duplicate
  // extension names. heading/link are disabled because we register our own
  // configured versions below.
  StarterKit.configure({
    heading: false,
    link: false,
  }),
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
