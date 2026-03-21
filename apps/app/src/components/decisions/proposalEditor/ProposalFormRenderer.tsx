'use client';

import { parseSchemaOptions } from '@op/common/client';
import type { Editor } from '@tiptap/react';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import {
  CollaborativeBudgetField,
  CollaborativeDropdownField,
  CollaborativeTextField,
  CollaborativeTitleField,
} from '../../collaboration';
import { FieldHeader } from '../forms/FieldHeader';
import type { FieldDescriptor } from '../forms/types';
import {
  ReadonlyBudgetField,
  ReadonlyDropdownField,
  ReadonlyTextField,
  ReadonlyTitleField,
} from './ReadonlyProposalFields';
import type { ProposalDraftFields } from './useProposalDraft';

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
  /** Rendering mode for collaborative editing or template preview. */
  mode?: 'edit-collaborative' | 'preview-template';
}

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

/** Formats stored budget values for readonly preview display. */
function formatBudgetValue(
  value: ProposalDraftFields['budget'] | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return value.amount.toLocaleString(undefined, {
    style: 'currency',
    currency: value.currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  });
}

/**
 * Renders a single field descriptor for collaborative editing or readonly
 * template preview.
 */
function renderField(
  field: FieldDescriptor,
  draft: ProposalDraftFields,
  onFieldChange: (key: string, value: unknown) => void,
  t: TranslateFn,
  mode: 'edit-collaborative' | 'preview-template',
  onEditorFocus?: (editor: Editor) => void,
  onEditorBlur?: (editor: Editor) => void,
): React.ReactNode {
  const { key, format, schema } = field;
  const isReadonlyMode = mode === 'preview-template';

  if (key === 'title') {
    if (isReadonlyMode) {
      return <ReadonlyTitleField value={draft.title} />;
    }

    return (
      <CollaborativeTitleField
        placeholder={t('Untitled Proposal')}
        onChange={(value) => onFieldChange('title', value)}
      />
    );
  }

  if (key === 'category') {
    const options = extractOptions(schema);

    if (isReadonlyMode) {
      const selectedOption = options.find(
        (opt) => opt.value === draft.category,
      );

      return (
        <ReadonlyDropdownField
          value={selectedOption?.label ?? null}
          placeholder={t('Select category')}
        />
      );
    }

    return (
      <CollaborativeDropdownField
        options={options}
        initialValue={draft.category}
        onChange={(value) => onFieldChange('category', value)}
        fragmentName="category"
        placeholder={t('Select category')}
        allowEmpty={!field.required}
      />
    );
  }

  if (key === 'budget') {
    if (isReadonlyMode) {
      return (
        <ReadonlyBudgetField
          value={formatBudgetValue(draft.budget)}
          placeholder={t('Add budget')}
        />
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

  switch (format) {
    case 'short-text':
    case 'long-text': {
      const placeholder = t('Start typing...');

      if (isReadonlyMode) {
        return (
          <ReadonlyTextField
            title={schema.title}
            description={schema.description}
            content={null}
            placeholder={placeholder}
            multiline={format === 'long-text'}
          />
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
      if (isReadonlyMode) {
        return (
          <ReadonlyBudgetField
            value={formatBudgetValue(
              (draft[key] as ProposalDraftFields['budget']) ?? null,
            )}
            title={schema.title}
            description={schema.description}
            placeholder={t('Add budget')}
          />
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

      if (isReadonlyMode) {
        const selectedOption = options.find(
          (opt) => opt.value === ((draft[key] as string | null) ?? null),
        );

        return (
          <ReadonlyDropdownField
            value={selectedOption?.label ?? null}
            title={schema.title}
            description={schema.description}
            placeholder={t('Select option')}
          />
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
            allowEmpty={!field.required}
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

/**
 * Schema-driven form renderer for proposal editing and template preview.
 *
 * Takes compiled field descriptors and renders the correct component for
 * each field. In template preview mode, the same structure is rendered
 * through readonly field primitives instead of collaborative editors.
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
  mode = 'edit-collaborative',
}: ProposalFormRendererProps) {
  const t = useTranslations();
  const isReadonlyMode = mode === 'preview-template';

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
      mode,
      onEditorFocus,
      onEditorBlur,
    );

  return (
    <div className={`flex flex-col ${isReadonlyMode ? 'gap-4' : 'gap-8'}`}>
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
