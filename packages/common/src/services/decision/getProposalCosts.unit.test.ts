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
        {
          id: 'a',
          proposalTemplate: template,
          proposalData: { budget: { amount: 300, currency: 'USD' } },
        },
        { id: 'b', proposalTemplate: template, proposalData: { cost: 4 } },
        { id: 'c', proposalTemplate: template, proposalData: {} },
      ],
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
          proposalTemplate: template,
          proposalData: { budget: { amount: 900, currency: 'USD' }, cost: 2 },
        },
      ],
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
          proposals: [
            { id: 'a', proposalTemplate: template, proposalData: { cost: 2 } },
          ],
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
              proposalTemplate: template,
              proposalData: { budget: { amount: 100, currency: 'USD' } },
            },
          ],
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
        { id: 'zero', proposalTemplate: template, proposalData: { cost: 3 } },
        {
          id: 'cleared',
          proposalTemplate: template,
          proposalData: { cost: 3 },
        },
      ],
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
            proposalTemplate: template,
            proposalData: {
              title: 'Community garden',
              budget: { amount: 100, currency: 'USD' },
            },
          },
        ],
        voterCostField: 'budget',
        unit: USD,
      }),
    ).rejects.toMatchObject({
      name: 'BallotCostError',
      message: expect.stringContaining(
        'The budget of "Community garden" is not a valid amount',
      ),
    });
  });

  it('rejects the ballot when a snapshot cost is filled in but not an amount', async () => {
    await expect(
      getProposalCosts({
        proposals: [
          {
            id: 'a',
            proposalTemplate: template,
            proposalData: { cost: 'three' },
          },
        ],
        voterCostField: 'cost',
        unit: DOTS,
      }),
    ).rejects.toThrow('The cost of "a" is not a valid amount');
  });

  it('charges nothing for a blank cost', async () => {
    const costs = await getProposalCosts({
      proposals: [
        { id: 'a', proposalTemplate: template, proposalData: { cost: '  ' } },
      ],
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
            proposalTemplate: template,
            proposalData: { budget: { amount: 100, currency: 'USD' } },
          },
        ],
        voterCostField: 'budget',
        unit: USD,
      }),
    ).rejects.toThrow('Could not read the current cost');
    expect(getDocuments).toHaveBeenCalledWith(expect.any(Array), {
      onFetchError: 'unavailable',
    });
  });

  it('reads each proposal through its own template', async () => {
    const otherTemplate: ProposalTemplateSchema = {
      type: 'object',
      properties: { cost: { type: 'number', 'x-unit': DOTS } },
    };

    await getProposalCosts({
      proposals: [
        { id: 'a', proposalTemplate: template, proposalData: { cost: 1 } },
        { id: 'b', proposalTemplate: otherTemplate, proposalData: { cost: 2 } },
      ],
      voterCostField: 'cost',
      unit: DOTS,
    });

    expect(getDocuments).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: 'a', proposalTemplate: template }),
        expect.objectContaining({ id: 'b', proposalTemplate: otherTemplate }),
      ],
      { onFetchError: 'unavailable' },
    );
  });

  it('does not charge a value stored in another currency', async () => {
    const costs = await getProposalCosts({
      proposals: [
        {
          id: 'a',
          proposalTemplate: template,
          proposalData: { budget: { amount: 300, currency: 'EUR' } },
        },
      ],
      voterCostField: 'budget',
      unit: USD,
    });

    expect(costs.get('a')).toBeNull();
  });
});
