/**
 * App-specific editor extensions that build on @op/ui's base config.
 *
 * This file adds proposal-specific extensions (SlashCommands, IframelyExtension)
 * while reusing the shared base extensions from @op/ui.
 */
import { defaultEditorExtensions } from '@op/ui/RichTextEditor';
import Link from '@tiptap/extension-link';
import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { IframelyExtension } from '../decisions/IframelyExtension';
import { SlashCommands } from '../decisions/SlashCommands';

/**
 * Get base editor extensions for the app.
 * These are the @op/ui defaults without StarterKit (to allow custom config).
 */
function getBaseExtensions(): AnyExtension[] {
  // Filter out StarterKit from defaults - we configure it ourselves
  return defaultEditorExtensions.filter(
    (ext) => ext.name !== 'starterKit',
  ) as AnyExtension[];
}

export interface EditorExtensionOptions {
  /** Enable slash commands (default: true for proposals) */
  slashCommands?: boolean;
  /** Enable link embeds via Iframely (default: true for proposals) */
  linkEmbeds?: boolean;
  /** Enable collaboration - disables local undo/redo (default: false) */
  collaborative?: boolean;
}

/**
 * Get editor extensions for proposal editing.
 *
 * @param options - Configuration for which extensions to include
 * @returns Array of TipTap extensions
 *
 * @example
 * ```tsx
 * // Standard proposal editor (local)
 * const extensions = getProposalExtensions();
 *
 * // Collaborative proposal editor
 * const extensions = getProposalExtensions({ collaborative: true });
 *
 * // Minimal editor without slash commands
 * const extensions = getProposalExtensions({ slashCommands: false });
 * ```
 */
export function getProposalExtensions(
  options: EditorExtensionOptions = {},
): AnyExtension[] {
  const {
    slashCommands = true,
    linkEmbeds = true,
    collaborative = false,
  } = options;

  const extensions: AnyExtension[] = [
    // StarterKit with conditional history management
    StarterKit.configure({
      // Disable built-in undo/redo when using Yjs collaboration
      // (Yjs handles its own history)
      undoRedo: collaborative ? false : undefined,
    }),
    ...getBaseExtensions(),
    // Override Link config for proposal editing
    Link.configure({
      openOnClick: false,
      linkOnPaste: false, // Let Iframely handle URL pastes
    }),
  ];

  // Add optional proposal-specific extensions
  if (linkEmbeds) {
    extensions.push(IframelyExtension as AnyExtension);
  }

  if (slashCommands) {
    extensions.push(SlashCommands);
  }

  return extensions;
}

/**
 * Get viewer extensions for displaying proposal content (read-only).
 */
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
