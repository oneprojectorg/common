import { type PhaseInstanceData, buildExpectedTransitions } from '@op/common';
import { describe, expect, it } from 'vitest';

function stubInstance(
  { phases }: { phases: PhaseInstanceData[] },
  id = 'test-instance-id',
) {
  return { id, phases };
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
