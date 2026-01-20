'use client';

import { type CollabStatus, useTiptapCollab } from '@/hooks/useTiptapCollab';
import {
  type RichTextEditorRef,
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Collaboration from '@tiptap/extension-collaboration';
import type { Editor, Extensions } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';

export interface CollaborativeEditorRef extends RichTextEditorRef {
  /** Current collaboration connection status */
  collabStatus: CollabStatus;
  /** Whether the document is synced with the server */
  isSynced: boolean;
}

export interface CollaborativeEditorProps {
  /**
   * Unique document identifier for collaboration.
   * Format recommendation: `{entity}-{parentId}-{docId}`
   * Example: `proposal-instance123-proposal456`
   */
  docId: string;
  /**
   * Additional extensions to include beyond the base set.
   * Collaboration extension is added automatically.
   */
  extensions?: Extensions;
  /** Initial content (only used if doc is empty on server) */
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  /** Called when collaboration status changes */
  onCollabStatusChange?: (status: CollabStatus, isSynced: boolean) => void;
  className?: string;
  editorClassName?: string;
}

/**
 * Rich text editor with real-time collaboration via TipTap Cloud.
 *
 * Wraps the base RichTextEditor and adds:
 * - Y.js document sync via TipTap Cloud
 * - Collaboration extension (disables local undo/redo)
 * - Connection status tracking
 *
 * @example
 * ```tsx
 * <CollaborativeEditor
 *   docId="proposal-123-456"
 *   extensions={[SlashCommands, IframelyExtension]}
 *   onUpdate={setContent}
 * />
 * ```
 */
export const CollaborativeEditor = forwardRef<
  CollaborativeEditorRef,
  CollaborativeEditorProps
>(
  (
    {
      docId,
      extensions = [],
      content = '',
      placeholder = 'Start writing...',
      onUpdate,
      onChange,
      onEditorReady,
      onCollabStatusChange,
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    // Initialize collaboration provider
    const { ydoc, status, isSynced } = useTiptapCollab({
      docId,
      enabled: true,
    });

    // Build extensions with collaboration
    const collaborativeExtensions = useMemo(() => {
      return [
        ...extensions,
        Collaboration.configure({
          document: ydoc,
        }),
      ];
    }, [extensions, ydoc]);

    // Use the base editor hook with collaborative extensions
    const editor = useRichTextEditor({
      extensions: collaborativeExtensions,
      content,
      editorClassName,
      onUpdate,
      onChange,
      onEditorReady,
    });

    // Notify parent of status changes
    useEffect(() => {
      onCollabStatusChange?.(status, isSynced);
    }, [status, isSynced, onCollabStatusChange]);

    // Expose editor methods + collab status through ref
    useImperativeHandle(
      ref,
      () => ({
        getHTML: () => editor?.getHTML() || '',
        setContent: (newContent: string) =>
          editor?.commands.setContent(newContent),
        focus: () => editor?.commands.focus(),
        blur: () => editor?.commands.blur(),
        isEmpty: () => editor?.isEmpty || false,
        clear: () => editor?.commands.clearContent(),
        editor,
        collabStatus: status,
        isSynced,
      }),
      [editor, status, isSynced],
    );

    if (!editor) {
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <div className={className}>
        <StyledRichTextContent editor={editor} placeholder={placeholder} />
      </div>
    );
  },
);

CollaborativeEditor.displayName = 'CollaborativeEditor';

/**
 * Props for choosing between collaborative and local editor.
 * Use this when you need to conditionally enable collaboration.
 */
export interface EditorModeProps {
  /** When provided, enables collaboration mode */
  collabDocId?: string | null;
}

/**
 * Helper to determine if collaboration should be used.
 */
export function useEditorMode({ collabDocId }: EditorModeProps) {
  return {
    isCollaborative: Boolean(collabDocId),
    docId: collabDocId,
  };
}
