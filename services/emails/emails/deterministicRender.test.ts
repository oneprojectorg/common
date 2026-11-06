import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { DecisionResultEmail } from './DecisionResultEmail';
import { DecisionUpdateNotificationEmail } from './DecisionUpdateNotificationEmail';
import { PhaseTransitionEmail } from './PhaseTransitionEmail';
import { ReviewReminderEmail } from './ReviewReminderEmail';

// These templates ride a Resend idempotency key, which 409s if a retry's
// payload differs — so a deterministic render is a contract.
describe('email render determinism', () => {
  it('renders PhaseTransitionEmail identically for identical props', async () => {
    const props = {
      processTitle: 'Participatory Budgeting 2026',
      toPhaseName: 'Voting',
      phaseNumber: 3,
      totalPhases: 5,
      processUrl: 'https://common.oneproject.org/decisions/pb-2026',
    };

    const first = await render(PhaseTransitionEmail(props));
    const second = await render(PhaseTransitionEmail(props));

    expect(second).toBe(first);
  });

  it('renders DecisionUpdateNotificationEmail identically for identical props', async () => {
    const props = {
      authorName: 'Jordan Rivera',
      processTitle: 'Participatory Budgeting 2026',
      updateContent:
        'Reviews open on Monday.\n\nDetails: https://example.com/events/kickoff',
      updateUrl:
        'https://common.oneproject.org/decisions/pb-2026?panel=updates',
    };

    const first = await render(DecisionUpdateNotificationEmail(props));
    const second = await render(DecisionUpdateNotificationEmail(props));

    expect(second).toBe(first);
  });

  it.each([true, false])(
    'renders DecisionResultEmail identically for identical props (selected: %s)',
    async (isSelected) => {
      const props = {
        processTitle: 'Participatory Budgeting 2026',
        message:
          'Hi Ada,\n\nYour proposal "Community Garden Revamp" has an outcome.\n\nThanks for taking part.',
        proposalUrl:
          'https://common.oneproject.org/decisions/pb-2026/proposal/abc',
        isSelected,
        publishesResults: true,
      };

      const first = await render(DecisionResultEmail(props));
      const second = await render(DecisionResultEmail(props));

      expect(second).toBe(first);
    },
  );

  it('renders ReviewReminderEmail identically for identical props', async () => {
    const props = {
      processTitle: 'Participatory Budgeting 2026',
      message: 'Hi Ada,\n\nYou still have 4 proposals left to review.',
      reviewsUrl: 'https://common.oneproject.org/decisions/pb-2026/current',
    };

    const first = await render(ReviewReminderEmail(props));
    const second = await render(ReviewReminderEmail(props));

    expect(second).toBe(first);
  });

  it('renders markup in a ReviewReminderEmail message as escaped text', async () => {
    const html = await render(
      ReviewReminderEmail({
        processTitle: 'Participatory Budgeting 2026',
        message: '<a href="https://example.com">click</a>',
        reviewsUrl: 'https://common.oneproject.org/decisions/pb-2026/current',
      }),
    );

    expect(html).not.toContain('<a href="https://example.com">');
    expect(html).toContain('&lt;a href=');
  });
});
