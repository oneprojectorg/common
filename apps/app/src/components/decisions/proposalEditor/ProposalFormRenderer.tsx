'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { formatMoney } from '@/utils/formatting';
import {
  formatProposalCategories,
  getBudgetCurrency,
  isDistrictCategoryLabel,
  parseBudgetFragmentValue,
  parseCategoryFragmentValue,
  parseSchemaOptions,
  schemaAllowsMultipleSelection,
} from '@op/common/client';
import { cn } from '@op/ui/utils';
import type { Editor, JSONContent } from '@tiptap/react';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import {
  CollaborativeBudgetField,
  CollaborativeDropdownField,
  CollaborativeLocationField,
  CollaborativeMultiSelectField,
  CollaborativeTextField,
  CollaborativeTitleField,
} from '../../collaboration';
import { formatBudget } from '../BudgetDisplay';
import { FieldHeader } from '../forms/FieldHeader';
import type { FieldDescriptor } from '../forms/types';
import { LocationMapView } from '../location/LocationMapView';
import {
  ReadonlyBudgetField,
  ReadonlyDropdownField,
  ReadonlyTextField,
  ReadonlyTitleField,
} from './ReadonlyProposalFields';
import {
  getFragmentText,
  parsePreviewLocation,
} from './proposalPreviewContent';
import type { ProposalDraftFields } from './useProposalDraft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Rendering mode for collaborative editing or readonly previews. */
type ProposalFormMode =
  | 'edit-collaborative'
  | 'preview-version'
  | 'preview-template';

interface ProposalFormRendererProps {
  /** Compiled field descriptors from `compileProposalSchema`. */
  fields: FieldDescriptor[];
  /** Current draft values for system fields. */
  draft: ProposalDraftFields;
  /**
   * Decision profile (== `processInstances.profileId`) the proposal is being
   * composed under. Threaded through to the location field so the boundary
   * overlay / out-of-area check scope to the right decision. `null` for
   * preview-template mode where no decision is in scope.
   */
  decisionProfileId: string | null;
  /** Called when any system field value changes. */
  onFieldChange: (key: string, value: unknown) => void;
  /** Called with the editor instance when a rich-text field gains focus. */
  onEditorFocus?: (editor: Editor) => void;
  /** Called with the editor instance when a rich-text field loses focus. */
  onEditorBlur?: (editor: Editor) => void;
  /**
   * Currency for a system budget that names none of its own, already resolved
   * through `resolveBudgetFallbackCurrency` against the proposal's *raw*
   * stored data. Omitted in template-preview mode, where there is no proposal
   * and the template's own currency is the whole answer.
   */
  budgetFallbackCurrency?: string;
  /** Rendering mode for collaborative editing or readonly previews. */
  mode?: ProposalFormMode;
  /** Version preview content keyed by fragment name. */
  previewVersionFragmentContents?: Record<string, JSONContent | null>;
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
    value: String(opt.value),
    label: opt.title,
  }));
}

function formatPreviewBudget(
  content: JSONContent | null | undefined,
  currency: string,
): string | null {
  const text = getFragmentText(content);

  if (!text) {
    return null;
  }

  // Reuses `text` rather than re-extracting: `getFragmentText` runs a TipTap
  // `generateText` pass, which is not free on a render path.
  const budget = parseBudgetFragmentValue(text, currency);

  if (!budget) {
    return text;
  }

  return formatMoney(budget);
}

function getPreviewText({
  mode,
  draftValue,
  previewContent,
}: {
  mode: 'preview-version' | 'preview-template';
  draftValue: string | null | undefined;
  previewContent: JSONContent | null | undefined;
}): string | null {
  if (mode === 'preview-version') {
    const previewText = getFragmentText(previewContent);
    return previewText || null;
  }

  return draftValue ?? null;
}

function getPreviewCategories({
  mode,
  draftValue,
  previewContent,
}: {
  mode: 'preview-version' | 'preview-template';
  draftValue: string[];
  previewContent: JSONContent | null | undefined;
}): string[] {
  if (mode === 'preview-version') {
    return parseCategoryFragmentValue(getFragmentText(previewContent) ?? '');
  }

  return draftValue;
}

function getPreviewBudgetValue({
  mode,
  draftValue,
  previewContent,
  fallbackCurrency,
}: {
  mode: 'preview-version' | 'preview-template';
  draftValue: ProposalDraftFields['budget'] | null | undefined;
  previewContent: JSONContent | null | undefined;
  /**
   * Currency for a budget that names none of its own, already resolved through
   * `resolveBudgetFallbackCurrency`.
   */
  fallbackCurrency: string;
}): string | null {
  if (mode === 'preview-version') {
    return formatPreviewBudget(previewContent, fallbackCurrency);
  }

  if (!draftValue) {
    return null;
  }

  // Through `formatBudget`, not `formatMoney` directly: it already owns the
  // "a stored blank code names no currency either" rule, and a second entry
  // point here is exactly how the editor pill drifts from the cards.
  return formatBudget(draftValue, fallbackCurrency);
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

/**
 * Everything {@link renderField} needs. An options object rather than
 * positional parameters: field-scoped inputs keep being added (the budget's
 * fallback currency was the eighth), and ten unlabeled values at the call site
 * are read in the wrong order sooner or later.
 */
interface RenderFieldOptions {
  field: FieldDescriptor;
  draft: ProposalDraftFields;
  decisionProfileId: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  t: TranslateFn;
  mode: ProposalFormMode;
  previewVersionFragmentContents: Record<string, JSONContent | null>;
  /** See {@link ProposalFormRendererProps.budgetFallbackCurrency}. */
  budgetFallbackCurrency: string | undefined;
  onEditorFocus?: (editor: Editor) => void;
  onEditorBlur?: (editor: Editor) => void;
}

/**
 * Renders a single field descriptor for collaborative editing or readonly
 * proposal preview modes.
 */
function renderField({
  field,
  draft,
  decisionProfileId,
  onFieldChange,
  t,
  mode,
  previewVersionFragmentContents,
  budgetFallbackCurrency,
  onEditorFocus,
  onEditorBlur,
}: RenderFieldOptions): React.ReactNode {
  const { key, format, schema } = field;
  const isReadonlyMode = mode !== 'edit-collaborative';
  const previewContent = previewVersionFragmentContents[key];

  // -- Title ------------------------------------------------------------------

  if (key === 'title') {
    if (isReadonlyMode) {
      return (
        <ReadonlyTitleField
          value={getPreviewText({
            mode,
            draftValue: draft.title,
            previewContent,
          })}
        />
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
    const isMultipleSelection = schemaAllowsMultipleSelection(schema);

    if (isReadonlyMode) {
      const selectedValues = getPreviewCategories({
        mode,
        draftValue: draft.category,
        previewContent,
      });
      const selectedLabels = options
        .filter((opt) => selectedValues.includes(opt.value))
        .map((opt) => opt.label);

      return (
        <ReadonlyDropdownField
          value={
            selectedLabels.length > 0
              ? formatProposalCategories(selectedLabels)
              : null
          }
          placeholder={t('Select category')}
        />
      );
    }

    // District categories are auto-assigned from the proposal's location, so
    // they are hidden from the dropdown but kept in the schema (and in the
    // readonly display above) so auto-filled values still validate and render.
    const selectableOptions = options.filter(
      (opt) => !isDistrictCategoryLabel(opt.label),
    );

    if (isMultipleSelection) {
      return (
        <div className="min-w-0">
          <CollaborativeMultiSelectField
            options={selectableOptions}
            initialValue={draft.category}
            onChange={(value) => onFieldChange('category', value)}
            fragmentName="category"
            placeholder={t('Select category')}
          />
        </div>
      );
    }

    return (
      <CollaborativeDropdownField
        options={selectableOptions}
        initialValue={draft.category[0] ?? null}
        onChange={(value) => onFieldChange('category', value)}
        fragmentName="category"
        placeholder={t('Select category')}
        allowEmpty={!field.required}
      />
    );
  }

  // -- Budget (system) --------------------------------------------------------

  if (key === 'budget') {
    return renderMoneyField({
      schema,
      mode,
      previewContent,
      t,
      // The proposal's own resolved fallback where we have one (the editor);
      // the template's alone in template-preview mode, where no proposal
      // exists.
      fallbackCurrency: budgetFallbackCurrency ?? getBudgetCurrency(schema),
      // The system budget is a stored column, so the draft both previews the
      // readonly value and seeds the fragment.
      previewValue: draft.budget,
      initialValue: draft.budget,
      // No header: the system budget renders inline beside the category rather
      // than as a titled form row.
      showHeader: false,
      onChange: (value) => onFieldChange('budget', value),
    });
  }

  // -- Dynamic fields resolved by x-format ------------------------------------

  switch (format) {
    case 'short-text':
    case 'long-text': {
      const placeholder = t('Start typing...');

      if (isReadonlyMode) {
        return (
          <ReadonlyTextField
            title={schema.title}
            description={schema.description}
            required={field.required}
            content={
              mode === 'preview-version' ? (previewContent ?? null) : null
            }
            placeholder={placeholder}
            multiline={format === 'long-text'}
          />
        );
      }

      return (
        <CollaborativeTextField
          fragmentName={key}
          title={schema.title}
          required={field.required}
          description={schema.description}
          placeholder={placeholder}
          multiline={format === 'long-text'}
          maxLength={schema.maxLength}
          onChange={(html) => onFieldChange(key, html)}
          onEditorFocus={onEditorFocus}
          onEditorBlur={onEditorBlur}
        />
      );
    }

    case 'money':
      return renderMoneyField({
        schema,
        mode,
        previewContent,
        t,
        // A dynamic money field, not the system budget — it has no stored
        // counterpart, so its own schema is the whole answer for the currency
        // and there is nothing to seed the fragment from.
        fallbackCurrency: getBudgetCurrency(schema),
        previewValue: (draft[key] as ProposalDraftFields['budget']) ?? null,
        initialValue: null,
        showHeader: true,
        onChange: (value) => onFieldChange(key, value),
      });

    case 'location': {
      if (isReadonlyMode) {
        const location =
          mode === 'preview-version'
            ? parsePreviewLocation(previewContent)
            : ((draft[key] as ProposalDraftFields['location']) ?? undefined);

        return (
          <div className="flex flex-col gap-2">
            <FieldHeader
              title={schema.title}
              description={schema.description}
              required={field.required}
            />
            <LocationMapView value={location ?? null} />
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-2">
          <FieldHeader
            title={schema.title}
            description={schema.description}
            required={field.required}
          />
          <CollaborativeLocationField
            initialValue={
              (draft[key] as ProposalDraftFields['location']) ?? null
            }
            profileId={decisionProfileId}
            defaultMapView={schema['x-map-default']}
            onChange={(value) => onFieldChange(key, value)}
          />
        </div>
      );
    }

    case 'dropdown': {
      const options = extractOptions(schema);

      if (isReadonlyMode) {
        const selectedValue = getPreviewText({
          mode,
          draftValue: (draft[key] as string | null) ?? null,
          previewContent,
        });
        const selectedOption = options.find(
          (opt) => opt.value === selectedValue,
        );

        return (
          <ReadonlyDropdownField
            value={selectedOption?.label ?? null}
            title={schema.title}
            description={schema.description}
            required={field.required}
            placeholder={t('Select option')}
          />
        );
      }

      return (
        <div data-testid={`field-${key}`} className="flex flex-col gap-2">
          <FieldHeader
            title={schema.title}
            description={schema.description}
            required={field.required}
          />
          <CollaborativeDropdownField
            options={options}
            initialValue={(draft[key] as string | null) ?? null}
            onChange={(value) => onFieldChange(key, value)}
            fragmentName={key}
            allowEmpty={!field.required}
            required={field.required}
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
 * The one money renderer, for the system budget and for `x-format: 'money'`
 * template fields alike.
 *
 * `key === 'budget'` is a name-based special case older than the x-format
 * switch, and the two bodies had become near-copies of each other — so every
 * prop the budget field gains has to be added twice, and the generic path is
 * the one nobody exercises. What actually differs is parameters: where the
 * fallback currency comes from, whether there is a stored value to seed from,
 * and whether the field carries its own header.
 */
function renderMoneyField({
  schema,
  mode,
  previewContent,
  t,
  fallbackCurrency,
  previewValue,
  initialValue,
  showHeader,
  onChange,
}: {
  schema: FieldDescriptor['schema'];
  mode: ProposalFormMode;
  previewContent: JSONContent | null | undefined;
  t: TranslateFn;
  /** Already resolved — see `resolveBudgetFallbackCurrency`. */
  fallbackCurrency: string;
  previewValue: ProposalDraftFields['budget'] | null;
  /** Seeds the collaborative fragment; `null` where nothing is stored. */
  initialValue: ProposalDraftFields['budget'] | null;
  showHeader: boolean;
  onChange: (value: ProposalDraftFields['budget']) => void;
}): React.ReactNode {
  if (mode !== 'edit-collaborative') {
    return (
      <ReadonlyBudgetField
        value={getPreviewBudgetValue({
          mode,
          draftValue: previewValue,
          previewContent,
          fallbackCurrency,
        })}
        title={showHeader ? schema.title : undefined}
        description={showHeader ? schema.description : undefined}
        placeholder={t('Add budget')}
      />
    );
  }

  return (
    <CollaborativeBudgetField
      minAmount={schema.minimum}
      maxAmount={schema.maximum}
      currency={fallbackCurrency}
      initialValue={initialValue}
      onChange={onChange}
    />
  );
}

// ---------------------------------------------------------------------------
// ProposalFormRenderer
// ---------------------------------------------------------------------------

/**
 * Schema-driven form renderer for proposal editing and template preview.
 *
 * Takes compiled field descriptors and renders the correct component for
 * each field. Version and template previews reuse readonly field components,
 * while editing keeps the collaborative Yjs-backed fields.
 *
 * Layout:
 * - Title at full width
 * - Budget stacked above category
 * - Dynamic template fields stacked below
 */
export function ProposalFormRenderer({
  fields,
  draft,
  decisionProfileId,
  onFieldChange,
  onEditorFocus,
  onEditorBlur,
  budgetFallbackCurrency,
  mode = 'edit-collaborative',
  previewVersionFragmentContents = {},
}: ProposalFormRendererProps) {
  const t = useTranslations();
  const gisMapsEnabled = useFeatureFlag('gis_maps');
  const formGapClass = mode === 'preview-template' ? 'gap-4' : 'gap-8';

  const titleField = fields.find((f) => f.key === 'title');
  const categoryField = fields.find((f) => f.key === 'category');
  const budgetField = fields.find((f) => f.key === 'budget');
  // The location field lives behind the `gis_maps` flag.
  const dynamicFields = fields.filter(
    (f) => !f.isSystem && (gisMapsEnabled || f.format !== 'location'),
  );

  const render = (field: FieldDescriptor) =>
    renderField({
      field,
      draft,
      decisionProfileId,
      onFieldChange,
      t,
      mode,
      previewVersionFragmentContents,
      budgetFallbackCurrency,
      onEditorFocus,
      onEditorBlur,
    });

  return (
    <div className={cn('flex flex-col', formGapClass)}>
      {titleField && render(titleField)}

      {(categoryField || budgetField) && (
        <div className="flex flex-col items-start gap-2">
          {budgetField && render(budgetField)}
          {categoryField && render(categoryField)}
        </div>
      )}

      {dynamicFields.map((field) => (
        <div key={field.key}>{render(field)}</div>
      ))}
    </div>
  );
}
