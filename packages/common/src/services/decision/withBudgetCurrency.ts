import {
  type MappingInput,
  type MappingResult,
  type SchemaMapping,
  type SchemaRef,
  isSameSchemaRef,
} from '../../schemaMapping';
import { readOwnField } from '../../schemaMapping/fieldPath';

/**
 * An `add` rule gives `budget` a plain number. Its currency is the `currency`
 * next to each amount the rule read; with none, or two, there is no budget.
 */
export const withBudgetCurrency = ({
  result,
  mappings,
  inputs,
  targetSchema,
}: {
  result: MappingResult;
  mappings: SchemaMapping[];
  inputs: MappingInput[];
  targetSchema: SchemaRef;
}): MappingResult => {
  const operands = mappings
    .filter((mapping) =>
      isSameSchemaRef({ left: mapping.to, right: targetSchema }),
    )
    .flatMap((mapping) =>
      mapping.fields.flatMap(({ from, to }) =>
        to !== 'budget' || typeof from === 'string'
          ? []
          : inputs
              .filter((input) =>
                isSameSchemaRef({ left: input.schema, right: mapping.from }),
              )
              .flatMap(({ data }) =>
                from.operands.map(({ field }) => ({
                  amount: readOwnField({ data, path: field }),
                  parent: readParentField({ data, path: field }),
                })),
              ),
      ),
    );
  if (operands.every(({ amount }) => amount === undefined)) {
    return result;
  }

  // A cost field without an amount, such as a plain number, has no currency.
  const [currency, ...otherCurrencies] = new Set(
    operands
      .filter(
        ({ parent }) =>
          parent !== undefined && parent !== null && parent !== '',
      )
      .map(({ parent }) => readOwnField({ data: parent, path: 'currency' })),
  );
  const { budget: amount, ...dataWithoutBudget } = result.data;
  if (
    typeof amount !== 'number' ||
    typeof currency !== 'string' ||
    currency === '' ||
    otherCurrencies.length > 0
  ) {
    return { data: dataWithoutBudget };
  }
  return { data: { ...dataWithoutBudget, budget: { amount, currency } } };
};

const readParentField = ({
  data,
  path,
}: {
  data: unknown;
  path: string;
}): unknown => {
  const separator = path.lastIndexOf('.');
  return separator === -1
    ? data
    : readOwnField({ data, path: path.slice(0, separator) });
};
