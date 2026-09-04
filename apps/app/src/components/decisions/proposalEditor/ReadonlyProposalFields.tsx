'use client';

import { Field, FieldDescription, FieldTitle } from '@op/sense/Field';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { RichTextViewer } from '@op/sense/RichTextEditor';
import { cn } from '@op/sense/lib/utils';
import type { JSONContent } from '@tiptap/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../../RichTextEditor';

/** Read-only title field used by proposal preview modes. */
export function ReadonlyTitleField({
  title,
  required,
  value,
}: {
  title?: string;
  required?: boolean;
  value: string | null;
}) {
  const t = useTranslations();

  return (
    <ReadonlyField title={title} required={required}>
      <ReadonlyValueBox isEmpty={!value}>
        {value || t('Untitled Proposal')}
      </ReadonlyValueBox>
    </ReadonlyField>
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
    <ReadonlyField title={title} description={description} required={required}>
      <ReadonlyValueBox isEmpty={!content}>
        {content ? (
          <RichTextViewer
            key={contentKey}
            extensions={getViewerExtensions()}
            content={content}
            editorClassName={multiline ? 'min-h-32' : 'min-h-8'}
          />
        ) : (
          <span className={multiline ? 'block min-h-32' : 'block min-h-8'}>
            {placeholder}
          </span>
        )}
      </ReadonlyValueBox>
    </ReadonlyField>
  );
}

/** Read-only single/multi select field used by proposal preview modes. */
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
  return (
    <ReadonlyField title={title} description={description} required={required}>
      <ReadonlyValueBox isEmpty={!value}>
        {value ?? placeholder}
      </ReadonlyValueBox>
    </ReadonlyField>
  );
}

/** Read-only budget field used by proposal preview modes. */
export function ReadonlyBudgetField({
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
  return (
    <ReadonlyField
      title={title}
      description={description}
      required={required}
      className="w-full sm:max-w-68"
    >
      <ReadonlyValueBox isEmpty={!value}>
        {value ?? placeholder}
      </ReadonlyValueBox>
    </ReadonlyField>
  );
}

/**
 * Label + description chrome shared by the readonly previews, matching the
 * editable fields' `Field` composition. `FieldTitle` (a div) rather than
 * `FieldLabel` because there is no control to associate a `<label>` with.
 */
function ReadonlyField({
  title,
  description,
  required,
  className,
  children,
}: {
  title?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    // Authored template text, so direction follows the content — resolved once
    // for the block rather than per element.
    <Field className={className} dir="auto">
      {title && (
        <FieldTitle>
          {title}
          {required && <RequiredAsterisk />}
        </FieldTitle>
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {children}
    </Field>
  );
}

/**
 * The bordered box a readonly value sits in, so previews read as the same
 * control shape as the editor without pretending to be interactive.
 */
function ReadonlyValueBox({
  isEmpty,
  children,
}: {
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-input bg-muted px-3 py-2.5 text-base',
        isEmpty ? 'text-muted-foreground' : 'text-foreground',
      )}
      dir="auto"
    >
      {children}
    </div>
  );
}
