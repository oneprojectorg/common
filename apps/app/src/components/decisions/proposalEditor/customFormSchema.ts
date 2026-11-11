import type { XFormatPropertySchema } from '@op/common/client';

/** Keys of `properties` ordered by `x-field-order`, then any it omits. Orders
 *  a form's fields and a grid's rows. */
export function getFieldOrder(
  definition: Pick<XFormatPropertySchema, 'properties' | 'x-field-order'>,
): string[] {
  const properties = definition.properties ?? {};
  const ordered = definition['x-field-order'] ?? [];
  return [
    ...ordered.filter((key) => properties[key]),
    ...Object.keys(properties).filter((key) => !ordered.includes(key)),
  ];
}

/** Rows ordered by the grid's own `x-field-order`, then any it omits. */
export function readGridRows(
  field: XFormatPropertySchema,
): { key: string; title: string }[] {
  return getFieldOrder(field).map((key) => {
    const row = field.properties?.[key];
    const title = typeof row === 'object' ? row.title : undefined;
    return { key, title: title || key };
  });
}

/** The columns are the first row's choices; the builder gives every row the
 *  same ones. */
export function readGridColumns(field: XFormatPropertySchema): string[] {
  const firstRow = Object.values(field.properties ?? {}).find(
    (row) => typeof row === 'object',
  );
  return typeof firstRow === 'object' ? readEnumOptions(firstRow.enum) : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readEnumOptions(candidate: unknown): string[] {
  return Array.isArray(candidate)
    ? candidate.filter((option): option is string => typeof option === 'string')
    : [];
}
