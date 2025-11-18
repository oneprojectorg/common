import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

import { IframelyExtension } from '../decisions/IframelyExtension';
import { SlashCommands } from '../decisions/SlashCommands';

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
  IframelyExtension,
];

export const getEditorExtensions = () => {
  return [
    ...baseExtensions,
    Link.configure({
      openOnClick: false,
      linkOnPaste: false, // Disable auto-linking on paste to let Iframely extension handle it
    }),
    SlashCommands,
  ];
};

export const getViewerExtensions = () => {
  return [
    ...baseExtensions,
    Link.configure({
      openOnClick: true, // Allow clicking links in view mode
    }),
  ];
};
