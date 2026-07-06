import { buildBaseExtensions } from '@op/ui/RichTextEditor';
import type { AnyExtension } from '@tiptap/react';

import { IframelyExtension } from '../decisions/IframelyExtension';
import { SlashCommands } from '../decisions/SlashCommands';

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

  const extensions: AnyExtension[] = buildBaseExtensions({
    collaborative,
    link: {
      openOnClick: false,
      linkOnPaste: false, // Disable auto-linking on paste to let Iframely extension handle it
    },
  });

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
    ...buildBaseExtensions({ link: { openOnClick: true } }),
    IframelyExtension as AnyExtension,
  ];
}
