'use client';

import Placeholder from '@tiptap/extension-placeholder';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo, useRef } from 'react';

import { getProposalExtensions } from '../RichTextEditor';
import { CollaborativeEditor } from './CollaborativeEditor';

/**
 * Props for the collaborative text field.
 *
 * @param fragmentName - Yjs fragment name (required). Each field in the
 *   proposal schema maps to a unique fragment in the shared Y.Doc.
 * @param title - Optional label rendered above the editor.
 * @param description - Optional description rendered below the title.
 * @param placeholder - Placeholder text shown when the editor is empty.
 * @param multiline - When true, renders a taller editor suitable for long text.
 * @param onChange - Called with the editor's HTML content on every update.
 */
interface CollaborativeTextFieldProps {
  fragmentName: string;
  title?: string;
  description?: string;
  placeholder?: string;
  multiline?: boolean;
  onChange?: (html: string) => void;
}

/**
 * Collaborative text field backed by TipTap + Yjs.
 *
 * Composes {@link CollaborativeEditor} so we get consistent editor setup,
 * styled content, and Yjs collaboration/snapshotting for free.
 *
 * Future `x-format-options` from the template schema are forwarded as
 * direct props, so adding new knobs (e.g. `rich`, `maxWords`) only
 * requires extending the props interface.
 */
export function CollaborativeTextField({
  fragmentName,
  title,
  description,
  placeholder = 'Start typing...',
  multiline = false,
  onChange,
}: CollaborativeTextFieldProps) {
  const extensions = useMemo(
    () => [
      ...getProposalExtensions({ collaborative: true }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-neutral-gray3 before:float-left before:h-0 before:pointer-events-none',
      }),
    ],
    [placeholder],
  );

  // Stable ref so the onEditorReady callback doesn't re-trigger on onChange identity changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleEditorReady = useCallback((editor: Editor) => {
    const handleUpdate = () => {
      onChangeRef.current?.(editor.getHTML());
    };
    editor.on('update', handleUpdate);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {(title || description) && (
        <div className="flex flex-col gap-0.5">
          {title && (
            <span className="font-serif text-title-sm text-neutral-charcoal">
              {title}
            </span>
          )}
          {description && (
            <p className="text-body-sm text-neutral-charcoal">{description}</p>
          )}
        </div>
      )}
      <CollaborativeEditor
        field={fragmentName}
        extensions={extensions}
        placeholder={placeholder}
        onEditorReady={handleEditorReady}
        editorClassName={multiline ? 'min-h-32' : 'min-h-8'}
      />
    </div>
  );
}
