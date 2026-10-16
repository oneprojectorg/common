import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { DecisionResultEmail } from './DecisionResultEmail';

const PROCESS_TITLE = 'Participatory Budgeting 2026';

describe('DecisionResultEmail', () => {
  it.each([
    [true, true, 'Your proposal was selected — Participatory Budgeting 2026'],
    [false, true, 'Participatory Budgeting 2026 results are in'],
    [true, false, 'Your proposal advanced — Participatory Budgeting 2026'],
    [false, false, 'An update on your proposal — Participatory Budgeting 2026'],
  ])(
    'writes the subject for selected: %s, publishes results: %s',
    (isSelected, publishesResults, subject) => {
      expect(
        DecisionResultEmail.subject({
          processTitle: PROCESS_TITLE,
          isSelected,
          publishesResults,
        }),
      ).toBe(subject);
    },
  );

  it.each([
    [true, 'Your proposal advanced.'],
    [false, 'An update on your proposal.'],
  ])(
    'heads a mid-process email for selected: %s with advancement copy',
    async (isSelected, header) => {
      const html = await render(
        DecisionResultEmail({
          processTitle: PROCESS_TITLE,
          message: 'Hi Ada',
          proposalUrl: 'https://common.oneproject.org/',
          isSelected,
          publishesResults: false,
        }),
      );

      expect(html).toContain(header);
      expect(html).not.toContain('results are in');
    },
  );
});
