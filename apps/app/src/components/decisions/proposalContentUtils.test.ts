import { describe, expect, it } from 'vitest';

import {
  type ProposalSystemFieldSource,
  resolveProposalSystemFields,
} from './proposalContentUtils';

const textFragment = (text: string) => ({
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const makeProposal = (): ProposalSystemFieldSource => ({
  proposalData: { title: 'Fallback title', budget: 1000 },
  proposalTemplate: {
    type: 'object',
    properties: {
      title: { type: 'string', 'x-format': 'short-text' },
      budget: { type: 'number', 'x-format': 'money' },
    },
  },
  documentContent: {
    type: 'json',
    fragments: {
      title: textFragment('Solar roof'),
      budget: textFragment('12000'),
    },
  },
});

describe('resolveProposalSystemFields', () => {
  it('resolves the system fields from the pinned document fragments', () => {
    const resolved = resolveProposalSystemFields(makeProposal());

    expect(resolved.title).toBe('Solar roof');
    expect(resolved.budget).toBe(12000);
  });

  it('returns the identical result object for the same proposal object', () => {
    const proposal = makeProposal();

    const first = resolveProposalSystemFields(proposal);
    const second = resolveProposalSystemFields(proposal);

    expect(second).toBe(first);
  });

  it('re-resolves for a different proposal object with the same content', () => {
    const first = resolveProposalSystemFields(makeProposal());
    const second = resolveProposalSystemFields(makeProposal());

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
