'use client';

import { normalizeBudget, parseSchemaOptions } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { generateHTML } from '@tiptap/core';
import type { Editor, JSONContent } from '@tiptap/react';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import { getViewerExtensions } from '../../RichTextEditor';
import {
  CollaborativeBudgetField,
  CollaborativeDropdownField,
  CollaborativeTextField,
  CollaborativeTitleField,
} from '../../collaboration';
import { FieldHeader } from '../forms/FieldHeader';
import type { FieldDescriptor } from '../forms/types';
import type { ProposalDraftFields } from './useProposalDraft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalFormRendererProps {
  /** Compiled field descriptors from `compileProposalSchema`. */
  fields: FieldDescriptor[];
  /** Current draft values for system fields. */
  draft: ProposalDraftFields;
  /** Called when any system field value changes. */
  onFieldChange: (key: string, value: unknown) => void;
  /** Called with the editor instance when a rich-text field gains focus. */
  onEditorFocus?: (editor: Editor) => void;
  /** Called with the editor instance when a rich-text field loses focus. */
  onEditorBlur?: (editor: Editor) => void;
  /** When true, renders the form as a non-interactive static preview. */
  previewMode?: boolean;
  /** Snapshot preview content keyed by fragment name. */
  previewFragmentContents?: Record<string, JSONContent | null>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract `{ value, label }` options from a JSON Schema property.
 * Delegates to the shared `parseSchemaOptions` normalizer which handles
 * both `oneOf` and legacy `enum` formats.
 */
function extractOptions(
  schema: FieldDescriptor['schema'],
): { value: string; label: string }[] {
  return parseSchemaOptions(schema).map((opt) => ({
    value: opt.value,
    label: opt.title,
  }));
}

function extractPlainText(content: JSONContent | null | undefined): string {
  if (!content) {
    return '';
  }

  if (content.text) {
    return content.text;
  }

  return (content.content ?? []).map(extractPlainText).join('');
}

function renderPreviewHtml(
  content: JSONContent | null | undefined,
): string | null {
  if (!content) {
    return null;
  }

  try {
    return generateHTML(content, getViewerExtensions());
  } catch {
    return null;
  }
}

function formatPreviewBudget(
  content: JSONContent | null | undefined,
): string | null {
  const text = extractPlainText(content);

  if (!text) {
    return null;
  }

  try {
    const budget = normalizeBudget(JSON.parse(text));

    if (!budget) {
      return text;
    }

    return budget.amount.toLocaleString(undefined, {
      style: 'currency',
      currency: budget.currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    });
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single field descriptor. In preview mode, uses the same UI
 * components (`Button pill`, `Select pill`, identical label/description
 * markup) but without any Yjs/TipTap collaboration dependencies.
 */
function renderField(
  field: FieldDescriptor,
  draft: ProposalDraftFields,
  onFieldChange: (key: string, value: unknown) => void,
  t: TranslateFn,
  preview: boolean,
  previewFragmentContents: Record<string, JSONContent | null>,
  onEditorFocus?: (editor: Editor) => void,
  onEditorBlur?: (editor: Editor) => void,
): React.ReactNode {
  const { key, format, schema } = field;
  const previewText = extractPlainText(previewFragmentContents[key]);
  const previewHtml = renderPreviewHtml(previewFragmentContents[key]);

  // -- Title ------------------------------------------------------------------

  if (key === 'title') {
    if (preview) {
      return (
        <div className="h-auto border-0 p-0 font-serif text-title-lg text-neutral-charcoal">
          {previewText || t('Untitled Proposal')}
        </div>
      );
    }
    return (
      <CollaborativeTitleField
        placeholder={t('Untitled Proposal')}
        onChange={(value) => onFieldChange('title', value)}
      />
    );
  }

  // -- Category (system) ------------------------------------------------------

  if (key === 'category') {
    const options = extractOptions(schema);

    if (preview) {
      const selectedOption = options.find((opt) => opt.value === previewText);

      return (
        <Button variant="pill" color="pill">
          {selectedOption?.label ?? t('Select category')}
        </Button>
      );
    }
    return (
      <CollaborativeDropdownField
        options={options}
        initialValue={draft.category}
        onChange={(value) => onFieldChange('category', value)}
        fragmentName="category"
        placeholder={t('Select category')}
      />
    );
  }

  // -- Budget (system) --------------------------------------------------------

  if (key === 'budget') {
    if (preview) {
      return (
        <Button variant="pill" color="pill">
          {formatPreviewBudget(previewFragmentContents[key]) ?? t('Add budget')}
        </Button>
      );
    }
    return (
      <CollaborativeBudgetField
        minAmount={schema.minimum}
        maxAmount={schema.maximum}
        initialValue={draft.budget}
        onChange={(value) => onFieldChange('budget', value)}
      />
    );
  }

  // -- Dynamic fields resolved by x-format ------------------------------------

  switch (format) {
    case 'short-text':
    case 'long-text': {
      const placeholder = t('Start typing...');

      if (preview) {
        return (
          <div className="flex flex-col gap-2">
            <FieldHeader
              title={schema.title}
              description={schema.description}
            />
            {previewHtml ? (
              <div
                className={`ProseMirror ${format === 'long-text' ? 'min-h-32' : 'min-h-8'}`}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div
                className={`text-neutral-gray3 ${format === 'long-text' ? 'min-h-32' : 'min-h-8'}`}
              >
                {placeholder}
              </div>
            )}
          </div>
        );
      }
      return (
        <CollaborativeTextField
          fragmentName={key}
          title={schema.title}
          description={schema.description}
          placeholder={placeholder}
          multiline={format === 'long-text'}
          onChange={(html) => onFieldChange(key, html)}
          onEditorFocus={onEditorFocus}
          onEditorBlur={onEditorBlur}
        />
      );
    }

    case 'money': {
      if (preview) {
        return (
          <Button variant="pill" color="pill">
            {formatPreviewBudget(previewFragmentContents[key]) ??
              t('Add budget')}
          </Button>
        );
      }
      return (
        <CollaborativeBudgetField
          minAmount={schema.minimum}
          maxAmount={schema.maximum}
          initialValue={null}
          onChange={(value) => onFieldChange(key, value)}
        />
      );
    }

    case 'dropdown': {
      const options = extractOptions(schema);

      if (preview) {
        const selectedOption = options.find((opt) => opt.value === previewText);

        return (
          <div className="flex flex-col gap-2">
            <FieldHeader
              title={schema.title}
              description={schema.description}
            />
            <Button variant="pill" color="pill">
              {selectedOption?.label ?? t('Select option')}
            </Button>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <FieldHeader title={schema.title} description={schema.description} />
          <CollaborativeDropdownField
            options={options}
            initialValue={(draft[key] as string | null) ?? null}
            onChange={(value) => onFieldChange(key, value)}
            fragmentName={key}
          />
        </div>
      );
    }

    default: {
      console.warn(`Unimplemented x-format "${format}" for field "${key}"`);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// ProposalFormRenderer
// ---------------------------------------------------------------------------

/**
 * Schema-driven form renderer for proposal editing.
 *
 * Takes compiled field descriptors and renders the correct component for
 * each field. In preview mode the same structure is rendered using static
 * `@op/ui` components instead of collaborative editors — no Yjs, TipTap,
 * or collaboration providers are needed.
 *
 * Layout:
 * - Title at full width
 * - Category + Budget side-by-side
 * - Dynamic template fields stacked below
 */
export function ProposalFormRenderer({
  fields,
  draft,
  onFieldChange,
  onEditorFocus,
  onEditorBlur,
  previewMode = false,
  previewFragmentContents = {},
}: ProposalFormRendererProps) {
  const t = useTranslations();

  const titleField = fields.find((f) => f.key === 'title');
  const categoryField = fields.find((f) => f.key === 'category');
  const budgetField = fields.find((f) => f.key === 'budget');
  const dynamicFields = fields.filter((f) => !f.isSystem);

  const render = (field: FieldDescriptor) =>
    renderField(
      field,
      draft,
      onFieldChange,
      t,
      previewMode,
      previewFragmentContents,
      onEditorFocus,
      onEditorBlur,
    );

  return (
    <div
      className={`flex flex-col ${previewMode ? 'pointer-events-none gap-4' : 'gap-8'}`}
    >
      {titleField && render(titleField)}

      {(categoryField || budgetField) && (
        <div className="flex gap-6">
          {categoryField && render(categoryField)}
          {budgetField && render(budgetField)}
        </div>
      )}

      {dynamicFields.map((field) => (
        <div key={field.key}>{render(field)}</div>
      ))}
    </div>
  );
}
