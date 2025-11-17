import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

export const baseEditorStyles =
  'overflow-wrap-anywhere prose prose-lg max-w-none break-words !text-base text-neutral-black placeholder:text-neutral-gray2 focus:outline-none [&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline [&_li_p]:my-0';

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
  Heading.configure({
    levels: [1, 2, 3],
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
