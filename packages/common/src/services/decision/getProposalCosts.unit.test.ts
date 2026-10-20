import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./getProposalDocumentsContent', () => ({
  getProposalDocumentsContent: vi.fn(),
}));

import type { AmountUnit } from './fieldUnit';
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

  it('defers a zero document value to the snapshot', async () => {
    getDocuments.mockResolvedValue(
      new Map<string, ProposalDocumentContent>([
        ['a', { type: 'json', fragments: { cost: fragment('0') } }],
      ]),
    );

    const costs = await getProposalCosts({
      proposals: [
        { id: 'a', proposalData: { cost: 3 } },
        { id: 'b', proposalData: {} },
      ],
      proposalTemplate: template,
      voterCostField: 'cost',
      unit: DOTS,
    });

    expect(costs.get('a')).toBe(3);
    expect(costs.get('b')).toBeNull();
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
