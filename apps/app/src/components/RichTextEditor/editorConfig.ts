import { defaultEditorExtensions } from '@op/ui/RichTextEditor';
import Link from '@tiptap/extension-link';
import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { IframelyExtension } from '../decisions/IframelyExtension';
import { SlashCommands } from '../decisions/SlashCommands';

/** Base extensions from @op/ui, minus StarterKit (we configure it ourselves) */
function getBaseExtensions(): AnyExtension[] {
  return defaultEditorExtensions.filter(
    (ext) => ext.name !== 'starterKit',
  ) as AnyExtension[];
}

export interface EditorExtensionOptions {
  slashCommands?: boolean;
  linkEmbeds?: boolean;
  /** Disables local undo/redo for Yjs collaboration */
  collaborative?: boolean;
}

/** Editor extensions for proposal editing */
export function getProposalExtensions(
  options: EditorExtensionOptions = {},
): AnyExtension[] {
  const {
    slashCommands = true,
    linkEmbeds = true,
    collaborative = false,
  } = options;

  const extensions: AnyExtension[] = [
    StarterKit.configure({
      undoRedo: collaborative ? false : undefined,
    }),
    ...getBaseExtensions(),
    Link.configure({
      openOnClick: false,
      linkOnPaste: false, // Disable auto-linking on paste to let Iframely extension handle it
    }),
  ];

  if (linkEmbeds) {
    extensions.push(IframelyExtension as AnyExtension);
  }
  if (slashCommands) {
    extensions.push(SlashCommands);
  }

  return extensions;
}

/** Viewer extensions for read-only proposal display */
export function getViewerExtensions(): AnyExtension[] {
  return [
    StarterKit,
    ...getBaseExtensions(),
    Link.configure({
      openOnClick: true,
    }),
    IframelyExtension as AnyExtension,
  ];
}
