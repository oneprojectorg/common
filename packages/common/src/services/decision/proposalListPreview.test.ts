import { describe, expect, it } from 'vitest';

import type { ProposalDocumentContent } from './getProposalDocumentsContent';
import { buildProposalListPreview } from './proposalListPreview';
import type { ProposalTemplateSchema } from './types';

/** A money template denominated in EUR, as the process builder writes it. */
const eurTemplate = {
  type: 'object',
  properties: {
    budget: {
      type: 'object',
      'x-format': 'money',
      properties: { currency: { type: 'string', default: 'EUR' } },
    },
  },
} as unknown as ProposalTemplateSchema;

/** A collaborative document whose `budget` fragment holds `text`. */
function budgetDoc(text: string): ProposalDocumentContent {
  return {
    type: 'json',
    fragments: {
      budget: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      },
    },
  } as unknown as ProposalDocumentContent;
}

describe('buildProposalListPreview budget currency', () => {
  // Every route that renders a list card reads `budgetCurrency` off the row, so
  // each of these paths has to arrive at the same answer the detail page's
  // client-side walk does — that parity is the whole point of sharing
  // `resolveSystemFieldOverrides` with it.

  it("falls back to the template's currency when there is no document", () => {
    for (const documentContent of [
      undefined,
      { type: 'unavailable' } as const,
    ]) {
      expect(
        buildProposalListPreview({
          documentContent,
          proposalTemplate: eurTemplate,
          storedProposalData: { budget: { amount: 5000 } },
        }).budgetCurrency,
      ).toBe('EUR');
    }
  });

  it('resolves a legacy HTML row from the stored budget', () => {
    // No fragments to read, so the row's own currency is the best tier
    // available — and it outranks the template's.
    expect(
      buildProposalListPreview({
        documentContent: { type: 'html', content: '<p>A proposal</p>' },
        proposalTemplate: eurTemplate,
        storedProposalData: { budget: { amount: 5000, currency: 'GBP' } },
      }).budgetCurrency,
    ).toBe('GBP');
  });

  it('lets the budget fragment outrank the stored row and the template', () => {
    const { systemFieldOverrides, budgetCurrency } = buildProposalListPreview({
      documentContent: budgetDoc('{"amount":7000,"currency":"CAD"}'),
      proposalTemplate: eurTemplate,
      storedProposalData: { budget: { amount: 5000, currency: 'GBP' } },
    });

    expect(budgetCurrency).toBe('CAD');
    expect(systemFieldOverrides.budget).toEqual({
      amount: 7000,
      currency: 'CAD',
    });
  });

  it('gives a currency-less fragment the row’s stored currency', () => {
    // The tier the card would lose if a caller stopped passing
    // `storedProposalData`: the fragment names none, so without the row the
    // template's EUR would win a budget the author denominated in GBP.
    const { systemFieldOverrides, budgetCurrency } = buildProposalListPreview({
      documentContent: budgetDoc('7000'),
      proposalTemplate: eurTemplate,
      storedProposalData: { budget: { amount: 5000, currency: 'GBP' } },
    });

    expect(budgetCurrency).toBe('GBP');
    expect(systemFieldOverrides.budget).toEqual({
      amount: 7000,
      currency: 'GBP',
    });
  });

  it('resolves the template default without a template-less fallback to USD', () => {
    expect(
      buildProposalListPreview({
        documentContent: budgetDoc('7000'),
        proposalTemplate: eurTemplate,
        storedProposalData: {},
      }).budgetCurrency,
    ).toBe('EUR');
  });

  it('falls back to USD only when nothing names a currency', () => {
    expect(
      buildProposalListPreview({
        documentContent: budgetDoc('7000'),
        proposalTemplate: null,
        storedProposalData: {},
      }).budgetCurrency,
    ).toBe('USD');
  });

  it('keeps the resolved currency for a document that carries no budget', () => {
    // An unreadable or absent budget fragment leaves the amount to the stored
    // row, but the currency still has to be right — the card renders the row's
    // budget under it.
    const { systemFieldOverrides, budgetCurrency } = buildProposalListPreview({
      documentContent: budgetDoc('TBD'),
      proposalTemplate: eurTemplate,
      storedProposalData: { budget: { amount: 5000 } },
    });

    expect(budgetCurrency).toBe('EUR');
    expect(systemFieldOverrides.budget).toBeUndefined();
  });
});
