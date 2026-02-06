'use client';

import { Skeleton } from '@op/ui/Skeleton';
import type { WidgetProps } from '@rjsf/utils';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';

import { getProposalExtensions } from '../RichTextEditor';
import { useCollaborativeDoc } from './CollaborativeDocContext';

/**
 * RJSF widget for collaborative short (plain) text fields.
 * Renders a TipTap editor bound to a named Y.Doc fragment,
 * pulling the shared ydoc/provider from CollaborativeDocProvider context.
 */
export function CollaborativeShortTextWidget(props: WidgetProps) {
  const { onChange, schema, uiSchema, rawErrors } = props;
  const { ydoc, provider, user } = useCollaborativeDoc();

  const fragmentName =
    (uiSchema?.['ui:options']?.field as string) ||
    schema.title?.toLowerCase().replace(/\s+/g, '_') ||
    'default_text';

  const placeholder =
    (uiSchema?.['ui:placeholder'] as string) || 'Start typing...';

  const baseExtensions = useMemo(
    () => getProposalExtensions({ collaborative: true }),
    [],
  );

  const extensions = useMemo(
    () => [
      ...baseExtensions,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-neutral-gray3 before:float-left before:h-0 before:pointer-events-none',
      }),
      Collaboration.configure({
        document: ydoc,
        field: fragmentName,
      }),
      CollaborationCaret.configure({
        provider,
        user,
      }),
    ],
    [baseExtensions, ydoc, provider, user, placeholder, fragmentName],
  );

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class: 'min-h-8 text-base text-neutral-black focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || !onChange) {
      return;
    }

    const handleUpdate = () => {
      onChange(editor.getHTML());
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onChange]);

  if (!editor) {
    return <Skeleton className="h-8" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {(schema.title || schema.description) && (
        <div className="flex flex-col gap-0.5">
          {schema.title && (
            <span className="font-serif text-title-xs text-neutral-charcoal">
              {schema.title}
            </span>
          )}
          {schema.description && (
            <p className="text-body-sm text-neutral-charcoal">
              {schema.description}
            </p>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
      {rawErrors && rawErrors.length > 0 && (
        <div className="text-sm text-functional-red">
          {rawErrors.join(', ')}
        </div>
      )}
    </div>
  );
}
