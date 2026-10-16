import { describe, expect, it } from 'vitest';

import { formatSmsCost, formatSmsProposalInfo } from './smsBallotFormat';
import { SMS_MAX_BODY_LENGTH } from './smsText';

const proposal = (
  code: string,
  title: string,
  cost: number | null,
  summary: string | null = null,
) => ({
  code,
  proposalId: `id-${code}`,
  title,
  cost,
  currency: 'USD',
  summary,
});

describe('formatSmsCost', () => {
  it('formats whole dollars with a thousands separator and no cents', () => {
    expect(formatSmsCost(85_000, 'USD')).toBe('$85,000');
    expect(formatSmsCost(null, 'USD')).toBe('');
  });

  it('given a currency code Intl does not know, then it formats in the default currency instead of throwing', () => {
    expect(formatSmsCost(85_000, 'dollars')).toBe('$85,000');
    expect(formatSmsCost(85_000, '')).toBe('$85,000');
  });
});

describe('formatSmsProposalInfo', () => {
  it('given a lookup outside a ballot, then the reply names the proposal and no next step', () => {
    expect(formatSmsProposalInfo(proposal('218', 'Bike lane', null))).toBe(
      '218: "Bike lane".',
    );
  });

  it('includes the summary when there is one', () => {
    expect(
      formatSmsProposalInfo(
        proposal('218', 'Bike lane', 310_000, 'A curb-protected lane.'),
      ),
    ).toBe('218: "Bike lane" ($310,000). A curb-protected lane.');
  });

  it('given a summary longer than one text can carry, then the summary is cut so the whole body fits', () => {
    const summary = Array.from({ length: 400 }, () => 'words').join(' ');

    const body = formatSmsProposalInfo(
      proposal('218', 'Bike lane', 310_000, summary),
    );

    expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    expect(body.startsWith('218: "Bike lane" ($310,000). words')).toBe(true);
    expect(body.endsWith('...')).toBe(true);
  });
});
