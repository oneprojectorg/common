import { describe, expect, it } from 'vitest';

import {
  getOverviewDetectionText,
  getProposalDetectionText,
  getProposalsDetectionText,
} from './translationDetectionText';

describe('getProposalDetectionText', () => {
  it('strips HTML from every string field', () => {
    const text = getProposalDetectionText({
      htmlContent: {
        title: '<h1>Community Garden</h1>',
        body: '<p>We should plant more trees.</p>',
      },
    });

    expect(text).toContain('Community Garden');
    expect(text).toContain('We should plant more trees.');
    expect(text).not.toContain('<');
  });

  it('returns an empty string when there is no content', () => {
    expect(getProposalDetectionText({ htmlContent: undefined })).toBe('');
  });
});

describe('getProposalsDetectionText', () => {
  it('combines samples across proposals', () => {
    const text = getProposalsDetectionText([
      { htmlContent: { title: '<p>First</p>' } },
      { htmlContent: { title: '<p>Second</p>' } },
    ]);

    expect(text).toContain('First');
    expect(text).toContain('Second');
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
