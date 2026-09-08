import { describe, expect, it } from 'vitest';

import { requiresSubmitConfirmation } from './submitConfirmation';

const instanceWith = ({
  currentStateId,
  edit,
}: {
  currentStateId: string | null;
  edit?: boolean;
}) => ({
  currentStateId,
  instanceData: {
    phases: [
      { phaseId: 'submission', rules: { proposals: { submit: true, edit } } },
      // Submission is closed here and editing is allowed — the opposite of the
      // submission phase on both axes, so a test that lands on it by mistake
      // flips its result rather than passing anyway.
      {
        phaseId: 'voting',
        rules: { proposals: { submit: false, edit: true } },
      },
    ],
  },
});

describe('requiresSubmitConfirmation', () => {
  it('confirms when a draft is submitted into a phase that forbids later edits', () => {
    expect(
      requiresSubmitConfirmation({
        instance: instanceWith({ currentStateId: 'submission' }),
        isDraft: true,
      }),
    ).toBe(true);
  });

  it('skips the confirmation when the phase allows editing after submission', () => {
    expect(
      requiresSubmitConfirmation({
        instance: instanceWith({ currentStateId: 'submission', edit: true }),
        isDraft: true,
      }),
    ).toBe(false);
  });

  it('skips the confirmation for a proposal that is no longer a draft', () => {
    expect(
      requiresSubmitConfirmation({
        instance: instanceWith({ currentStateId: 'submission' }),
        isDraft: false,
      }),
    ).toBe(false);
  });

  // `submitProposal` rejects a phase whose rules close submission, so the
  // prompt would announce a finality the server never reaches.
  it('skips the confirmation when the current phase no longer accepts submissions', () => {
    expect(
      requiresSubmitConfirmation({
        instance: instanceWith({ currentStateId: 'voting' }),
        isDraft: true,
      }),
    ).toBe(false);
  });

  it('skips the confirmation when the instance has no current phase', () => {
    expect(
      requiresSubmitConfirmation({
        instance: instanceWith({ currentStateId: null }),
        isDraft: true,
      }),
    ).toBe(false);
  });

  it('skips the confirmation when the current phase is absent from the instance', () => {
    expect(
      requiresSubmitConfirmation({
        instance: instanceWith({ currentStateId: 'retired-phase' }),
        isDraft: true,
      }),
    ).toBe(false);
  });

  // `rules` is optional on the encoded phase, so legacy rows can arrive without
  // it. No rules means no editing rule, which means the edit is not allowed.
  it('confirms when the current phase carries no rules at all', () => {
    expect(
      requiresSubmitConfirmation({
        instance: {
          currentStateId: 'submission',
          instanceData: { phases: [{ phaseId: 'submission' }] },
        },
        isDraft: true,
      }),
    ).toBe(true);
  });
});
