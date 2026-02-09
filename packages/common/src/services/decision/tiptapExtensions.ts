import { Node, mergeAttributes } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

/**
 * Server-safe Iframely node extension for `generateHTML()`.
 *
 * This is a pure schema definition (name, group, attributes, parseHTML, renderHTML)
 * without any React node view renderer. TipTap's `generateHTML()` only uses
 * `renderHTML()`, so the React-dependent `addNodeView()` is not needed.
 *
 * Output: `<div data-iframely="" data-src="https://..."></div>`
 * The client-side viewer splits these out and renders `LinkPreview` components
 * inline within the React tree.
 */
const IframelyServerNode = Node.create({
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

/**
 * Server-side TipTap extensions for `generateHTML()`.
 *
 * These must match the editor/viewer extensions exactly (minus React-specific parts)
 * to ensure all node types are recognized during HTML generation. Any node type
 * present in the ProseMirror JSON that isn't registered here will be silently dropped.
 *
 * @see packages/ui/src/components/RichTextEditor/editorConfig.ts (base extensions)
 * @see apps/app/src/components/decisions/IframelyExtension.tsx (client version)
 */
export const serverExtensions = [
  StarterKit.configure({
    heading: false,
  }),
  Heading.configure({
    levels: [1, 2, 3],
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
  }),
  IframelyServerNode,
];
