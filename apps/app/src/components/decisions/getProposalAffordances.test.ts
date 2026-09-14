import { describe, expect, it } from 'vitest';

import { getProposalAffordances } from './getProposalAffordances';

type Args = Parameters<typeof getProposalAffordances>[0];
type InstanceArg = Args['instance'];

const REVIEW_PHASE_ID = 'phase-review';
const SUBMISSION_PHASE_ID = 'phase-submission';

/** An instance in a review phase unless a non-review phase is requested. */
const instance = ({
  access = null,
  currentStateId = REVIEW_PHASE_ID,
}: {
  access?: InstanceArg['access'];
  currentStateId?: string;
} = {}): InstanceArg => ({
  access,
  currentStateId,
  instanceData: {
    phases: [
      { phaseId: REVIEW_PHASE_ID, rules: { reviews: { submit: true } } },
      { phaseId: SUBMISSION_PHASE_ID, rules: { reviews: { submit: false } } },
    ],
  },
});

describe('getProposalAffordances', () => {
  it('grants feedback to a co-author, who holds update on the proposal profile', () => {
    const affordances = getProposalAffordances({
      instance: instance(),
      proposal: { access: { update: true } },
    });

    expect(affordances.review.feedback).toBe(true);
    expect(affordances.review.revisions).toBe(true);
  });

  it('withholds feedback from a viewer with no update bit and no instance bits', () => {
    const affordances = getProposalAffordances({
      instance: instance(),
      proposal: { access: { update: false } },
    });

    expect(affordances.review.feedback).toBe(false);
    expect(affordances.review.revisions).toBe(false);
  });

  it('withholds feedback when the proposal carries no access at all', () => {
    const affordances = getProposalAffordances({
      instance: instance(),
      proposal: {},
    });

    expect(affordances.review.feedback).toBe(false);
  });

  it('grants feedback to an instance reviewer', () => {
    const affordances = getProposalAffordances({
      instance: instance({ access: { review: true } }),
      proposal: { access: { update: false } },
    });

    expect(affordances.review.feedback).toBe(true);
  });

  it('grants feedback to an instance admin', () => {
    const affordances = getProposalAffordances({
      instance: instance({ access: { admin: true } }),
      proposal: { access: { update: false } },
    });

    expect(affordances.review.feedback).toBe(true);
  });

  it('withholds revisions outside a review phase, keeping feedback', () => {
    const affordances = getProposalAffordances({
      instance: instance({ currentStateId: SUBMISSION_PHASE_ID }),
      proposal: { access: { update: true } },
    });

    expect(affordances.review.feedback).toBe(true);
    expect(affordances.review.revisions).toBe(false);
  });
});
