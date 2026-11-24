import { describe, expect, it } from 'vitest';

import { toTimelinePhases } from './toTimelinePhases';

const submit = {
  id: 'row-submit',
  phaseId: 'submit',
  name: 'Submit',
};
const vote = {
  id: 'row-vote',
  phaseId: 'vote',
  name: 'Vote',
};

describe('toTimelinePhases', () => {
  it('keys each phase by its row id in stored order', () => {
    const { phases } = toTimelinePhases({
      phases: [submit, vote],
      currentStateId: null,
    });

    expect(phases.map(({ id }) => id)).toEqual(['row-submit', 'row-vote']);
  });

  it('names the current phase by its row id', () => {
    const { currentPhaseId } = toTimelinePhases({
      phases: [submit, vote],
      currentStateId: 'vote',
    });

    expect(currentPhaseId).toBe('row-vote');
  });

  it('passes an empty current id when no phase is current', () => {
    expect(
      toTimelinePhases({ phases: [submit, vote], currentStateId: null })
        .currentPhaseId,
    ).toBe('');
  });

  it('keys a phase with no row id by its position, current included', () => {
    const timeline = toTimelinePhases({
      phases: [submit, vote].map((phase) => ({ ...phase, id: null })),
      currentStateId: 'vote',
    });

    expect(timeline.phases.map(({ id }) => id)).toEqual([
      'unstored-0',
      'unstored-1',
    ]);
    expect(timeline.currentPhaseId).toBe('unstored-1');
  });

  it('keys only the phases with no row id by their position', () => {
    const { phases } = toTimelinePhases({
      phases: [submit, { ...vote, id: null }],
      currentStateId: null,
    });

    expect(phases.map(({ id }) => id)).toEqual(['row-submit', 'unstored-1']);
  });

  it('passes an empty current id when the current state matches no phase', () => {
    expect(
      toTimelinePhases({ phases: [submit, vote], currentStateId: 'gone' })
        .currentPhaseId,
    ).toBe('');
  });

  it('returns no phases for an empty list', () => {
    expect(toTimelinePhases({ phases: [], currentStateId: 'x' })).toEqual({
      phases: [],
      currentPhaseId: '',
    });
  });

  it('maps dates, description, advancement and the proposals toggle', () => {
    const [first] = toTimelinePhases({
      phases: [
        {
          ...submit,
          description: 'Send an idea',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-02-01T00:00:00.000Z',
          rules: {
            proposals: { submit: true },
            advancement: { method: 'manual' },
          },
        },
      ],
      currentStateId: null,
    }).phases;

    expect(first).toEqual({
      id: 'row-submit',
      name: 'Submit',
      description: 'Send an idea',
      phase: {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
      },
      advancementMethod: 'manual',
      config: { allowProposals: true },
    });
  });

  it('defaults a missing name to empty', () => {
    const [first] = toTimelinePhases({
      phases: [{ id: 'row-vote', phaseId: 'vote' }],
      currentStateId: null,
    }).phases;

    expect(first?.name).toBe('');
  });

  it('closes proposals when the phase does not take them', () => {
    const [first] = toTimelinePhases({
      phases: [
        {
          ...submit,
          rules: {
            proposals: { submit: false },
            advancement: { method: 'date' },
          },
        },
      ],
      currentStateId: null,
    }).phases;

    expect(first?.config?.allowProposals).toBe(false);
    expect(first?.advancementMethod).toBe('date');
  });

  it('leaves the toggle and advancement unset for a phase without rules', () => {
    const [first] = toTimelinePhases({
      phases: [submit],
      currentStateId: null,
    }).phases;

    expect(first?.config?.allowProposals).toBeUndefined();
    expect(first?.advancementMethod).toBeUndefined();
  });
});
