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
   * Caps the title and renders a live counter. Enforced on local input only —
   * typing past it is rejected and a paste is truncated; remote Yjs edits are
   * never rejected (that would desync the document), so the API schema carries
   * the same cap.
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
        // `role="textbox"` first: the aria attributes below are illegal on a
        // generic element. Enter is swallowed in handleKeyDown.
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
      // Local input only — `filterTransaction` would also reject the
      // transactions Yjs applies for remote peers, desyncing the document.
      handleTextInput: (view, from, to, text) => {
        if (maxLength == null) {
          return false;
        }

        const current = view.state.doc.textContent.length;
        const next = current - (to - from) + text.length;

        // Block only what would exceed the cap *and* grow the title. A title
        // already over it (restored from a version predating the cap) would
        // otherwise refuse every keystroke, including typing over a selection
        // to shorten it — leaving no way to fix it but backspace.
        return next > maxLength && next > current;
      },
      // Always handled, never deferred to the default: this is a single-value
      // field, so a pasted paragraph break has to become a space rather than a
      // second block — `getText()` would otherwise join them with a newline and
      // put it in the profile's name. Truncating beats rejecting the paste.
      handlePaste: (view, _event, slice) => {
        const { from, to } = view.state.selection;
        // Collapse whitespace runs (a pasted newline becomes a space) but keep
        // the edges — trimming would eat the leading space when appending.
        const pasted = slice.content
          .textBetween(0, slice.content.size, ' ', ' ')
          .replace(/\s+/g, ' ');

        if (!pasted) {
          return true;
        }

        if (maxLength == null) {
          view.dispatch(view.state.tr.insertText(pasted, from, to));
          return true;
        }

        const room =
          maxLength - (view.state.doc.textContent.length - (to - from));

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

    // Untrimmed, matching what `handleTextInput` enforces — a counter that
    // ignores trailing spaces reads "197/200" while typing is already blocked.
    // The value emitted to the draft stays trimmed.
    setCharCount(editor.getText().length);

    const handleUpdate = () => {
      const text = editor.getText();
      setCharCount(text.length);
      onChangeRef.current?.(text.trim());
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
        // focus-within and h-auto: the control is a contenteditable, so
        // InputGroup's `<input>`/`<textarea>` rules never fire for it.
        <InputGroup className="h-auto min-h-11 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <EditorContent
            className="min-w-0 flex-1 px-3 py-2.5"
            dir={editor.isEmpty ? undefined : 'auto'}
            editor={editor}
          />
          {maxLength != null && (
            // Beside the field, as Figma has it (17950:11356): the title is a
            // single line, so the counter costs no room. Block addons are for
            // the wrapping prose fields.
            //
            // `self-end` opts out of the group's `items-center` so the counter
            // tracks the last line when 50 characters wrap at a narrow width;
            // `py-2.5` matches the editor's padding, aligning the two baselines.
            <InputGroupAddon align="inline-end" className="self-end py-3">
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
