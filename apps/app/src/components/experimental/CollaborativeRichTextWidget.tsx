'use client';

import { Description } from '@op/ui/Field';
import { cn } from '@op/ui/utils';
import type { WidgetProps } from '@rjsf/utils';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import { useCallback, useMemo } from 'react';
import type * as Y from 'yjs';

import { getProposalExtensions } from '@/components/RichTextEditor';

import { CollaborativeEditorWithFragment } from './CollaborativeEditorWithFragment';

/**
 * Context passed to the RJSF form for collaborative editing.
 * The parent component provides the Yjs document and provider.
 */
export interface CollaborativeFormContext {
  ydoc: Y.Doc;
  provider: TiptapCollabProvider;
  userName?: string;
}

export interface CollaborativeRichTextWidgetProps extends WidgetProps {
  formContext?: CollaborativeFormContext;
}

/**
 * RJSF Widget for collaborative rich text editing.
 * Uses a specific Yjs fragment based on the field name from uiSchema.
 */
export function CollaborativeRichTextWidget(
  props: CollaborativeRichTextWidgetProps,
) {
  const { required, onChange, schema, uiSchema, rawErrors, formContext } =
    props;

  // Get the fragment name from uiSchema options, fallback to schema title or 'default'
  const fragmentName =
    (uiSchema?.['ui:options']?.field as string) ||
    schema.title?.toLowerCase().replace(/\s+/g, '_') ||
    'default';

  const customClassName = uiSchema?.['ui:options']?.className as string;
  const placeholder =
    (uiSchema?.['ui:placeholder'] as string) || 'Start writing...';

  // Get extensions for the editor
  const extensions = useMemo(
    () => getProposalExtensions({ collaborative: true }),
    [],
  );

  // Track if content has changed (for form validation purposes)
  const handleContentChange = useCallback(
    (html: string) => {
      // Store HTML in form state for validation/submission
      onChange(html);
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
        <div className="flex min-h-52 items-center justify-center rounded-md border bg-neutral-gray1 p-4">
          <p className="text-sm text-neutral-gray4">
            Collaborative editing not available
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
      <div className="flex flex-col rounded-md border">
        <CollaborativeEditorWithFragment
          ydoc={formContext.ydoc}
          provider={formContext.provider}
          field={fragmentName}
          extensions={extensions}
          placeholder={placeholder}
          onChange={handleContentChange}
          className="flex flex-1 flex-col"
          editorClassName={cn(
            'min-h-52 max-w-none flex-1 p-4 focus:outline-hidden',
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
