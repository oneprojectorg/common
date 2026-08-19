import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';

import type { listProposals } from '../listProposals';
import type { ProposalTemplateSchema } from '../types';
import { generateProposalsCsv } from './generateProposalsCsv';

type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

/**
 * The Simple Voting template, trimmed to the fields the CSV reads. The long
 * text field is `summary` — there is no `description` property on any current
 * template, which is the crux of the bug these tests pin down.
 */
const template: ProposalTemplateSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      title: 'Proposal title',
      'x-format': 'short-text',
    },
    summary: {
      type: 'string',
      title: 'Proposal summary',
      'x-format': 'long-text',
    },
    budget: { type: 'object', title: 'Budget', 'x-format': 'money' },
  },
  'x-field-order': ['title', 'budget', 'summary'],
  required: ['title', 'summary'],
};

/** A TipTap fragment carrying one paragraph of text. */
const paragraph = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const baseProposal: ProposalFromList = {
  id: 'proposal-1',
  processInstanceId: 'instance-1',
  profileId: 'profile-1',
  status: 'submitted',
  proposalData: { category: [], attachmentIds: [] },
  profile: { name: 'Bike lanes on Main St' },
  submittedBy: { name: 'Ada Lovelace', email: 'ada@example.com' },
  likesCount: 0,
  commentsCount: 0,
  followersCount: 0,
  isLikedByUser: false,
  isFollowedByUser: false,
  isEditable: false,
  isSelected: false,
  isFlagged: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  proposalTemplate: template,
  visibility: 'visible',
  previewText: undefined,
  documentContent: undefined,
};

const makeProposal = (
  overrides: Partial<ProposalFromList> = {},
): ProposalFromList => ({ ...baseProposal, ...overrides });

/**
 * Reads the fully-quoted CSV `csv-stringify` emits under `{ quoted: true }`.
 *
 * Uses `csv-parse` — the sibling of the `csv-stringify` the exporter writes
 * with — rather than splitting on delimiters, which mis-aligns columns the
 * moment a value contains a comma or newline. Proposal text routinely does.
 *
 * Left strict on purpose: a row whose width disagrees with the header is a bug
 * in the generator, and it should fail here rather than quietly shift every
 * column after it and be asserted against as though it were correct.
 */
const parseCsv = (csv: string): string[][] => parse(csv);

/** Parse the single data row out of a generated CSV into a header→value map. */
const parseSingleRow = (csv: string): Record<string, string> => {
  const [headers = [], values = []] = parseCsv(csv.trim());
  return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
};

describe('generateProposalsCsv description column', () => {
  it('exports the summary a templated proposal was submitted with', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        documentContent: {
          type: 'json',
          fragments: {
            title: paragraph('Bike lanes on Main St'),
            summary: paragraph('Protected lanes from 1st to 9th.'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Description).toBe(
      'Protected lanes from 1st to 9th.',
    );
  });

  it('still reads the legacy single `default` fragment', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: null,
        documentContent: {
          type: 'json',
          fragments: { default: paragraph('A legacy untemplated proposal.') },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Description).toBe(
      'A legacy untemplated proposal.',
    );
  });

  it('exports an empty description when the document has no text', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        documentContent: { type: 'json', fragments: {} },
      }),
    ]);

    expect(parseSingleRow(csv).Description).toBe('');
  });
});

describe('generateProposalsCsv submitter columns', () => {
  it('does not include the submitter email, which is PII', async () => {
    const csv = await generateProposalsCsv([makeProposal()]);

    const [headers = []] = parseCsv(csv.trim());
    expect(headers).not.toContain('Submitter Email');
  });
});
