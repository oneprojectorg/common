import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Schema-only Iframely node extension.
 *
 * Defines the ProseMirror schema (name, group, attributes, parseHTML, renderHTML)
 * without any React node view, commands, or input rules. This is the shared base
 * used by both:
 *
 * - **Server**: directly by `generateHTML()` in `tiptapExtensions.ts`
 * - **Client**: extended with `addNodeView()`, `addCommands()`, etc. in
 *   `apps/app/.../IframelyExtension.tsx`
 *
 * Output: `<div data-iframely="" data-src="https://..."></div>`
 */
export const IframelyNode = Node.create({
  name: 'iframely',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-src'),
        renderHTML: (attributes) => {
          if (!attributes.src) {
            return {};
          }

          return {
            'data-src': attributes.src,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-iframely]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-iframely': '' }, HTMLAttributes)];
  },
});
