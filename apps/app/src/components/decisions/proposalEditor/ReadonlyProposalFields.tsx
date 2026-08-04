'use client';

import { Badge } from '@op/sense/Badge';
import { RichTextViewer } from '@op/sense/RichTextEditor';
import type { JSONContent } from '@tiptap/react';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../../RichTextEditor';
import { FieldHeader } from '../forms/FieldHeader';

/** Read-only title field used by proposal preview modes. */
export function ReadonlyTitleField({ value }: { value: string | null }) {
  const t = useTranslations();

  return (
    <div className="h-auto border-0 p-0 font-serif text-title-lg text-foreground">
      {value || t('Untitled Proposal')}
    </div>
  );
}

/** Read-only rich text field used by proposal preview modes. */
export function ReadonlyTextField({
  title,
  description,
  required,
  content,
  placeholder,
  multiline,
}: {
  title?: string;
  description?: string;
  required?: boolean;
  content: JSONContent | null;
  placeholder: string;
  multiline: boolean;
}) {
  // Force React to remount the TipTap viewer when content changes, since
  // useEditor only uses `content` on initialization.
  const contentKey = useMemo(
    () => (content ? JSON.stringify(content) : 'empty'),
    [content],
  );

  return (
    <div className="flex flex-col gap-4">
      <FieldHeader
        title={title}
        description={description}
        required={required}
      />
      {content ? (
        <RichTextViewer
          key={contentKey}
          extensions={getViewerExtensions()}
          content={content}
          editorClassName={multiline ? 'min-h-32' : 'min-h-8'}
        />
      ) : (
        <div
          className={`text-muted-foreground ${multiline ? 'min-h-32' : 'min-h-8'}`}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}

/** Read-only dropdown field used by proposal preview modes. */
export function ReadonlyDropdownField({
  value,
  title,
  description,
  required,
  placeholder,
}: {
  value: string | null;
  title?: string;
  description?: string;
  required?: boolean;
  placeholder: string;
}) {
  const content = (
    <Badge variant="secondary" className="justify-start text-start">
      {value ?? placeholder}
    </Badge>
  );

  if (!title && !description) {
    return content;
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldHeader
        title={title}
        description={description}
        required={required}
      />
      {content}
    </div>
  );
}

/** Read-only budget field used by proposal preview modes. */
export function ReadonlyBudgetField({
  value,
  title,
  description,
  placeholder,
}: {
  value: string | null;
  title?: string;
  description?: string;
  placeholder: string;
}) {
  const content = <Badge variant="secondary">{value ?? placeholder}</Badge>;

  if (!title && !description) {
    return content;
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldHeader title={title} description={description} />
      {content}
    </div>
  );
}
