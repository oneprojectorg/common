'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  PROPOSAL_TITLE_MAX_LENGTH,
  formatProposalCategories,
  isDistrictCategoryLabel,
  parseCategoryFragmentValue,
  parseSchemaOptions,
  schemaAllowsMultipleSelection,
} from '@op/common/client';
import { logger } from '@op/logging/client';
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
import { LabeledFieldSet } from '../forms/LabeledFieldSet';
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
  parsePreviewBudget,
  parsePreviewLocation,
} from './proposalPreviewContent';
import type { ProposalDraftFields } from './useProposalDraft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /** Rendering mode for collaborative editing or readonly previews. */
  mode?: 'edit-collaborative' | 'preview-version' | 'preview-template';
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
): string | null {
  const text = getFragmentText(content);

  if (!text) {
    return null;
  }

  const budget = parsePreviewBudget(content);

  if (!budget) {
    return text;
  }

  return budget.amount.toLocaleString(undefined, {
    style: 'currency',
    currency: budget.currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  });
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
}: {
  mode: 'preview-version' | 'preview-template';
  draftValue: ProposalDraftFields['budget'] | null | undefined;
  previewContent: JSONContent | null | undefined;
}): string | null {
  if (mode === 'preview-version') {
    return formatPreviewBudget(previewContent);
  }

  if (!draftValue) {
    return null;
  }

  return draftValue.amount.toLocaleString(undefined, {
    style: 'currency',
    currency: draftValue.currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single field descriptor for collaborative editing or readonly
 * proposal preview modes.
 */
function renderField(
  field: FieldDescriptor,
  draft: ProposalDraftFields,
  decisionProfileId: string | null,
  onFieldChange: (key: string, value: unknown) => void,
  t: TranslateFn,
  mode: 'edit-collaborative' | 'preview-version' | 'preview-template',
  previewVersionFragmentContents: Record<string, JSONContent | null>,
  onEditorFocus?: (editor: Editor) => void,
  onEditorBlur?: (editor: Editor) => void,
): React.ReactNode {
  const { key, format, schema } = field;
  const isReadonlyMode = mode !== 'edit-collaborative';
  const previewContent = previewVersionFragmentContents[key];

  // -- Title ------------------------------------------------------------------

  if (key === 'title') {
    if (isReadonlyMode) {
      return (
        <ReadonlyTitleField
          title={schema.title ?? t('Proposal name')}
          required={field.required}
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
        title={schema.title ?? t('Proposal name')}
        required={field.required}
        // No template sets one, and past `profiles.name`'s varchar(256) the
        // insert fails. A template may ask for less, never more.
        maxLength={Math.min(
          schema.maxLength ?? PROPOSAL_TITLE_MAX_LENGTH,
          PROPOSAL_TITLE_MAX_LENGTH,
        )}
        placeholder={t('Untitled Proposal')}
        onChange={(value) => onFieldChange('title', value)}
      />
    );
  }

  // -- Category (system) ------------------------------------------------------

  if (key === 'category') {
    const options = extractOptions(schema);
    const isMultipleSelection = schemaAllowsMultipleSelection(schema);
    const categoryLabel = schema.title ?? t('Select a category');

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
          title={categoryLabel}
          required={field.required}
          placeholder={t('Select category')}
        />
      );
    }

    // District categories are auto-assigned from the proposal's location, so
    // they are hidden from the picker but kept in the schema (and in the
    // readonly display above) so auto-filled values still validate and render.
    const selectableOptions = options.filter(
      (opt) => !isDistrictCategoryLabel(opt.label),
    );

    if (isMultipleSelection) {
      return (
        <CollaborativeMultiSelectField
          options={selectableOptions}
          initialValue={draft.category}
          onChange={(value) => onFieldChange('category', value)}
          fragmentName="category"
          title={categoryLabel}
          description={schema.description ?? t('Select all that apply')}
          required={field.required}
        />
      );
    }

    return (
      <CollaborativeDropdownField
        options={selectableOptions}
        initialValue={draft.category[0] ?? null}
        onChange={(value) => onFieldChange('category', value)}
        fragmentName="category"
        title={categoryLabel}
        description={schema.description}
        allowEmpty={!field.required}
        required={field.required}
      />
    );
  }

  // -- Budget (system) --------------------------------------------------------

  if (key === 'budget') {
    if (isReadonlyMode) {
      return (
        <ReadonlyBudgetField
          value={getPreviewBudgetValue({
            mode,
            draftValue: draft.budget,
            previewContent,
          })}
          title={schema.title ?? t('Funding amount')}
          description={schema.description}
          required={field.required}
          placeholder={t('Add budget')}
        />
      );
    }

    return (
      <CollaborativeBudgetField
        title={schema.title ?? t('Funding amount')}
        description={schema.description}
        required={field.required}
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

    case 'money': {
      if (isReadonlyMode) {
        return (
          <ReadonlyBudgetField
            value={getPreviewBudgetValue({
              mode,
              draftValue: (draft[key] as ProposalDraftFields['budget']) ?? null,
              previewContent,
            })}
            title={schema.title ?? t('Funding amount')}
            description={schema.description}
            required={field.required}
            placeholder={t('Add budget')}
          />
        );
      }

      return (
        <CollaborativeBudgetField
          title={schema.title ?? t('Funding amount')}
          description={schema.description}
          required={field.required}
          minAmount={schema.minimum}
          maxAmount={schema.maximum}
          initialValue={null}
          onChange={(value) => onFieldChange(key, value)}
        />
      );
    }

    case 'location': {
      if (isReadonlyMode) {
        const location =
          mode === 'preview-version'
            ? parsePreviewLocation(previewContent)
            : ((draft[key] as ProposalDraftFields['location']) ?? undefined);

        return (
          <LabeledFieldSet
            legend={schema.title ?? t('Location')}
            description={schema.description}
            required={field.required}
            data-testid={`field-${key}`}
          >
            <LocationMapView value={location ?? null} />
          </LabeledFieldSet>
        );
      }

      return (
        // fieldset/legend rather than a label: the control is a group (address
        // search + map + "use my location"), and each part carries its own
        // accessible name.
        <LabeledFieldSet
          legend={schema.title ?? t('Location')}
          description={schema.description}
          required={field.required}
          data-testid={`field-${key}`}
        >
          <CollaborativeLocationField
            initialValue={
              (draft[key] as ProposalDraftFields['location']) ?? null
            }
            profileId={decisionProfileId}
            defaultMapView={schema['x-map-default']}
            onChange={(value) => onFieldChange(key, value)}
          />
        </LabeledFieldSet>
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
            title={schema.title ?? t('Select option')}
            description={schema.description}
            required={field.required}
            placeholder={t('Select option')}
          />
        );
      }

      // Radio option boxes per the design — every option is on screen, so 20
      // categories means 20 stacked boxes. No collapse-to-combobox threshold.
      return (
        <CollaborativeDropdownField
          options={options}
          initialValue={(draft[key] as string | null) ?? null}
          onChange={(value) => onFieldChange(key, value)}
          fragmentName={key}
          title={schema.title ?? t('Select option')}
          description={schema.description}
          allowEmpty={!field.required}
          required={field.required}
        />
      );
    }

    default: {
      logger.warn(`Unimplemented x-format "${format}" for field "${key}"`);
      return null;
    }
  }
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
 * Layout: one flat stack of labeled fields at the form's field gap — title,
 * budget, category, then the dynamic template fields in schema order.
 */
export function ProposalFormRenderer({
  fields,
  draft,
  decisionProfileId,
  onFieldChange,
  onEditorFocus,
  onEditorBlur,
  mode = 'edit-collaborative',
  previewVersionFragmentContents = {},
}: ProposalFormRendererProps) {
  const t = useTranslations();
  const gisMapsEnabled = useFeatureFlag('gis_maps');

  const titleField = fields.find((f) => f.key === 'title');
  const categoryField = fields.find((f) => f.key === 'category');
  const budgetField = fields.find((f) => f.key === 'budget');
  // The location field lives behind the `gis_maps` flag.
  const dynamicFields = fields.filter(
    (f) => !f.isSystem && (gisMapsEnabled || f.format !== 'location'),
  );

  const render = (field: FieldDescriptor) =>
    renderField(
      field,
      draft,
      decisionProfileId,
      onFieldChange,
      t,
      mode,
      previewVersionFragmentContents,
      onEditorFocus,
      onEditorBlur,
    );

  return (
    <div className="flex flex-col gap-8">
      {titleField && render(titleField)}

      {/* One flat stack at the form's field gap — every field is now a labeled
          control of the same weight, so budget/category no longer sit in a
          tighter sub-cluster. */}
      {budgetField && render(budgetField)}
      {categoryField && render(categoryField)}

      {dynamicFields.map((field) => (
        <div key={field.key}>{render(field)}</div>
      ))}
    </div>
  );
}
