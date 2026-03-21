'use client';

import { Button } from '@op/ui/Button';
import { RichTextViewer } from '@op/ui/RichTextEditor';
import type { JSONContent } from '@tiptap/react';

import { useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../../RichTextEditor';
import { FieldHeader } from '../forms/FieldHeader';

/** Read-only title field used by proposal preview modes. */
export function ReadonlyTitleField({ value }: { value: string | null }) {
  const t = useTranslations();

  return (
    <div className="h-auto border-0 p-0 font-serif text-title-lg text-neutral-charcoal">
      {value || t('Untitled Proposal')}
    </div>
  );
}

/** Read-only rich text field used by proposal preview modes. */
export function ReadonlyTextField({
  title,
  description,
  content,
  placeholder,
  multiline,
}: {
  title?: string;
  description?: string;
  content: JSONContent | null;
  placeholder: string;
  multiline: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FieldHeader title={title} description={description} />
      {content ? (
        <RichTextViewer
          extensions={getViewerExtensions()}
          content={content}
          editorClassName={multiline ? 'min-h-32' : 'min-h-8'}
        />
      ) : (
        <div
          className={`text-neutral-gray3 ${multiline ? 'min-h-32' : 'min-h-8'}`}
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
  placeholder,
}: {
  value: string | null;
  title?: string;
  description?: string;
  placeholder: string;
}) {
  const content = (
    <Button
      variant="pill"
      color="pill"
      className="w-64 justify-start text-left"
    >
      {value ?? placeholder}
    </Button>
  );

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
  const content = (
    <Button variant="pill" color="pill">
      {value ?? placeholder}
    </Button>
  );

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
