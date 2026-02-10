import type {
  FieldProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  ValidatorType,
} from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';

import {
  CollaborativeBudgetField,
  CollaborativeCategoryField,
  CollaborativeTextWidget,
  CollaborativeTitleField,
} from '../../collaboration';
import type { ProposalFormContext } from './compileProposalSchema';
import { SYSTEM_FIELD_KEYS } from './compileProposalSchema';

// ---------------------------------------------------------------------------
// RJSF custom field wrappers — bridge RJSF <-> collaborative components
// ---------------------------------------------------------------------------

/**
 * RJSF custom field: collaborative proposal title.
 * Renders a TipTap editor bound to the "title" Y.Doc fragment.
 * Calls `props.onChange` on every keystroke so RJSF mirrors the Yjs value.
 */
function CollaborativeTitleRjsfField(props: FieldProps) {
  const placeholder = props.uiSchema?.['ui:placeholder'] as string | undefined;

  return (
    <CollaborativeTitleField
      placeholder={placeholder}
      onChange={(value) => props.onChange(value)}
    />
  );
}

/**
 * RJSF custom field: collaborative category selector.
 * Reads available categories from `formContext`.
 */
function CollaborativeCategoryRjsfField(props: FieldProps) {
  const { categories } = (props.formContext ?? {}) as ProposalFormContext;

  return (
    <CollaborativeCategoryField
      categories={categories}
      initialValue={(props.formData as string | null) ?? null}
      onChange={(value) => props.onChange(value)}
    />
  );
}

/**
 * RJSF custom field: collaborative budget input.
 * Reads `budgetCapAmount` from `formContext`.
 */
function CollaborativeBudgetRjsfField(props: FieldProps) {
  const { budgetCapAmount } = (props.formContext ?? {}) as ProposalFormContext;

  return (
    <CollaborativeBudgetField
      budgetCapAmount={budgetCapAmount}
      initialValue={(props.formData as number | null) ?? null}
      onChange={(value) => props.onChange(value)}
    />
  );
}

// ---------------------------------------------------------------------------
// RJSF registries
// ---------------------------------------------------------------------------

export const RJSF_FIELDS = {
  CollaborativeTitleField: CollaborativeTitleRjsfField,
  CollaborativeCategoryField: CollaborativeCategoryRjsfField,
  CollaborativeBudgetField: CollaborativeBudgetRjsfField,
};

export const RJSF_WIDGETS = {
  CollaborativeText: CollaborativeTextWidget,
};

// ---------------------------------------------------------------------------
// RJSF templates — suppress default chrome, control layout
// ---------------------------------------------------------------------------

/** Suppress RJSF's default label/description — our fields handle their own. */
function FieldTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom object template that renders system fields in the correct layout:
 * - Title at full width
 * - Category + Budget side-by-side in a flex row
 * - All dynamic template fields stacked below
 */
function ObjectFieldTemplate({ properties }: ObjectFieldTemplateProps) {
  const titleProp = properties.find((p) => p.name === 'title');
  const categoryProp = properties.find((p) => p.name === 'category');
  const budgetProp = properties.find((p) => p.name === 'budget');

  const dynamicProps = properties.filter((p) => !SYSTEM_FIELD_KEYS.has(p.name));

  return (
    <div className="space-y-4">
      {titleProp?.content}

      {(categoryProp || budgetProp) && (
        <div className="flex gap-2">
          {categoryProp?.content}
          {budgetProp?.content}
        </div>
      )}

      {dynamicProps.map((prop) => prop.content)}
    </div>
  );
}

export const RJSF_TEMPLATES = { FieldTemplate, ObjectFieldTemplate };

// ---------------------------------------------------------------------------
// Validator — cast once to satisfy RJSF generics
// ---------------------------------------------------------------------------

export const proposalValidator = validator as ValidatorType<
  Record<string, unknown>,
  RJSFSchema,
  ProposalFormContext
>;
