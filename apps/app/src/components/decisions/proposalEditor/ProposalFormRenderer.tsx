'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { trpc } from '@op/api/client';
import {
  formatProposalCategories,
  parseCategoryFragmentValue,
  parseSchemaOptions,
  schemaAllowsMultipleSelection,
} from '@op/common/client';
import { cn } from '@op/ui/utils';
import type { Editor, JSONContent } from '@tiptap/react';
import { useEffect, useRef } from 'react';

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
import { useCollaborativeDoc } from '../../collaboration/CollaborativeDocContext';
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

    if (isMultipleSelection) {
      return (
        <div className="min-w-0">
          <CollaborativeMultiSelectField
            options={options}
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
        options={options}
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
    if (isReadonlyMode) {
      return (
        <ReadonlyBudgetField
          value={getPreviewBudgetValue({
            mode,
            draftValue: draft.budget,
            previewContent,
          })}
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
            />
            <LocationMapView value={location ?? null} />
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-2">
          <FieldHeader title={schema.title} description={schema.description} />
          <CollaborativeLocationField
            initialValue={
              (draft[key] as ProposalDraftFields['location']) ?? null
            }
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

// ---------------------------------------------------------------------------
// District ⇄ category sync
// ---------------------------------------------------------------------------

interface DistrictCategorySyncProps {
  /** Current location draft value, if the template collects a location. */
  location: ProposalDraftFields['location'] | null | undefined;
  /** Whether the category field allows multiple selections. */
  isMultiple: boolean;
}

/**
 * Headless coordinator that keeps the `category` field in sync with the
 * location's resolved boundary. As soon as a placed pin resolves to a district,
 * that district is applied as a category; when the pin moves to a different
 * district or outside every boundary, the previously-applied district is
 * removed. Manually chosen, non-district categories are preserved (multi-select).
 *
 * Writes the shared `category` fragment directly so the category field — which
 * observes the same fragment — reflects the change and its "required" error
 * clears. Renders nothing.
 */
function DistrictCategorySync({
  location,
  isMultiple,
}: DistrictCategorySyncProps) {
  const { ydoc } = useCollaborativeDoc();
  const point = location ? { lat: location.lat, lng: location.lng } : null;

  const boundaryQuery = trpc.decision.resolveBoundary.useQuery(
    { lat: point?.lat ?? 0, lng: point?.lng ?? 0 },
    { enabled: point != null, staleTime: 60_000 },
  );

  const [categoryText, setCategoryText] = useCollaborativeFragment(
    ydoc,
    'category',
    '',
  );

  const categoryTextRef = useRef(categoryText);
  useEffect(() => {
    categoryTextRef.current = categoryText;
  }, [categoryText]);

  // Only act on a settled lookup: no point at all, or a finished query. Acting
  // while fetching could clear a valid category on a stale/empty response.
  const settled =
    point == null || (boundaryQuery.isSuccess && !boundaryQuery.isFetching);
  const resolvedDistrict =
    point != null ? (boundaryQuery.data?.boundary?.name ?? null) : null;

  const appliedDistrictRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ydoc || !settled) {
      return;
    }

    const previous = appliedDistrictRef.current;
    if (resolvedDistrict === previous) {
      return;
    }

    const current = categoryTextRef.current;
    let next: string;

    if (isMultiple) {
      const values = parseCategoryFragmentValue(current).filter(
        (value) => value !== previous,
      );
      if (resolvedDistrict && !values.includes(resolvedDistrict)) {
        values.push(resolvedDistrict);
      }
      next = JSON.stringify(values);
    } else if (resolvedDistrict) {
      // Single-select: the category is the district — apply it.
      next = resolvedDistrict;
    } else {
      // No district: clear only the district we previously applied.
      next = current === previous ? '' : current;
    }

    appliedDistrictRef.current = resolvedDistrict;

    if (next !== current) {
      setCategoryText(next);
    }
  }, [ydoc, settled, resolvedDistrict, isMultiple, setCategoryText]);

  return null;
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
  onFieldChange,
  onEditorFocus,
  onEditorBlur,
  mode = 'edit-collaborative',
  previewVersionFragmentContents = {},
}: ProposalFormRendererProps) {
  const t = useTranslations();
  const formGapClass = mode === 'preview-template' ? 'gap-4' : 'gap-8';

  const titleField = fields.find((f) => f.key === 'title');
  const categoryField = fields.find((f) => f.key === 'category');
  const budgetField = fields.find((f) => f.key === 'budget');
  const dynamicFields = fields.filter((f) => !f.isSystem);
  const locationField = dynamicFields.find((f) => f.format === 'location');

  const render = (field: FieldDescriptor) =>
    renderField(
      field,
      draft,
      onFieldChange,
      t,
      mode,
      previewVersionFragmentContents,
      onEditorFocus,
      onEditorBlur,
    );

  return (
    <div className={cn('flex flex-col', formGapClass)}>
      {mode === 'edit-collaborative' && categoryField && locationField && (
        <DistrictCategorySync
          location={
            (draft[locationField.key] as ProposalDraftFields['location']) ??
            null
          }
          isMultiple={schemaAllowsMultipleSelection(categoryField.schema)}
        />
      )}

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
