'use client';

import { linkifyText } from '@/utils/linkDetection';
import type { XFormatPropertySchema } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { screens } from '@op/styles/constants';
import { useId } from 'react';

import { EnumSelectField } from './EnumSelectField';
import { isRecord, readGridColumns, readGridRows } from './customFormSchema';
import type { CustomFormTranslation } from './useTranslateCustomForm';

/** The value is `{ [rowKey]: column }`, absent when no row is answered so
 *  `required` treats the grid as missing. */
export function GridField({
  name,
  field,
  value,
  errors,
  isRequired,
  translation,
  onChange,
}: {
  name: string;
  field: XFormatPropertySchema;
  value: unknown;
  /** Every message in the form; a row's is keyed `<field>.<row>`. */
  errors: Record<string, string>;
  isRequired: boolean;
  /** The form's translated text. Omit to show the authored text. */
  translation?: CustomFormTranslation;
  onChange: (value: unknown) => void;
}) {
  const fieldId = useId();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
  const description = linkifyText(
    translation?.fieldDescriptions[name] ?? field.description,
  );
  const rows = readGridRows(field);
  const columns = readGridColumns(field);
  const answers = isRecord(value) ? value : {};
  const error = errors[name];

  const handleRowChange = (rowKey: string, next: unknown) => {
    const { [rowKey]: _previous, ...otherAnswers } = answers;
    const nextAnswers =
      typeof next === 'string' && next !== ''
        ? { ...otherAnswers, [rowKey]: next }
        : otherAnswers;
    onChange(Object.keys(nextAnswers).length > 0 ? nextAnswers : undefined);
  };

  return (
    <FieldSet>
      <FieldLegend variant="label">
        <bdi>{translation?.fieldTitles[name] ?? field.title ?? name}</bdi>
        {isRequired ? <RequiredAsterisk /> : null}
      </FieldLegend>
      {description ? (
        <FieldDescription>
          <bdi>{description}</bdi>
        </FieldDescription>
      ) : null}
      {isMobile ? null : (
        <div aria-hidden className="flex items-end gap-1">
          <span className="w-1/3 shrink-0" />
          {columns.map((column) => (
            <span key={column} className="flex-1 text-center">
              <bdi>{column}</bdi>
            </span>
          ))}
        </div>
      )}
      {rows.map((row) => {
        const rowId = `${fieldId}-${row.key}`;
        const rowError = errors[`${name}.${row.key}`];
        const selected = answers[row.key];
        const selectedColumn = typeof selected === 'string' ? selected : null;
        const isRowRequired =
          Array.isArray(field.required) && field.required.includes(row.key);

        if (isMobile) {
          return (
            <EnumSelectField
              key={row.key}
              fieldId={rowId}
              label={<bdi>{row.title}</bdi>}
              error={rowError}
              isRequired={isRowRequired}
              options={columns.map((column) => ({
                value: column,
                label: column,
              }))}
              value={selectedColumn}
              onChange={(next) => handleRowChange(row.key, next)}
            />
          );
        }

        return (
          <Field key={row.key} data-invalid={Boolean(rowError)}>
            <div className="flex items-center gap-1">
              <span id={rowId} className="w-1/3 shrink-0">
                <bdi>{row.title}</bdi>
                {isRowRequired ? <RequiredAsterisk /> : null}
              </span>
              <RadioGroup
                aria-labelledby={rowId}
                value={selectedColumn}
                onValueChange={(next) => handleRowChange(row.key, next)}
                required={isRowRequired}
                aria-invalid={Boolean(rowError)}
                className="flex flex-1 flex-row gap-1"
              >
                {columns.map((column) => (
                  <div key={column} className="flex flex-1 justify-center">
                    <RadioGroupItem value={column} aria-label={column} />
                  </div>
                ))}
              </RadioGroup>
            </div>
            {rowError ? <FieldError>{rowError}</FieldError> : null}
          </Field>
        );
      })}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
}
