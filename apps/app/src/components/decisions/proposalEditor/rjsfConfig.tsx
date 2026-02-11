import type {
  FieldProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  ValidatorType,
  WidgetProps,
} from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { ErrorBoundary } from 'react-error-boundary';

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
 * Reads `oneOf` from the property schema to derive selectable options.
 *
 * NOTE: `x-format: 'category'` may be replaced by a generic select/enum
 * widget in the future.
 */
function CollaborativeCategoryRjsfField(props: FieldProps) {
  const options = Array.isArray(props.schema.oneOf)
    ? props.schema.oneOf
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
      options={options}
      initialValue={(props.formData as string | null) ?? null}
      onChange={(value) => props.onChange(value)}
    />
  );
}

/**
 * RJSF custom field: collaborative budget input.
 * Reads `maximum` from the property schema for the budget cap.
 */
function CollaborativeBudgetRjsfField(props: FieldProps) {
  return (
    <CollaborativeBudgetField
      maxAmount={props.schema.maximum}
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

/** Wrapper that catches render errors from the collaborative text widget. */
function SafeCollaborativeTextWidget(props: WidgetProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="rounded border border-functional-red/20 bg-functional-red/5 p-3">
          <p className="text-sm text-functional-red">
            Error rendering text field
          </p>
          <p className="mt-1 text-xs text-neutral-gray4">
            Field: {props.schema?.title || 'Unknown'}
          </p>
        </div>
      }
      onError={(error, info) => {
        console.error(
          `[CollaborativeTextWidget] ${props.schema?.title ?? 'unknown'}:`,
          error,
          info,
        );
      }}
    >
      <CollaborativeTextWidget {...props} />
    </ErrorBoundary>
  );
}

export const RJSF_WIDGETS = {
  CollaborativeText: SafeCollaborativeTextWidget,
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

      {dynamicProps.map((prop) => (
        <div key={prop.name}>{prop.content}</div>
      ))}
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
