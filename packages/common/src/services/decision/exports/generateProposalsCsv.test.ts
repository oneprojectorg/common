import { describe, expect, it } from 'vitest';

import { generateProposalsCsv } from './generateProposalsCsv';

type ProposalArg = Parameters<typeof generateProposalsCsv>[0][number];

function proposalRow(overrides: Record<string, unknown>): ProposalArg {
  return {
    id: 'proposal-1',
    profileId: 'profile-1',
    status: 'submitted',
    profile: { name: 'A proposal' },
    // Every `listProposals` row carries this, already resolved through the
    // full precedence — the export reads it rather than resolving again.
    budgetCurrency: 'EUR',
    ...overrides,
  } as unknown as ProposalArg;
}

/** The header line plus the first data row, split into fields. */
function firstRow(csv: string): Record<string, string> {
  const [header, row] = csv.trim().split('\n');
  const unquote = (line: string) =>
    line.split(',').map((cell) => cell.replace(/^"|"$/g, ''));
  return Object.fromEntries(
    unquote(header ?? '').map((key, i) => [key, unquote(row ?? '')[i] ?? '']),
  );
}

describe('generateProposalsCsv budget columns', () => {
  it("gives a currency-less budget the process's currency", async () => {
    // A bare amount with an empty Currency column can't be reconstructed by
    // whoever opens the spreadsheet, and defaulting it to USD misreports a
    // EUR-denominated process outright.
    const csv = await generateProposalsCsv([
      proposalRow({ proposalData: { budget: { amount: 5000 } } }),
    ]);

    expect(firstRow(csv)).toMatchObject({ Budget: '5000', Currency: 'EUR' });
  });

  it("exports the row's resolved currency, not one re-derived here", async () => {
    // The stored budget names no currency; the row resolved GBP. The export
    // has to ship the answer the card shipped, not re-derive one — two copies
    // of the precedence rule are two things to keep in step.
    const csv = await generateProposalsCsv([
      proposalRow({
        budgetCurrency: 'GBP',
        proposalData: { budget: { amount: 5000 } },
      }),
    ]);

    expect(firstRow(csv)).toMatchObject({ Budget: '5000', Currency: 'GBP' });
  });

  it('exports a string-amount budget rather than dropping it', async () => {
    // Imported rows carry `{"amount":"5000"}`. The schema used to reject the
    // shape outright, so the export shipped an empty Budget *and* an empty
    // Currency for a proposal that plainly has both.
    const csv = await generateProposalsCsv([
      proposalRow({
        budgetCurrency: 'GBP',
        proposalData: { budget: { amount: '5000', currency: 'GBP' } },
      }),
    ]);

    expect(firstRow(csv)).toMatchObject({ Budget: '5000', Currency: 'GBP' });
  });

  it('leaves both columns empty when there is no budget', async () => {
    const csv = await generateProposalsCsv([proposalRow({ proposalData: {} })]);

    expect(firstRow(csv)).toMatchObject({ Budget: '', Currency: '' });
  });
});
