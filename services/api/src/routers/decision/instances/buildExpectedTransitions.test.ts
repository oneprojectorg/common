import { buildExpectedTransitions } from '@op/common';
import { describe, expect, it } from 'vitest';

const processInstanceId = 'test-instance-id';

describe('buildExpectedTransitions', () => {
  it('should create transitions for date-based phases', () => {
    const transitions = buildExpectedTransitions({
      processInstanceId,
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

    expect(transitions).toEqual([
      {
        processInstanceId,
        fromStateId: 'phase-a',
        toStateId: 'phase-b',
        scheduledDate: '2026-06-01T00:00:00.000Z',
      },
      {
        processInstanceId,
        fromStateId: 'phase-b',
        toStateId: 'phase-c',
        scheduledDate: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  it('should skip phases without date-based advancement', () => {
    const transitions = buildExpectedTransitions({
      processInstanceId,
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

    // Only phase-b has date advancement, creating one transition (b→c)
    expect(transitions).toMatchObject([
      { fromStateId: 'phase-b', toStateId: 'phase-c' },
    ]);
  });

  it('should return empty array when no phases use date advancement', () => {
    const transitions = buildExpectedTransitions({
      processInstanceId,
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

    expect(transitions).toHaveLength(0);
  });

  it('should return empty array for single phase (no next phase to transition to)', () => {
    const transitions = buildExpectedTransitions({
      processInstanceId,
      phases: [
        {
          phaseId: 'only-phase',
          rules: { advancement: { method: 'date' } },
          endDate: '2026-06-01T00:00:00.000Z',
        },
      ],
    });

    expect(transitions).toHaveLength(0);
  });

  it('should throw when phases array is empty', () => {
    expect(() =>
      buildExpectedTransitions({ processInstanceId, phases: [] }),
    ).toThrow('Process instance must have at least one phase configured');
  });

  it('should throw when date-based phase has no endDate', () => {
    expect(() =>
      buildExpectedTransitions({
        processInstanceId: 'inst-123',
        phases: [
          {
            phaseId: 'phase-a',
            rules: { advancement: { method: 'date' } },
          },
          {
            phaseId: 'phase-b',
          },
        ],
      }),
    ).toThrow(
      'Phase "phase-a" must have an end date for date-based advancement (instance: inst-123)',
    );
  });
});
