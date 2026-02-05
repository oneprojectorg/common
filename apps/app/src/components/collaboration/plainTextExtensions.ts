import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

/**
 * Minimal TipTap extensions for plain text editing.
 * Uses StarterKit with all formatting disabled - just basic text entry
 * with collaboration support (cursor sync, no flickering).
 */
export function getPlainTextExtensions(
  options: { collaborative?: boolean } = {},
): AnyExtension[] {
  const { collaborative = true } = options;

  return [
    StarterKit.configure({
      // Disable undo/redo for collaborative mode (Yjs handles it)
      undoRedo: collaborative ? false : undefined,
      // Disable all formatting
      bold: false,
      italic: false,
      strike: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      heading: false,
      horizontalRule: false,
      hardBreak: false,
      // Keep basic text structure
      document: undefined, // keep
      paragraph: undefined, // keep
      text: undefined, // keep
    }),
  ];
}
