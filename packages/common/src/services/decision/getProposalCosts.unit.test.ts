import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./getProposalDocumentsContent', () => ({
  getProposalDocumentsContent: vi.fn(),
}));

import type { AmountUnit } from '@op/types/amountUnit';

import { getProposalCosts } from './getProposalCosts';
import {
  type ProposalDocumentContent,
  getProposalDocumentsContent,
} from './getProposalDocumentsContent';
import type { ProposalTemplateSchema } from './types';

const USD: AmountUnit = { kind: 'currency', code: 'USD' };
const DOTS: AmountUnit = { kind: 'custom', label: 'dots' };

const template: ProposalTemplateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    budget: {
      type: 'object',
      'x-format': 'money',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
      },
    },
    cost: { type: 'number', 'x-unit': DOTS },
  },
};

const getDocuments = vi.mocked(getProposalDocumentsContent);

const fragment = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('getProposalCosts', () => {
  beforeEach(() => {
    getDocuments.mockReset();
    getDocuments.mockResolvedValue(new Map());
  });

  it('reads the named field from the snapshot when there is no document', async () => {
    const costs = await getProposalCosts({
      proposals: [
        { id: 'a', proposalData: { budget: { amount: 300, currency: 'USD' } } },
        { id: 'b', proposalData: { cost: 4 } },
        { id: 'c', proposalData: {} },
      ],
      proposalTemplate: template,
      voterCostField: 'budget',
      unit: USD,
    });

    expect([...costs]).toEqual([
      ['a', 300],
      ['b', null],
      ['c', null],
    ]);
  });

  it('charges a numeric cost field in its own unit', async () => {
    const costs = await getProposalCosts({
      proposals: [
        {
          id: 'a',
          proposalData: { budget: { amount: 900, currency: 'USD' }, cost: 2 },
        },
      ],
      proposalTemplate: template,
      voterCostField: 'cost',
      unit: DOTS,
    });

    expect(costs.get('a')).toBe(2);
  });

  it('prefers the live document value over the snapshot', async () => {
    getDocuments.mockResolvedValue(
      new Map<string, ProposalDocumentContent>([
        ['a', { type: 'json', fragments: { cost: fragment('5') } }],
        [
          'b',
          {
            type: 'json',
            fragments: {
              budget: fragment(
                JSON.stringify({ amount: 900, currency: 'USD' }),
              ),
            },
          },
        ],
      ]),
    );

    expect(
      (
        await getProposalCosts({
          proposals: [{ id: 'a', proposalData: { cost: 2 } }],
          proposalTemplate: template,
          voterCostField: 'cost',
          unit: DOTS,
        })
      ).get('a'),
    ).toBe(5);

    expect(
      (
        await getProposalCosts({
          proposals: [
            {
              id: 'b',
              proposalData: { budget: { amount: 100, currency: 'USD' } },
            },
          ],
          proposalTemplate: template,
          voterCostField: 'budget',
          unit: USD,
        })
      ).get('b'),
    ).toBe(900);
  });

  it('treats the document as the source of truth once it is read', async () => {
    getDocuments.mockResolvedValue(
      new Map<string, ProposalDocumentContent>([
        ['zero', { type: 'json', fragments: { cost: fragment('0') } }],
        ['cleared', { type: 'json', fragments: {} }],
      ]),
    );

    const costs = await getProposalCosts({
      proposals: [
        { id: 'zero', proposalData: { cost: 3 } },
        { id: 'cleared', proposalData: { cost: 3 } },
      ],
      proposalTemplate: template,
      voterCostField: 'cost',
      unit: DOTS,
    });

    expect([...costs]).toEqual([
      ['zero', 0],
      ['cleared', null],
    ]);
  });

  it('rejects the ballot when a document cost is filled in but not an amount', async () => {
    getDocuments.mockResolvedValue(
      new Map<string, ProposalDocumentContent>([
        ['a', { type: 'json', fragments: { budget: fragment('lots') } }],
      ]),
    );

    await expect(
      getProposalCosts({
        proposals: [
          {
            id: 'a',
            proposalData: {
              title: 'Community garden',
              budget: { amount: 100, currency: 'USD' },
            },
          },
        ],
        proposalTemplate: template,
        voterCostField: 'budget',
        unit: USD,
      }),
    ).rejects.toThrow('The budget of "Community garden" is not a valid amount');
  });

  it('rejects the ballot when a snapshot cost is filled in but not an amount', async () => {
    await expect(
      getProposalCosts({
        proposals: [{ id: 'a', proposalData: { cost: 'three' } }],
        proposalTemplate: template,
        voterCostField: 'cost',
        unit: DOTS,
      }),
    ).rejects.toThrow('The cost of "a" is not a valid amount');
  });

  it('charges the field the rules name by ID when two fields share a title', async () => {
    const sharedTitles: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        f1a2b3c4: { type: 'number', title: 'Cost', 'x-unit': DOTS },
        f9e8d7c6: { type: 'number', title: 'Cost', 'x-unit': DOTS },
      },
    };

    const costs = await getProposalCosts({
      proposals: [{ id: 'a', proposalData: { f1a2b3c4: 1, f9e8d7c6: 4 } }],
      proposalTemplate: sharedTitles,
      voterCostField: 'f9e8d7c6',
      unit: DOTS,
    });

    expect(costs.get('a')).toBe(4);

    await expect(
      getProposalCosts({
        proposals: [{ id: 'b', proposalData: { f9e8d7c6: 'four' } }],
        proposalTemplate: sharedTitles,
        voterCostField: 'f9e8d7c6',
        unit: DOTS,
      }),
    ).rejects.toThrow('The Cost of "b" is not a valid amount');
  });

  it('charges nothing for a blank cost', async () => {
    const costs = await getProposalCosts({
      proposals: [{ id: 'a', proposalData: { cost: '  ' } }],
      proposalTemplate: template,
      voterCostField: 'cost',
      unit: DOTS,
    });

    expect(costs.get('a')).toBeNull();
  });

  it('rejects the ballot when a document cannot be read', async () => {
    getDocuments.mockResolvedValue(
      new Map<string, ProposalDocumentContent>([
        ['a', { type: 'unavailable' }],
      ]),
    );

    await expect(
      getProposalCosts({
        proposals: [
          {
            id: 'a',
            proposalData: { budget: { amount: 100, currency: 'USD' } },
          },
        ],
        proposalTemplate: template,
        voterCostField: 'budget',
        unit: USD,
      }),
    ).rejects.toThrow('Could not read the current cost');
    expect(getDocuments).toHaveBeenCalledWith(expect.any(Array), {
      onFetchError: 'unavailable',
    });
  });

  it('does not charge a value stored in another currency', async () => {
    const costs = await getProposalCosts({
      proposals: [
        { id: 'a', proposalData: { budget: { amount: 300, currency: 'EUR' } } },
      ],
      proposalTemplate: template,
      voterCostField: 'budget',
      unit: USD,
    });

    expect(costs.get('a')).toBeNull();
  });
});
