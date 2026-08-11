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
 * Minimal reader for the fully-quoted CSV `csv-stringify` emits under
 * `{ quoted: true }`. Hand-rolled because the repo has no CSV *parser*
 * dependency, and splitting on a delimiter mis-aligns columns the moment a
 * value contains a comma or newline — which proposal text routinely does.
 */
const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

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
