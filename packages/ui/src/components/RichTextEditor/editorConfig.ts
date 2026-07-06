import {
  type SharedTiptapBaseOptions,
  buildSharedTiptapBase,
} from '@op/common/tiptap';
import { type AnyExtension, Extension } from '@tiptap/core';
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export { StyledHeading } from '@op/common/tiptap';

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

export type BaseExtensionOptions = SharedTiptapBaseOptions;

/**
 * The shared editor/viewer extension set: the canonical base from
 * `@op/common/tiptap` (the same base `serverExtensions` renders with) plus
 * the client-only extensions that need a live editor. Every extension is
 * registered exactly once — consumers layer their own extensions on top of
 * the returned array instead of filtering or re-registering, which is how
 * duplicate-extension bugs happen.
 */
export function buildBaseExtensions(
  options: BaseExtensionOptions = {},
): AnyExtension[] {
  return [
    ...buildSharedTiptapBase(options),
    DetailsFocus,
    // Vanilla Details extension — its built-in node view provides the toggle
    // button + `is-open` class; all chrome is styled via `.details` CSS in
    // @op/styles. `persist` stores the open state in the doc.
    Details.configure({ persist: true, HTMLAttributes: { class: 'details' } }),
    DetailsSummary,
    DetailsContent,
  ];
}

/**
 * Default editor extensions for editable content
 */
export const defaultEditorExtensions = buildBaseExtensions();

/**
 * Default viewer extensions for read-only content (links open on click)
 */
export const defaultViewerExtensions = buildBaseExtensions({
  link: { openOnClick: true },
});
