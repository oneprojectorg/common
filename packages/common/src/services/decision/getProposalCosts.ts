import type { AmountUnit } from '@op/types/amountUnit';

import { BallotCostError, CommonError } from '../../utils';
import { getFieldAmount } from './fieldUnit';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveDocumentFieldValues } from './proposalListPreview';
import type { ProposalTemplateSchema } from './types';

export type ProposalCosts = ReadonlyMap<string, number | null>;

/** A proposal's price, or why it has none; left for the caller to throw. */
export type ProposalCostResults = ReadonlyMap<
  string,
  number | null | UnpriceableCostError | ProposalCostUnavailableError
>;

/** One proposal's cost is filled in but cannot be priced; the message is worded for a ballot. */
export class UnpriceableCostError extends BallotCostError {
  constructor(
    readonly field: string,
    readonly proposalTitle: string,
  ) {
    super(
      `The ${field} of "${proposalTitle}" is not a valid amount, so this ballot cannot be priced. Remove it from your ballot, or ask an admin to correct the proposal.`,
    );
  }
}

/** A proposal's document could not be read, so its current cost is unknown. */
export class ProposalCostUnavailableError extends CommonError {
  constructor(readonly proposalTitle: string) {
    super(
      `Could not read the current cost of "${proposalTitle}". Please try again.`,
    );
  }
}

/**
 * Reads the live document; `proposalData` is a snapshot that goes stale on
 * edit. Throws the first proposal's pricing error.
 */
export async function getProposalCosts(
  input: Parameters<typeof priceProposals>[0],
): Promise<ProposalCosts> {
  const results = await priceProposals(input);
  return new Map(
    [...results].map(([id, result]) => {
      if (result instanceof Error) {
        throw result;
      }
      return [id, result];
    }),
  );
}

/** As {@link getProposalCosts}, but hands back each pricing error instead of throwing it. */
export async function priceProposals({
  proposals,
  proposalTemplate,
  voterCostField,
  unit,
  unreadable = 'throw',
  otherUnit = 'free',
}: {
  proposals: Array<{ id: string; proposalData: unknown }>;
  proposalTemplate: ProposalTemplateSchema | null;
  voterCostField: string;
  unit: AmountUnit;
  unreadable?: 'throw' | 'null';
  /**
   * A value in another unit, or a negative amount. A ballot lets it through
   * free; a selection that funds what it picks passes `'throw'`.
   */
  otherUnit?: 'free' | 'throw';
}): Promise<ProposalCostResults> {
  const documentContentMap = await getProposalDocumentsContent(
    proposals.map(({ id, proposalData }) => ({
      id,
      proposalData,
      proposalTemplate,
    })),
    { onFetchError: 'unavailable' },
  );

  return new Map(
    proposals.map(
      ({
        id,
        proposalData,
      }): [
        string,
        number | null | UnpriceableCostError | ProposalCostUnavailableError,
      ] => {
        const documentContent = documentContentMap.get(id);

        // Charging the stale snapshot could let an over-budget ballot through.
        if (documentContent?.type === 'unavailable') {
          if (unreadable === 'null') {
            return [id, null];
          }
          return [
            id,
            new ProposalCostUnavailableError(
              parseProposalData(proposalData).title ?? id,
            ),
          ];
        }

        const value =
          documentContent?.type === 'json'
            ? resolveDocumentFieldValues({
                fragments: documentContent.fragments,
                proposalTemplate,
                keys: [voterCostField],
              })[voterCostField]
            : parseProposalData(proposalData)[voterCostField];
        const amount = getFieldAmount({ value, unit });

        // A cost that is filled in but unreadable must not ride free on a capped ballot.
        const unpriceable =
          amount === null &&
          (otherUnit === 'throw'
            ? isFilledIn(value)
            : typeof value === 'string' && value.trim().length > 0);
        if (unpriceable) {
          if (unreadable === 'null') {
            return [id, null];
          }
          const title = parseProposalData(proposalData).title ?? id;

          return [id, new UnpriceableCostError(voterCostField, title)];
        }

        return [id, amount];
      },
    ),
  );
}

function isFilledIn(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}
