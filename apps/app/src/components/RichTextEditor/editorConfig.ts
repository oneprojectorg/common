import Blockquote from '@tiptap/extension-blockquote';
import Collaboration from '@tiptap/extension-collaboration';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Doc } from 'yjs';

import { IframelyExtension } from '../decisions/IframelyExtension';
import { SlashCommands } from '../decisions/SlashCommands';

const baseExtensions: AnyExtension[] = [
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
  // IframelyExtension uses older tiptap types, cast to satisfy mixed versions
  IframelyExtension as AnyExtension,
];

/**
 * Get editor extensions for the proposal editor.
 *
 * @param ydoc - Optional Y.Doc for collaboration. When provided, enables real-time sync.
 */
export const getEditorExtensions = (ydoc?: Doc): AnyExtension[] => {
  const extensions: AnyExtension[] = [
    // StarterKit must be configured differently when using Collaboration
    // to avoid conflicts with history management
    StarterKit.configure({
      undoRedo: ydoc ? false : undefined, // Disable undo/redo when collaborating
    }),
    ...baseExtensions,
    Link.configure({
      openOnClick: false,
      linkOnPaste: false, // Disable auto-linking on paste to let Iframely extension handle it
    }),
    SlashCommands,
  ];

  // Add Collaboration extension when ydoc is provided
  if (ydoc) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
      }) as AnyExtension,
    );
  }

  return extensions;
};

export const getViewerExtensions = () => {
  return [
    ...baseExtensions,
    Link.configure({
      openOnClick: true, // Allow clicking links in view mode
    }),
  ];
};
