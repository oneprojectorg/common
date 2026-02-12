'use client';

import {
  CollaborativeBudgetField,
  CollaborativeCategoryField,
  CollaborativeTextField,
  CollaborativeTitleField,
} from '../../collaboration';
import type { ProposalFieldDescriptor } from './compileProposalSchema';
import type { ProposalDraftFields } from './useProposalDraft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalFormRendererProps {
  /** Compiled field descriptors from `compileProposalSchema`. */
  fields: ProposalFieldDescriptor[];
  /** Current draft values for system fields. */
  draft: ProposalDraftFields;
  /** Called when any system field value changes. */
  onFieldChange: (key: string, value: unknown) => void;
  /** Translation function for placeholders. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ---------------------------------------------------------------------------
// Field renderers
// ---------------------------------------------------------------------------

/**
 * Renders a single field descriptor into the appropriate collaborative
 * component. System fields (title, category, budget) get their specialised
 * wrappers; dynamic fields resolve via `x-format`.
 */
function renderField(
  field: ProposalFieldDescriptor,
  draft: ProposalDraftFields,
  onFieldChange: (key: string, value: unknown) => void,
  t: (key: string, params?: Record<string, string | number>) => string,
): React.ReactNode {
  const { key, format, schema, formatOptions } = field;

  // -- System fields with dedicated components --------------------------------

  if (key === 'title') {
    return (
      <CollaborativeTitleField
        key={key}
        placeholder={t('Untitled Proposal')}
        onChange={(value) => onFieldChange('title', value)}
      />
    );
  }

  if (key === 'category') {
    const options = Array.isArray(schema.oneOf)
      ? schema.oneOf
          .filter(
            (entry): entry is { const: string; title: string } =>
              typeof entry === 'object' &&
              entry !== null &&
              'const' in entry &&
              'title' in entry,
          )
          .map((entry) => ({ value: entry.const, label: entry.title }))
      : [];

    return (
      <CollaborativeCategoryField
        key={key}
        options={options}
        initialValue={draft.category}
        onChange={(value) => onFieldChange('category', value)}
      />
    );
  }

  if (key === 'budget') {
    return (
      <CollaborativeBudgetField
        key={key}
        maxAmount={schema.maximum}
        initialValue={draft.budget}
        onChange={(value) => onFieldChange('budget', value)}
      />
    );
  }

  // -- Dynamic fields resolved by x-format ------------------------------------

  switch (format) {
    case 'short-text':
      return (
        <CollaborativeTextField
          key={key}
          fragmentName={key}
          title={schema.title}
          description={schema.description}
          placeholder={
            (formatOptions.placeholder as string | undefined) ??
            t('Start typing...')
          }
          onChange={(html) => onFieldChange(key, html)}
        />
      );

    case 'long-text':
      return (
        <CollaborativeTextField
          key={key}
          fragmentName={key}
          title={schema.title}
          description={schema.description}
          placeholder={
            (formatOptions.placeholder as string | undefined) ??
            t('Start typing...')
          }
          multiline
          onChange={(html) => onFieldChange(key, html)}
        />
      );

    case 'money':
      return (
        <CollaborativeBudgetField
          key={key}
          maxAmount={schema.maximum}
          initialValue={(draft[key] as number | null) ?? null}
          onChange={(value) => onFieldChange(key, value)}
        />
      );

    case 'category':
      return (
        <CollaborativeCategoryField
          key={key}
          options={
            Array.isArray(schema.oneOf)
              ? schema.oneOf
                  .filter(
                    (entry): entry is { const: string; title: string } =>
                      typeof entry === 'object' &&
                      entry !== null &&
                      'const' in entry &&
                      'title' in entry,
                  )
                  .map((entry) => ({ value: entry.const, label: entry.title }))
              : []
          }
          initialValue={(draft[key] as string | null) ?? null}
          onChange={(value) => onFieldChange(key, value)}
        />
      );

    default: {
      const _exhaustive: never = format;
      console.warn(`Unknown x-format "${_exhaustive}" for field "${key}"`);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// ProposalFormRenderer
// ---------------------------------------------------------------------------

/**
 * Schema-driven form renderer that replaces RJSF's `<Form>` component.
 *
 * Takes compiled field descriptors and renders the correct collaborative
 * component for each field. Layout follows the same pattern as the previous
 * RJSF ObjectFieldTemplate:
 * - Title at full width
 * - Category + Budget side-by-side
 * - Dynamic template fields stacked below
 */
export function ProposalFormRenderer({
  fields,
  draft,
  onFieldChange,
  t,
}: ProposalFormRendererProps) {
  const titleField = fields.find((f) => f.key === 'title');
  const categoryField = fields.find((f) => f.key === 'category');
  const budgetField = fields.find((f) => f.key === 'budget');
  const dynamicFields = fields.filter((f) => !f.isSystem);

  return (
    <div className="space-y-4">
      {titleField && renderField(titleField, draft, onFieldChange, t)}

      {(categoryField || budgetField) && (
        <div className="flex gap-2">
          {categoryField && renderField(categoryField, draft, onFieldChange, t)}
          {budgetField && renderField(budgetField, draft, onFieldChange, t)}
        </div>
      )}

      {dynamicFields.map((field) => (
        <div key={field.key}>{renderField(field, draft, onFieldChange, t)}</div>
      ))}
    </div>
  );
}
