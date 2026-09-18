import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { DecisionResultEmail } from './DecisionResultEmail';
import { DecisionUpdateNotificationEmail } from './DecisionUpdateNotificationEmail';
import { PhaseTransitionEmail } from './PhaseTransitionEmail';
import { ReviewPhaseEndingReminderEmail } from './ReviewPhaseEndingReminderEmail';

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
      };

      const first = await render(DecisionResultEmail(props));
      const second = await render(DecisionResultEmail(props));

      expect(second).toBe(first);
    },
  );

  it('renders ReviewPhaseEndingReminderEmail identically for identical props', async () => {
    const props = {
      processTitle: 'Participatory Budgeting 2026',
      phaseName: 'Review',
      remainingCount: 4,
      daysLeft: 3,
      reviewsUrl: 'https://common.oneproject.org/decisions/pb-2026/current',
    };

    const first = await render(ReviewPhaseEndingReminderEmail(props));
    const second = await render(ReviewPhaseEndingReminderEmail(props));

    expect(second).toBe(first);
  });

  // daysLeft reaches subject and body, which is why the sender pins it to a
  // memoized timestamp rather than a live clock.
  it('renders a different ReviewPhaseEndingReminderEmail when daysLeft changes', async () => {
    const props = {
      processTitle: 'Participatory Budgeting 2026',
      phaseName: 'Review',
      remainingCount: 4,
      reviewsUrl: 'https://common.oneproject.org/decisions/pb-2026/current',
    };

    const threeDays = await render(
      ReviewPhaseEndingReminderEmail({ ...props, daysLeft: 3 }),
    );
    const twoDays = await render(
      ReviewPhaseEndingReminderEmail({ ...props, daysLeft: 2 }),
    );

    expect(twoDays).not.toBe(threeDays);
    expect(
      ReviewPhaseEndingReminderEmail.subject(props.processTitle, 2),
    ).not.toBe(ReviewPhaseEndingReminderEmail.subject(props.processTitle, 3));
  });
});
