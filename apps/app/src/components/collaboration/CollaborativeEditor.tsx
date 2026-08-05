'use client';

import type { CollabStatus } from '@/hooks/useTiptapCollab';
import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/sense/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type { Editor, Extensions } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

export interface CollaborativeEditorRef {
  editor: Editor | null;
  collabStatus: CollabStatus;
  isSynced: boolean;
}

export interface CollaborativeEditorProps {
  /** The Yjs field name to bind to (defaults to 'default' for main content) */
  field?: string;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
  /**
   * When false the editor renders the live collaborative document but refuses
   * edits. Content stays scrollable and selectable — no `content` is passed, so
   * the Yjs binding remains the only writer of the document.
   */
  editable?: boolean;
  /** When true, sets `aria-required` on the editable region for assistive tech. */
  required?: boolean;
  /**
   * Id of the visible field label. A contenteditable can't be reached by
   * `<label for>`, so the label is wired by id instead.
   */
  ariaLabelledBy?: string;
  /** Id(s) of describing elements (helper text, character counter). */
  ariaDescribedBy?: string;
}

/** Rich text editor with real-time collaboration via TipTap Cloud */
export const CollaborativeEditor = forwardRef<
  CollaborativeEditorRef,
  CollaborativeEditorProps
>(
  (
    {
      field = 'default',
      extensions = [],
      placeholder,
      onEditorReady,
      className = '',
      editorClassName = '',
      editable = true,
      required = false,
      ariaLabelledBy,
      ariaDescribedBy,
    },
    ref,
  ) => {
    const t = useTranslations();
    const { ydoc, provider, status, isSynced, user } = useCollaborativeDoc();
    const resolvedPlaceholder = placeholder ?? t('Start writing...');

    // Build collaborative extensions with cursor support
    const collaborativeExtensions = useMemo(
      () => [
        ...extensions,
        Collaboration.configure({ document: ydoc, field }),
        CollaborationCaret.configure({
          provider,
          user,
        }),
        Snapshot.configure({ provider }),
      ],
      [extensions, ydoc, field, provider, user],
    );

    const editor = useRichTextEditor({
      extensions: collaborativeExtensions,
      // The placeholder belongs on the hook: it registers the single TipTap
      // Placeholder extension that paints it. Passing it to
      // StyledRichTextContent (as this file used to) only set a dead
      // `placeholder` attribute on the wrapper div.
      placeholder: resolvedPlaceholder,
      editorClassName,
      onEditorReady,
      editable,
      required,
      ariaLabelledBy,
      ariaDescribedBy,
    });

    // `useEditor` only honours `editable` when it creates the instance: on every
    // later render it re-applies options with `editable: editor.isEditable`, so a
    // changed prop is dropped. Flip it explicitly instead. This touches nothing
    // but the edit flag — the Yjs binding and document are untouched.
    //
    // `emitUpdate: false` matters: the document did not change, and a synthetic
    // `update` would run every field's onChange and dirty the draft just from
    // opening the panel.
    useEffect(() => {
      if (editor && editor.isEditable !== editable) {
        editor.setEditable(editable, false);
      }
    }, [editor, editable]);

    useImperativeHandle(
      ref,
      () => ({
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
        <StyledRichTextContent
          dir={editor?.isEmpty ? undefined : 'auto'}
          editor={editor}
        />
      </div>
    );
  },
);

CollaborativeEditor.displayName = 'CollaborativeEditor';
