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

describe('generateProposalsCsv budget/category/location columns', () => {
  const templateWithResolvableFields: ProposalTemplateSchema = {
    ...template,
    properties: {
      ...template.properties,
      category: {
        type: 'string',
        title: 'Category',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'Housing', title: 'Housing' },
          { const: 'Transit', title: 'Transit' },
        ],
      },
      location: { type: 'object', title: 'Location', 'x-format': 'location' },
    },
  };

  // Legacy numeric budget schema: it can only ever resolve a bare amount
  // (no currency), and a fragment that fails to parse into a real amount
  // resolves to `0` via `extractBudgetValue` — the same value a
  // genuinely-zero budget would produce.
  const templateWithLegacyBudget: ProposalTemplateSchema = {
    ...template,
    properties: {
      ...template.properties,
      budget: { type: 'number', title: 'Budget', 'x-format': 'money' },
    },
  };

  it('resolves budget/category/location from the live document over a stale snapshot', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithResolvableFields,
        proposalData: {
          category: ['Housing'],
          budget: { amount: 100, currency: 'USD' },
          location: { lat: 1, lng: 1, address: 'Old address' },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            budget: paragraph('{"amount":5000,"currency":"USD"}'),
            category: paragraph('Transit'),
            location: paragraph(
              '{"lat":41.5,"lng":-81.6,"address":"456 Elm St"}',
            ),
          },
        },
      }),
    ]);

    const row = parseSingleRow(csv);
    expect(row.Budget).toBe('5000');
    expect(row.Categories).toBe('Transit');
    expect(row.Address).toBe('456 Elm St');
    expect(row.Latitude).toBe('41.5');
    expect(row.Longitude).toBe('-81.6');
  });

  it('keeps the snapshot values when the template has no matching fields', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalData: {
          category: ['Housing'],
          budget: { amount: 100, currency: 'USD' },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
          },
        },
      }),
    ]);

    const row = parseSingleRow(csv);
    expect(row.Budget).toBe('100');
    expect(row.Categories).toBe('Housing');
  });

  it('keeps the snapshot budget when the document fragment is unparseable', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithResolvableFields,
        proposalData: {
          category: [],
          budget: { amount: 100, currency: 'USD' },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            budget: paragraph('not json'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Budget).toBe('100');
  });

  it('keeps the snapshot categories when the document fragment resolves to a non-list value', async () => {
    const templateWithUntypedCategory: ProposalTemplateSchema = {
      ...template,
      properties: {
        ...template.properties,
        // No `x-format` — the fragment falls through `assembleProposalData`'s
        // generic JSON-parse branch, which can resolve to a number rather
        // than a string or array.
        category: { type: 'string', title: 'Category' },
      },
    };

    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithUntypedCategory,
        proposalData: {
          category: ['Housing'],
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            category: paragraph('42'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Categories).toBe('Housing');
  });

  it('reflects the document when every category is deliberately cleared', async () => {
    const templateWithMultiCategory: ProposalTemplateSchema = {
      ...template,
      properties: {
        ...template.properties,
        category: {
          type: 'array',
          title: 'Category',
          'x-format': 'dropdown',
          items: { type: 'string' },
        },
      },
    };

    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithMultiCategory,
        proposalData: { category: ['Housing'], attachmentIds: [] },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            // A cleared multi-select resolves to a real (non-malformed)
            // empty array, not an absent fragment.
            category: paragraph('[]'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Categories).toBe('');
  });

  it('keeps the snapshot budget when a legacy numeric field resolves to the ambiguous zero sentinel', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithLegacyBudget,
        proposalData: {
          category: [],
          budget: { amount: 5000, currency: 'USD' },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            budget: paragraph('null'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Budget).toBe('5000');
  });

  it('keeps the snapshot currency when a legacy numeric field resolves a new amount', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithLegacyBudget,
        proposalData: {
          category: [],
          budget: { amount: 100, currency: 'EUR' },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            budget: paragraph('500'),
          },
        },
      }),
    ]);

    const row = parseSingleRow(csv);
    expect(row.Budget).toBe('500');
    expect(row.Currency).toBe('EUR');
  });

  it('adopts a moved pin while keeping the old address until it re-geocodes', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithResolvableFields,
        proposalData: {
          category: [],
          // A previously-geocoded place — `placeLat`/`placeLng` pin the old
          // point and `getPlaceCoordinates` prefers them over `lat`/`lng`,
          // so they must not survive into the moved-pin result below.
          location: {
            lat: 1,
            lng: 1,
            address: '456 Elm St',
            placeLat: 1,
            placeLng: 1,
          },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            // No address — a pin dropped before the async reverse-geocode
            // resolved, or one that never matched.
            location: paragraph('{"lat":41.5,"lng":-81.6}'),
          },
        },
      }),
    ]);

    const row = parseSingleRow(csv);
    expect(row.Address).toBe('456 Elm St');
    expect(row.Latitude).toBe('41.5');
    expect(row.Longitude).toBe('-81.6');
  });

  it('keeps the old address when the document resolves a place id but no address', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithResolvableFields,
        proposalData: {
          category: [],
          location: { lat: 1, lng: 1, address: '456 Elm St' },
          attachmentIds: [],
        },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            location: paragraph(
              '{"lat":41.5,"lng":-81.6,"placeId":"place-123"}',
            ),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv).Address).toBe('456 Elm St');
  });
});

describe('generateProposalsCsv custom template fields', () => {
  /**
   * A process author added a "Priority Level" dropdown and a "Volunteer
   * Stipend" money field on top of the default title/summary/budget
   * fields — the "process that has multiple parts to their template"
   * shape reported as broken: any template field beyond the fixed
   * title/description/budget/category/location set had no column at all,
   * so its value never made it into the export.
   */
  const templateWithCustomFields: ProposalTemplateSchema = {
    ...template,
    properties: {
      ...template.properties,
      priority: {
        type: 'string',
        title: 'Priority Level',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'high', title: 'High' },
          { const: 'low', title: 'Low' },
        ],
      },
      stipend: {
        type: 'object',
        title: 'Volunteer Stipend',
        'x-format': 'money',
      },
    },
    'x-field-order': ['title', 'budget', 'summary', 'priority', 'stipend'],
  };

  it('exports a custom dropdown field resolved from the live document', async () => {
    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithCustomFields,
        proposalData: { category: [], attachmentIds: [] },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            priority: paragraph('high'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv)['Priority Level']).toBe('High');
  });

  it('falls back to the snapshot for a custom field with no document fragment', async () => {
    // Custom template fields aren't known `ProposalData` keys, so this can't
    // be a plain object literal without failing the excess-property check;
    // `Object.assign` builds the same shape without tripping it.
    const proposalDataWithStipend = Object.assign(
      { category: [], attachmentIds: [] },
      { stipend: { amount: 250, currency: 'USD' } },
    );

    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithCustomFields,
        proposalData: proposalDataWithStipend,
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv)['Volunteer Stipend']).toBe('250 USD');
  });

  it('disambiguates a custom field header that collides with a fixed column', async () => {
    const templateWithStatusField: ProposalTemplateSchema = {
      ...template,
      properties: {
        ...template.properties,
        status: {
          type: 'string',
          title: 'Status',
          'x-format': 'dropdown',
          oneOf: [{ const: 'green', title: 'Green' }],
        },
      },
      'x-field-order': ['title', 'budget', 'summary', 'status'],
    };

    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithStatusField,
        proposalData: { category: [], attachmentIds: [] },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            status: paragraph('green'),
          },
        },
      }),
    ]);

    const [headers = [], values = []] = parseCsv(csv.trim());
    // The real proposal status ("submitted") keeps the plain "Status"
    // header; the custom field that happens to share that title must not
    // silently overwrite it in a header-keyed reader.
    expect(values[headers.indexOf('Status')]).toBe('submitted');
    expect(values[headers.indexOf('Status (status)')]).toBe('Green');
  });

  it('disambiguates two custom fields that share the same display title', async () => {
    const templateWithDuplicateTitles: ProposalTemplateSchema = {
      ...template,
      properties: {
        ...template.properties,
        notesA: {
          type: 'string',
          title: 'Notes',
          'x-format': 'dropdown',
          oneOf: [{ const: 'a', title: 'Option A' }],
        },
        notesB: {
          type: 'string',
          title: 'Notes',
          'x-format': 'dropdown',
          oneOf: [{ const: 'b', title: 'Option B' }],
        },
      },
      'x-field-order': ['title', 'budget', 'summary', 'notesA', 'notesB'],
    };

    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithDuplicateTitles,
        proposalData: { category: [], attachmentIds: [] },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            notesA: paragraph('a'),
            notesB: paragraph('b'),
          },
        },
      }),
    ]);

    const [headers = [], values = []] = parseCsv(csv.trim());
    expect(values[headers.indexOf('Notes')]).toBe('Option A');
    expect(values[headers.indexOf('Notes (notesB)')]).toBe('Option B');
  });

  it('resolves a numeric-looking option const to its display title', async () => {
    const templateWithRadioField: ProposalTemplateSchema = {
      ...template,
      properties: {
        ...template.properties,
        likelihood: {
          type: 'string',
          title: 'Likelihood to recommend',
          'x-format': 'radio',
          oneOf: [{ const: '5', title: 'Extremely likely' }],
        },
      },
      'x-field-order': ['title', 'budget', 'summary', 'likelihood'],
    };

    const csv = await generateProposalsCsv([
      makeProposal({
        proposalTemplate: templateWithRadioField,
        proposalData: { category: [], attachmentIds: [] },
        documentContent: {
          type: 'json',
          fragments: {
            summary: paragraph('Protected lanes from 1st to 9th.'),
            likelihood: paragraph('5'),
          },
        },
      }),
    ]);

    expect(parseSingleRow(csv)['Likelihood to recommend']).toBe(
      'Extremely likely',
    );
  });
});
