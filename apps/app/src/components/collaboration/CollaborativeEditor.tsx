'use client';

import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/sense/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type { Editor, Extensions } from '@tiptap/react';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

export interface CollaborativeEditorProps {
  /** The Yjs field name to bind to (defaults to 'default' for main content) */
  field?: string;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
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
export const CollaborativeEditor = ({
  field = 'default',
  extensions = [],
  placeholder,
  onEditorReady,
  className = '',
  editorClassName = '',
  required = false,
  ariaLabelledBy,
  ariaDescribedBy,
}: CollaborativeEditorProps) => {
  const t = useTranslations();
  const { ydoc, provider, user } = useCollaborativeDoc();
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
    required,
    ariaLabelledBy,
    ariaDescribedBy,
  });

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
};
