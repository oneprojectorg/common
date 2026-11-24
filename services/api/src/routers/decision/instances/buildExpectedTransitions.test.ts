import { type PhaseInstanceData, buildExpectedTransitions } from '@op/common';
import { describe, expect, it } from 'vitest';

function stubInstance(
  { phases }: { phases: PhaseInstanceData[] },
  id = 'test-instance-id',
) {
  return { id, phases, currentStateId: null };
}

describe('buildExpectedTransitions', () => {
  it('should create transitions for date-based phases', () => {
    const instance = stubInstance({
      phases: [
        {
          phaseId: 'phase-a',
          rules: { advancement: { method: 'date' } },
          endDate: '2026-06-01T00:00:00.000Z',
        },
        {
          phaseId: 'phase-b',
          rules: { advancement: { method: 'date' } },
          endDate: '2026-07-01T00:00:00.000Z',
        },
        {
          phaseId: 'phase-c',
        },
      ],
    });

    const transitions = buildExpectedTransitions(instance);

    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toEqual({
      processInstanceId: 'test-instance-id',
      fromStateId: 'phase-a',
      toStateId: 'phase-b',
      scheduledDate: '2026-06-01T00:00:00.000Z',
    });
    expect(transitions[1]).toEqual({
      processInstanceId: 'test-instance-id',
      fromStateId: 'phase-b',
      toStateId: 'phase-c',
      scheduledDate: '2026-07-01T00:00:00.000Z',
    });
  });

  it('should skip phases without date-based advancement', () => {
    const instance = stubInstance({
      phases: [
        {
          phaseId: 'phase-a',
          rules: { advancement: { method: 'manual' } },
          endDate: '2026-06-01T00:00:00.000Z',
        },
        {
          phaseId: 'phase-b',
          rules: { advancement: { method: 'date' } },
          endDate: '2026-07-01T00:00:00.000Z',
        },
        {
          phaseId: 'phase-c',
        },
      ],
    });

    const transitions = buildExpectedTransitions(instance);

    // Only phase-b has date advancement, creating one transition (b→c)
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.fromStateId).toBe('phase-b');
    expect(transitions[0]!.toStateId).toBe('phase-c');
  });

  it('should return empty array when no phases use date advancement', () => {
    const instance = stubInstance({
      phases: [
        {
          phaseId: 'phase-a',
          rules: { advancement: { method: 'manual' } },
        },
        {
          phaseId: 'phase-b',
        },
      ],
    });

    const transitions = buildExpectedTransitions(instance);
    expect(transitions).toHaveLength(0);
  });

  it('should return empty array for single phase (no next phase to transition to)', () => {
    const instance = stubInstance({
      phases: [
        {
          phaseId: 'only-phase',
          rules: { advancement: { method: 'date' } },
          endDate: '2026-06-01T00:00:00.000Z',
        },
      ],
    });

    const transitions = buildExpectedTransitions(instance);
    expect(transitions).toHaveLength(0);
  });

  it('should throw when phases array is empty', () => {
    const instance = stubInstance({
      phases: [],
    });

    expect(() => buildExpectedTransitions(instance)).toThrow(
      'Process instance must have at least one phase configured',
    );
  });

  describe('with a current phase', () => {
    const phases: PhaseInstanceData[] = [
      'phase-a',
      'phase-b',
      'phase-c',
      'phase-d',
    ].map((phaseId, index) => ({
      phaseId,
      rules: { advancement: { method: 'date' } },
      endDate: `2026-0${index + 6}-01T00:00:00.000Z`,
    }));
    const fromStateIds = (currentStateId: string | null) =>
      buildExpectedTransitions({
        ...stubInstance({ phases }),
        currentStateId,
      }).map(({ fromStateId }) => fromStateId);

    it('builds no transition out of a phase before the current one', () => {
      expect(fromStateIds('phase-c')).toEqual(['phase-c']);
      expect(fromStateIds('phase-b')).toEqual(['phase-b', 'phase-c']);
    });

    it('builds every transition when the current phase is null or unknown', () => {
      const all = ['phase-a', 'phase-b', 'phase-c'];
      expect(fromStateIds(null)).toEqual(all);
      expect(fromStateIds('phase-gone')).toEqual(all);
    });

    it('does not require an end date on a phase before the current one', () => {
      const [first, ...rest] = phases;
      if (!first) {
        throw new Error('Expected the phase fixtures');
      }
      const { endDate: _endDate, ...withoutEndDate } = first;
      const instance = stubInstance({ phases: [withoutEndDate, ...rest] });

      expect(
        buildExpectedTransitions({ ...instance, currentStateId: 'phase-b' }),
      ).toHaveLength(2);
      expect(() =>
        buildExpectedTransitions({ ...instance, currentStateId: 'phase-a' }),
      ).toThrow('Phase "phase-a" must have an end date');
    });
  });

  it('names the phase by its name in the missing end date error', () => {
    const instance = stubInstance({
      phases: [
        {
          phaseId: 'phase-a',
          name: 'Proposals',
          rules: { advancement: { method: 'date' } },
        },
        { phaseId: 'phase-b' },
      ],
    });

    expect(() => buildExpectedTransitions(instance)).toThrow(
      'Phase "Proposals" must have an end date because it advances by date',
    );
  });

  it('should throw when date-based phase has no endDate', () => {
    const instance = stubInstance(
      {
        phases: [
          {
            phaseId: 'phase-a',
            rules: { advancement: { method: 'date' } },
            // no endDate
          },
          {
            phaseId: 'phase-b',
          },
        ],
      },
      'inst-123',
    );

    expect(() => buildExpectedTransitions(instance)).toThrow(
      'Phase "phase-a" must have an end date because it advances by date',
    );
  });
});
