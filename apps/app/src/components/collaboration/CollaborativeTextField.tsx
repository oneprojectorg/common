'use client';

import type { FieldProps } from '@rjsf/utils';
import Placeholder from '@tiptap/extension-placeholder';
import type { Editor } from '@tiptap/react';
import { useCallback, useMemo, useRef } from 'react';

import { getProposalExtensions } from '../RichTextEditor';
import { CollaborativeEditor } from './CollaborativeEditor';

/**
 * RJSF custom field for collaborative text (short or long).
 *
 * Composes {@link CollaborativeEditor} so we get consistent editor setup,
 * styled content, and Yjs collaboration/snapshotting for free.
 *
 * Behaviour is controlled via `ui:options`:
 * - `field`     – Yjs fragment name (required, set by the template compiler)
 * - `multiline` – when true, renders a taller editor suitable for long text
 *
 * Future `x-format-options` from the template schema are forwarded here
 * as `ui:options` by the compiler, so adding new knobs (e.g. `rich`,
 * `maxWords`) only requires reading them from `uiSchema['ui:options']`.
 */
export function CollaborativeTextField(props: FieldProps) {
  const { onChange, schema, uiSchema, rawErrors } = props;

  const options = (uiSchema?.['ui:options'] ?? {}) as Record<string, unknown>;

  const fragmentName = options.field as string | undefined;

  if (!fragmentName) {
    throw new Error(
      `CollaborativeTextField requires a "field" ui:option but none was provided for "${schema.title ?? 'unknown'}".`,
    );
  }

  const placeholder =
    (uiSchema?.['ui:placeholder'] as string) || 'Start typing...';

  const multiline = Boolean(options.multiline);

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
      <CollaborativeEditor
        field={fragmentName}
        extensions={extensions}
        placeholder={placeholder}
        onEditorReady={handleEditorReady}
        editorClassName={multiline ? 'min-h-32' : 'min-h-8'}
      />
      {rawErrors && rawErrors.length > 0 && (
        <div className="text-sm text-functional-red">
          {rawErrors.join(', ')}
        </div>
      )}
    </div>
  );
}
