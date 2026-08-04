'use client';

import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { cn } from '@op/sense/lib/utils';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getProposalExtensions } from '../RichTextEditor';
import { CollaborativeEditor } from './CollaborativeEditor';

/**
 * Props for the collaborative text field.
 *
 * @param fragmentName - Yjs fragment name (required). Each field in the
 *   proposal schema maps to a unique fragment in the shared Y.Doc.
 * @param title - Optional label rendered above the editor.
 * @param required - When true, renders a red asterisk next to the title.
 * @param description - Optional description rendered below the title.
 * @param placeholder - Placeholder text shown when the editor is empty.
 * @param multiline - When true, renders a taller editor suitable for long text.
 * @param maxLength - Optional character limit shown in the editor UI.
 * @param onChange - Called with the editor's HTML content on every update.
 * @param onEditorFocus - Called with the editor instance when it gains focus.
 * @param onEditorBlur - Called with the editor instance when it loses focus.
 */
interface CollaborativeTextFieldProps {
  fragmentName: string;
  title?: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  onChange?: (html: string) => void;
  onEditorFocus?: (editor: Editor) => void;
  onEditorBlur?: (editor: Editor) => void;
}

/**
 * Collaborative text field backed by TipTap + Yjs.
 *
 * Composes {@link CollaborativeEditor} so we get consistent editor setup,
 * styled content, and Yjs collaboration/snapshotting for free.
 */
export function CollaborativeTextField({
  fragmentName,
  title,
  required,
  description,
  placeholder,
  multiline = false,
  maxLength,
  onChange,
  onEditorFocus,
  onEditorBlur,
}: CollaborativeTextFieldProps) {
  const t = useTranslations();
  const [charCount, setCharCount] = useState(0);

  // No Placeholder extension here — useRichTextEditor registers one from the
  // `placeholder` prop below; adding our own would duplicate the extension.
  const extensions = useMemo(
    () => getProposalExtensions({ collaborative: true }),
    [],
  );

  // Stable refs so the onEditorReady callback doesn't re-trigger on identity changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onEditorFocusRef = useRef(onEditorFocus);
  onEditorFocusRef.current = onEditorFocus;

  const onEditorBlurRef = useRef(onEditorBlur);
  onEditorBlurRef.current = onEditorBlur;

  const handleEditorReady = useCallback((editor: Editor) => {
    setCharCount(editor.getText().length);

    editor.on('update', () => {
      setCharCount(editor.getText().length);
      onChangeRef.current?.(editor.getHTML());
    });
    editor.on('focus', () => {
      onEditorFocusRef.current?.(editor);
    });
    editor.on('blur', () => {
      onEditorBlurRef.current?.(editor);
    });
  }, []);

  return (
    <div data-testid={`field-${fragmentName}`} className="flex flex-col gap-4">
      {(title || description) && (
        <div className="flex flex-col gap-2">
          {title && (
            <span className="font-serif text-title-sm14 text-foreground">
              {title}
              {required && <RequiredAsterisk />}
            </span>
          )}
          {description && (
            <p className="text-sm text-foreground">{description}</p>
          )}
        </div>
      )}
      <CollaborativeEditor
        field={fragmentName}
        extensions={extensions}
        placeholder={placeholder ?? t('Start typing...')}
        onEditorReady={handleEditorReady}
        editorClassName={multiline ? 'min-h-32' : 'min-h-8'}
        required={required}
      />
      {maxLength != null && (
        <div className="flex justify-end">
          <span
            className={cn(
              'text-sm text-muted-foreground',
              charCount >= maxLength && 'text-destructive',
            )}
          >
            {charCount}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
}
