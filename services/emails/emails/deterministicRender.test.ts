import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { DecisionUpdateNotificationEmail } from './DecisionUpdateNotificationEmail';
import { PhaseTransitionEmail } from './PhaseTransitionEmail';

// Both templates ride a Resend idempotency key, which 409s if a retry's
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
});
