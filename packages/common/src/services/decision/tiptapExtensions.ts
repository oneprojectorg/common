import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

import { IframelyNode } from './iframelyNode';

/**
 * Server-side TipTap extensions for `generateHTML()`.
 *
 * These must match the editor/viewer extensions exactly (minus React-specific parts)
 * to ensure all node types are recognized during HTML generation. Any node type
 * present in the ProseMirror JSON that isn't registered here will throw a
 * `RangeError("Unknown node type: ...")` and cause the entire fragment to fail.
 *
 * The `IframelyNode` is the shared schema-only base also used by the client
 * extension (`apps/app/.../IframelyExtension.tsx`), ensuring the server and
 * client schemas stay in sync.
 *
 * @see packages/ui/src/components/RichTextEditor/editorConfig.ts (client base extensions)
 * @see apps/app/src/components/decisions/IframelyExtension.tsx (client Iframely extension)
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
  IframelyNode,
];
