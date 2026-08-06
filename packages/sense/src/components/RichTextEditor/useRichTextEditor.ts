import type { JSONContent } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import type { Content, Editor, Extensions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';

import { cn } from '../../lib/utils';
import { defaultEditorExtensions } from './editorConfig';
import { baseEditorStyles } from './viewerStyles';

export function useRichTextEditor({
  extensions = defaultEditorExtensions,
  content = '',
  placeholder,
  summaryPlaceholder = 'Write something...',
  editorClassName = '',
  onUpdate,
  onChange,
  onChangeJSON,
  onEditorReady,
  editable = true,
  required = false,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaMultiline = true,
}: {
  extensions?: Extensions;
  content?: Content;
  placeholder?: string;
  /**
   * Hint shown inside an empty Details summary. Only takes effect when the
   * Details extension is present. Defaults to 'Write something...' rather than
   * 'Summary': "Summary" reads as jargon to writers who don't know the
   * underlying <summary> HTML tag. Pass a translated string from the app to
   * localize it.
   */
  summaryPlaceholder?: string;
  editorClassName?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  /** Emits the editor's JSON doc on every update (for JSON-stored content). */
  onChangeJSON?: (content: JSONContent) => void;
  onEditorReady?: (editor: Editor) => void;
  editable?: boolean;
  /** When true, sets `aria-required` on the editable region for assistive tech. */
  required?: boolean;
  /**
   * Id of the labelling element — `<label for>` can't reach a contenteditable.
   */
  ariaLabelledBy?: string;
  /**
   * Id(s) of elements describing the editable region (helper text, character
   * counter). Space-separated, same as the native attribute.
   */
  ariaDescribedBy?: string;
  /**
   * Sets `aria-multiline`. Pass false for a single-line editable.
   */
  ariaMultiline?: boolean;
}) {
  // Append a single Placeholder extension when a top-level placeholder is asked
  // for OR the Details extension is present (it needs a per-node 'Summary' hint).
  // There can only be one Placeholder extension — tiptap dedupes by name — so it
  // serves both cases via the function form: the editor-empty hint comes from
  // `placeholder`, the empty Details summary from `summaryPlaceholder`. Styling
  // lives in baseEditorStyles (`placeholderStyles` + `detailsSummaryPlaceholderStyles`).
  const resolvedExtensions = useMemo(() => {
    const hasDetails = extensions.some((ext) => ext.name === 'detailsSummary');

    if (!placeholder && !hasDetails) {
      return extensions;
    }

    return [
      ...extensions,
      Placeholder.configure({
        includeChildren: true,
        // Show empty-node placeholders even when the caret isn't in the node, so
        // the Details summary's "Summary" hint stays visible while unfocused.
        // Safe: only `summary.is-empty` and `.is-editor-empty:first-child` are
        // painted in CSS, so other empty blocks don't get a per-block hint.
        showOnlyCurrent: false,
        placeholder: ({ node }) => {
          if (node.type.name === 'detailsSummary') {
            return summaryPlaceholder;
          }

          return placeholder ?? '';
        },
      }),
    ];
  }, [extensions, placeholder, summaryPlaceholder]);

  const editor = useEditor({
    extensions: resolvedExtensions,
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          baseEditorStyles,
          editorClassName || (editable ? 'min-h-96' : ''),
        ),
        // `role="textbox"` is what makes the aria attributes below legal on a
        // contenteditable div. Editable only — a viewer is prose, not an input.
        ...(editable
          ? {
              role: 'textbox',
              'aria-multiline': ariaMultiline ? 'true' : 'false',
              ...(required ? { 'aria-required': 'true' } : {}),
              ...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {}),
              ...(ariaDescribedBy
                ? { 'aria-describedby': ariaDescribedBy }
                : {}),
            }
          : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
      onChange?.(html);
      onChangeJSON?.(editor.getJSON());
    },
    immediatelyRender: false,
  });

  // Set initial content only once when editor is first created
  useEffect(() => {
    if (editor && content) {
      const currentContent = editor.getHTML();
      if (currentContent === '' || currentContent === '<p></p>') {
        editor.commands.setContent(content);
      }
    }
  }, [editor]); // Only run when editor is ready, not on content changes

  // Readonly viewers reuse one editor instance, so sync incoming content when
  // the selected preview version changes.
  //
  // `undefined` means the document is owned elsewhere (a Yjs binding), where
  // clearing would wipe it for every client. Pass `null` to blank a viewer.
  useEffect(() => {
    if (!editor || editable || content === undefined) {
      return;
    }

    if (!content) {
      editor.commands.clearContent();
      return;
    }

    editor.commands.setContent(content);
  }, [content, editable, editor]);

  // Notify parent once, when the editor transitions from null to live. The
  // callback rides a ref so an inline-arrow `onEditorReady` (new identity each
  // render) doesn't re-fire this one-shot init on every parent re-render.
  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  });
  useEffect(() => {
    if (editor) {
      onEditorReadyRef.current?.(editor);
    }
  }, [editor]);

  return editor;
}
