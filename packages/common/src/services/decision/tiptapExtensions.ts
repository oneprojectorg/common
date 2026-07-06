import { Node, mergeAttributes } from '@tiptap/core';

import { buildSharedTiptapBase } from './tiptapBase';

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
 * Server-safe schema for the Details (collapsible) nodes — schema only, no React
 * node view (mirrors `IframelyServerNode`). The static renderer uses this
 * `renderHTML` directly (no nodeMapping override), emitting a native
 * `<details class="details"><summary>…` that toggles with zero JS and is styled
 * by the shared `.details` CSS in `@op/styles`. Content models mirror
 * `@tiptap/extension-details`; `open` mirrors the editor's `persist: true` attr.
 */
const DetailsServerNode = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: ({ open }) => (open ? { open: '' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    // `class: 'details'` so the shared `.details` CSS (in @op/styles) styles the
    // native viewer <details> the same way it styles the editor node view.
    return [
      'details',
      mergeAttributes(HTMLAttributes, { class: 'details' }),
      0,
    ];
  },
});

const DetailsSummaryServerNode = Node.create({
  name: 'detailsSummary',
  content: 'text*',

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0];
  },
});

const DetailsContentServerNode = Node.create({
  name: 'detailsContent',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-type="detailsContent"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'detailsContent' }),
      0,
    ];
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
  // The shared base (`tiptapBase.ts`) is the same set the live editors build
  // on, so the schema here can't drift from what the editor can produce.
  ...buildSharedTiptapBase(),
  IframelyServerNode,
  DetailsServerNode,
  DetailsSummaryServerNode,
  DetailsContentServerNode,
];
