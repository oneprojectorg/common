'use client';

import { Field, FieldDescription, FieldTitle } from '@op/sense/Field';
import { InputGroup, InputGroupAddon } from '@op/sense/InputGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import type { Editor } from '@tiptap/react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  RichTextEditorBubbleMenu,
  getProposalExtensions,
} from '../RichTextEditor';
import { CharacterCounter } from './CharacterCounter';
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
 * Collaborative text field backed by TipTap + Yjs, presented as a labelled
 * sense `Field` whose control sits in a bordered `InputGroup` with the
 * character counter pinned inside the box (bottom-end).
 *
 * The editable is a contenteditable, so the label is associated with
 * `aria-labelledby` rather than `htmlFor` — a contenteditable is not a labelable
 * element and a `<label for>` pointing at one is an orphan label.
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
  // Held in state (not a ref) so the bubble menu renders once the editor exists.
  const [editor, setEditor] = useState<Editor | null>(null);
  const labelId = useId();
  const descriptionId = useId();
  const counterId = useId();

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
    setEditor(editor);
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

  const describedBy =
    [description ? descriptionId : null, maxLength != null ? counterId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <Field data-testid={`field-${fragmentName}`}>
      {title && (
        <FieldTitle id={labelId}>
          {title}
          {required && <RequiredAsterisk />}
        </FieldTitle>
      )}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {/* focus-within, not InputGroup's has-[input:focus-visible] rules: the
          control is a contenteditable, not an <input>. The editable's own ring
          is switched off so only the box lights up. */}
      <InputGroup className="h-auto flex-col items-stretch focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <CollaborativeEditor
          field={fragmentName}
          extensions={extensions}
          placeholder={placeholder ?? t('Start typing...')}
          onEditorReady={handleEditorReady}
          className="w-full"
          editorClassName={`px-3 py-2.5 focus-visible:ring-0 ${multiline ? 'min-h-32' : 'min-h-8'}`}
          required={required}
          ariaLabelledBy={title ? labelId : undefined}
          ariaDescribedBy={describedBy}
        />
        {/* Formatting lives on the selection rather than in a toolbar above the
            form. Every prose field owns its own menu, so the pluginKey has to be
            unique per field or TipTap's plugins collide. */}
        <RichTextEditorBubbleMenu
          editor={editor}
          pluginKey={`proposalField-${fragmentName}`}
        />
        {maxLength != null && (
          <InputGroupAddon align="block-end" className="justify-end">
            <CharacterCounter
              id={counterId}
              count={charCount}
              max={maxLength}
            />
          </InputGroupAddon>
        )}
      </InputGroup>
    </Field>
  );
}
