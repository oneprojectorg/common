'use client';

import { Field, FieldTitle } from '@op/sense/Field';
import { InputGroup, InputGroupAddon } from '@op/sense/InputGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Skeleton } from '@op/sense/Skeleton';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CharacterCounter } from './CharacterCounter';
import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeTitleFieldProps {
  /** Visible field label. Falls back to "Proposal name". */
  title?: string;
  /** Renders the asterisk and sets `aria-required` on the editable region. */
  required?: boolean;
  placeholder?: string;
  /**
   * When set, renders a live counter inside the input. Not enforced on input —
   * the limit is enforced by schema validation on submit, same as every other
   * proposal field.
   */
  maxLength?: number;
  onChange?: (text: string) => void;
}

/**
 * A collaborative plain text field for the proposal title, presented as a
 * labelled single-line input (sense `Field` + `InputGroup`) with the character
 * counter inside the control box.
 *
 * The control is a TipTap contenteditable rather than an `<input>` because the
 * value is Yjs-backed — which is why the label is wired with `aria-labelledby`
 * instead of `htmlFor` (a contenteditable is not a labelable element).
 */
export function CollaborativeTitleField({
  title,
  required = false,
  placeholder,
  maxLength,
  onChange,
}: CollaborativeTitleFieldProps) {
  const t = useTranslations();
  const { ydoc, provider, user } = useCollaborativeDoc();
  const resolvedPlaceholder = placeholder ?? t('Untitled proposal');
  const labelId = useId();
  const counterId = useId();
  const [charCount, setCharCount] = useState(0);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Build collaborative extensions for the title field
  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({
        placeholder: resolvedPlaceholder,
        emptyEditorClass:
          'before:pointer-events-none before:float-start before:h-0 before:text-muted-foreground before:content-[attr(data-placeholder)]',
      }),
      Collaboration.configure({
        document: ydoc,
        field: 'title',
      }),
      CollaborationCaret.configure({
        provider,
        user,
      }),
    ],
    [ydoc, provider, user, resolvedPlaceholder],
  );

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class:
          'w-full border-0 bg-transparent p-0 text-base text-foreground outline-none [unicode-bidi:plaintext]',
        // `role="textbox"` is required before any of these are legal on a
        // contenteditable div: a generic element may not carry an accessible name
        // or `aria-required`. Single-line, so `aria-multiline` is false — Enter is
        // swallowed in handleKeyDown below.
        role: 'textbox',
        'aria-multiline': 'false',
        'aria-labelledby': labelId,
        ...(maxLength != null ? { 'aria-describedby': counterId } : {}),
        ...(required ? { 'aria-required': 'true' } : {}),
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter') {
          return true;
        }
        return false;
      },
      // Enforce the template's limit on local input only. A `filterTransaction`
      // would be tidier but also sees transactions Yjs applies for remote peers,
      // and rejecting one of those desyncs the shared document.
      handleTextInput: (view, from, to, text) => {
        if (maxLength == null) {
          return false;
        }

        const next =
          view.state.doc.textContent.length - (to - from) + text.length;
        return next > maxLength;
      },
      handlePaste: (view, _event, slice) => {
        if (maxLength == null) {
          return false;
        }

        const { from, to } = view.state.selection;
        const room =
          maxLength - (view.state.doc.textContent.length - (to - from));
        const pasted = slice.content.textBetween(
          0,
          slice.content.size,
          ' ',
          ' ',
        );

        if (pasted.length <= room) {
          return false;
        }

        // Truncate rather than reject: pasting a too-long title and getting
        // nothing at all reads as a broken field.
        if (room > 0) {
          view.dispatch(
            view.state.tr.insertText(pasted.slice(0, room), from, to),
          );
        }

        return true;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    // Seed the counter from whatever the shared doc already holds, without
    // emitting onChange — the draft must not look dirty just from mounting.
    setCharCount(editor.getText().trim().length);

    const handleUpdate = () => {
      const plainText = editor.getText().trim();
      setCharCount(plainText.length);
      onChangeRef.current?.(plainText);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  return (
    <Field data-testid="field-title">
      <FieldTitle id={labelId}>
        {title ?? t('Proposal name')}
        {required && <RequiredAsterisk />}
      </FieldTitle>
      {editor ? (
        // focus-within rather than InputGroup's own has-[input:focus-visible]
        // rules: the control here is a contenteditable, not an <input>.
        // `h-auto`: InputGroup is a fixed 44px row and only relaxes for a real
        // `<textarea>` (`has-[>textarea]:h-auto`), which a contenteditable does
        // not match — so a wrapped title spilled out of its own border.
        <InputGroup className="h-auto min-h-11 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <EditorContent
            className="min-w-0 flex-1 px-3 py-2.5"
            dir={editor.isEmpty ? undefined : 'auto'}
            editor={editor}
          />
          {maxLength != null && (
            // A counter beside a field that wraps would reserve its column on
            // every line, narrowing the text for the whole height. Figma puts
            // the counter for a wrapping field in a block addon under it
            // (`InputGroup / Addon Block`, space-between) and keeps the inline
            // placement for single-line inputs only.
            <InputGroupAddon align="block-end" className="justify-end">
              <CharacterCounter
                id={counterId}
                count={charCount}
                max={maxLength}
              />
            </InputGroupAddon>
          )}
        </InputGroup>
      ) : (
        <Skeleton className="h-11 w-full rounded-lg" />
      )}
    </Field>
  );
}
