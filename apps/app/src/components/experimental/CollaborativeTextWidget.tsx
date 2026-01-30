'use client';

import { Description } from '@op/ui/Field';
import { cn } from '@op/ui/utils';
import type { WidgetProps } from '@rjsf/utils';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useCallback, useMemo } from 'react';
import type * as Y from 'yjs';

import { CollaborativeEditorWithFragment } from './CollaborativeEditorWithFragment';
import { getPlainTextExtensions } from './plainTextExtensions';

/**
 * Context passed to the RJSF form for collaborative editing.
 */
export interface CollaborativeFormContext {
  ydoc: Y.Doc;
  provider: TiptapCollabProvider;
  userName?: string;
}

export interface CollaborativeTextWidgetProps extends WidgetProps {
  formContext?: CollaborativeFormContext;
}

/**
 * RJSF Widget for collaborative plain text editing.
 * Uses TipTap with minimal extensions for proper cursor sync and no flickering.
 */
export function CollaborativeTextWidget(props: CollaborativeTextWidgetProps) {
  const { required, onChange, schema, uiSchema, rawErrors, formContext } =
    props;

  const fragmentName =
    (uiSchema?.['ui:options']?.field as string) ||
    schema.title?.toLowerCase().replace(/\s+/g, '_') ||
    'default_text';

  const customClassName = uiSchema?.['ui:options']?.className as string;
  const placeholder =
    (uiSchema?.['ui:placeholder'] as string) || 'Start typing...';

  // Plain text extensions (no formatting)
  const extensions = useMemo(() => getPlainTextExtensions(), []);

  const handleContentChange = useCallback(
    (html: string) => {
      // Strip HTML tags to get plain text for form state
      const plainText = html.replace(/<[^>]*>/g, '').trim();
      onChange(plainText);
    },
    [onChange],
  );

  if (!formContext?.ydoc || !formContext?.provider) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-neutral-charcoal">
          {schema.title}
          {required && <span className="ml-1 text-functional-red">*</span>}
        </label>
        <div className="rounded-md border border-neutral-gray2 bg-neutral-gray1 p-3">
          <p className="text-sm text-neutral-gray4">
            Collaboration not available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-charcoal">
        {schema.title}
        {required && <span className="ml-1 text-functional-red">*</span>}
      </label>
      <div className="rounded-md border border-neutral-gray2">
        <CollaborativeEditorWithFragment
          ydoc={formContext.ydoc}
          provider={formContext.provider}
          field={fragmentName}
          extensions={extensions}
          placeholder={placeholder}
          onChange={handleContentChange}
          className="flex flex-col"
          editorClassName={cn(
            'min-h-20 p-3 text-sm focus:outline-none',
            customClassName,
          )}
          userName={formContext.userName}
        />
      </div>
      {schema.description && <Description>{schema.description}</Description>}
      {rawErrors && rawErrors.length > 0 && (
        <div className="text-sm text-functional-red">
          {rawErrors.join(', ')}
        </div>
      )}
    </div>
  );
}
