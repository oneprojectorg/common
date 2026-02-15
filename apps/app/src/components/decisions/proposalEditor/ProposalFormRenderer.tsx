'use client';

import { Button } from '@op/ui/Button';
import { Select, SelectItem } from '@op/ui/Select';

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
  /** When true, renders the form as a non-interactive static preview. */
  previewMode?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract `{ value, label }` options from a JSON Schema property.
 * Prefers the `oneOf` format (`[{ const, title }]`), falling back to
 * a legacy `enum` array for backwards compatibility with older templates.
 */
function extractOneOfOptions(
  schema: ProposalFieldDescriptor['schema'],
): { value: string; label: string }[] {
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf
      .filter(
        (entry): entry is { const: string; title: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          'const' in entry &&
          'title' in entry,
      )
      .map((entry) => ({ value: entry.const, label: entry.title }));
  }

  // Legacy fallback: plain enum array (value used as both value and label)
  if (Array.isArray(schema.enum)) {
    return schema.enum
      .filter((val): val is string => typeof val === 'string')
      .map((val) => ({ value: val, label: val }));
  }

  return [];
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
  field: ProposalFieldDescriptor,
  draft: ProposalDraftFields,
  onFieldChange: (key: string, value: unknown) => void,
  t: (key: string, params?: Record<string, string | number>) => string,
  preview: boolean,
): React.ReactNode {
  const { key, format, schema } = field;

  // -- Title ------------------------------------------------------------------

  if (key === 'title') {
    if (preview) {
      return (
        <div className="h-auto border-0 p-0 font-serif text-title-lg text-neutral-gray3">
          {t('Proposal Title')}
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
    const options = extractOneOfOptions(schema);

    if (preview) {
      return (
        <Select
          variant="pill"
          size="medium"
          placeholder={t('Select category')}
          selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
          className="w-auto max-w-36 overflow-hidden sm:max-w-96"
        >
          {options.map((opt) => (
            <SelectItem className="min-w-fit" key={opt.value} id={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </Select>
      );
    }
    return (
      <CollaborativeCategoryField
        options={options}
        initialValue={draft.category}
        onChange={(value) => onFieldChange('category', value)}
      />
    );
  }

  // -- Budget (system) --------------------------------------------------------

  if (key === 'budget') {
    if (preview) {
      return (
        <Button variant="pill" color="pill">
          {t('Add budget')}
        </Button>
      );
    }
    return (
      <CollaborativeBudgetField
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
            {(schema.title || schema.description) && (
              <div className="flex flex-col gap-0.5">
                {schema.title && (
                  <span className="font-serif text-title-sm text-neutral-charcoal">
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
            <div
              className={`text-neutral-gray3 ${format === 'long-text' ? 'min-h-32' : 'min-h-8'}`}
            >
              {placeholder}
            </div>
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
        />
      );
    }

    case 'money': {
      if (preview) {
        return (
          <Button variant="pill" color="pill">
            {t('Add budget')}
          </Button>
        );
      }
      return (
        <CollaborativeBudgetField
          maxAmount={schema.maximum}
          initialValue={null}
          onChange={(value) => onFieldChange(key, value)}
        />
      );
    }

    case 'category':
    case 'dropdown': {
      const options = extractOneOfOptions(schema);

      if (preview) {
        return (
          <div className="flex flex-col gap-2">
            {(schema.title || schema.description) && (
              <div className="flex flex-col gap-0.5">
                {schema.title && (
                  <span className="font-serif text-title-sm text-neutral-charcoal">
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
            <Select
              variant="pill"
              size="medium"
              placeholder={t('Select option')}
              selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
              className="w-auto max-w-36 overflow-hidden sm:max-w-96"
            >
              {options.map((opt) => (
                <SelectItem
                  className="min-w-fit"
                  key={opt.value}
                  id={opt.value}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          {(schema.title || schema.description) && (
            <div className="flex flex-col gap-0.5">
              {schema.title && (
                <span className="font-serif text-title-sm text-neutral-charcoal">
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
          <CollaborativeCategoryField
            options={options}
            initialValue={(draft[key] as string | null) ?? null}
            onChange={(value) => onFieldChange(key, value)}
          />
        </div>
      );
    }

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
  t,
  previewMode = false,
}: ProposalFormRendererProps) {
  const titleField = fields.find((f) => f.key === 'title');
  const categoryField = fields.find((f) => f.key === 'category');
  const budgetField = fields.find((f) => f.key === 'budget');
  const dynamicFields = fields.filter((f) => !f.isSystem);

  const render = (field: ProposalFieldDescriptor) =>
    renderField(field, draft, onFieldChange, t, previewMode);

  return (
    <div className={`space-y-4 ${previewMode ? 'pointer-events-none' : ''}`}>
      {titleField && render(titleField)}

      {(categoryField || budgetField) && (
        <div className="flex gap-2">
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
