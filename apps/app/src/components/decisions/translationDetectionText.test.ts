import { parseProposalData } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import {
  getOverviewDetectionText,
  getProposalDetectionText,
  getRubricDetectionText,
} from './translationDetectionText';

type ProposalArg = Parameters<typeof getProposalDetectionText>[0];

/**
 * Builds the detection input, so each case states only the fields it tests.
 * `title` and `profileName` are lifted out because they live behind
 * `proposalData` / `profile` on the real payload.
 */
const proposal = ({
  title,
  profileName = '',
  ...rest
}: { title?: string; profileName?: string } & Omit<
  Partial<ProposalArg>,
  'proposalData' | 'profile'
>): ProposalArg => ({
  proposalData: parseProposalData(title ? { title } : {}),
  profile: { name: profileName },
  ...rest,
});

describe('getProposalDetectionText', () => {
  it('strips HTML from every string field', () => {
    const text = getProposalDetectionText(
      proposal({
        htmlContent: {
          title: '<h1>Community Garden</h1>',
          body: '<p>We should plant more trees.</p>',
        },
      }),
    );

    expect(text).toContain('Community Garden');
    expect(text).toContain('We should plant more trees.');
    expect(text).not.toContain('<');
  });

  it('reads text from documentContent (the list payload has no htmlContent)', () => {
    const text = getProposalDetectionText(
      proposal({
        documentContent: {
          type: 'html',
          content: '<p>We should plant more trees in the park.</p>',
        },
      }),
    );

    expect(text).toContain('We should plant more trees in the park.');
    expect(text).not.toContain('<');
  });

  // The list bug: list reads ship no fragments, and previewText is empty for a
  // proposal with no body — leaving the title as the only sample there is.
  it('samples the title when there is no body text', () => {
    const text = getProposalDetectionText(
      proposal({ title: 'Jardín comunitario' }),
    );

    expect(text).toContain('Jardín comunitario');
  });

  it('falls back to the proposal profile name for an untitled proposal', () => {
    const text = getProposalDetectionText(
      proposal({ profileName: 'Huerto del barrio' }),
    );

    expect(text).toContain('Huerto del barrio');
  });

  it('samples the title alongside the body', () => {
    const text = getProposalDetectionText(
      proposal({
        title: 'Jardín comunitario',
        previewText: 'We should plant more trees.',
      }),
    );

    expect(text).toContain('Jardín comunitario');
    expect(text).toContain('We should plant more trees.');
  });

  it('returns an empty string when there is no content', () => {
    expect(getProposalDetectionText(proposal({ htmlContent: undefined }))).toBe(
      '',
    );
  });
});

describe('getRubricDetectionText', () => {
  it('joins criterion prompts, descriptions, and option labels', () => {
    const text = getRubricDetectionText({
      type: 'object',
      properties: {
        impact: {
          type: 'string',
          title: 'Impacto comunitario',
          description: '¿A cuántas personas beneficia?',
          'x-format': 'dropdown',
          oneOf: [
            { const: 'high', title: 'Alto' },
            { const: 'low', title: 'Bajo' },
          ],
        },
      },
    });

    expect(text).toContain('Impacto comunitario');
    expect(text).toContain('¿A cuántas personas beneficia?');
    expect(text).toContain('Alto');
    expect(text).toContain('Bajo');
  });

  it('returns an empty string for a rubric with no criteria', () => {
    expect(getRubricDetectionText({ type: 'object', properties: {} })).toBe('');
    expect(getRubricDetectionText(null)).toBe('');
  });
});

describe('getOverviewDetectionText', () => {
  it('joins headline, description, and a string body', () => {
    const text = getOverviewDetectionText({
      headline: 'Budget 2026',
      description: 'How we spend together',
      body: '<p>Vote on the proposals below.</p>',
    });

    expect(text).toContain('Budget 2026');
    expect(text).toContain('How we spend together');
    expect(text).toContain('Vote on the proposals below.');
  });

  it('reads text out of a TipTap JSON body', () => {
    const text = getOverviewDetectionText({
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Rich text body' }],
          },
        ],
      },
    });

    expect(text).toContain('Rich text body');
  });

  it('returns an empty string when nothing is provided', () => {
    expect(getOverviewDetectionText({})).toBe('');
  });
});
