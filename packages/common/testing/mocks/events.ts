import { vi } from 'vitest';

/** One object per worker, so `event` keeps its identity across test files. */
const target = { send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }) };

export async function eventsMock() {
  return {
    ...(await vi.importActual('@op/events')),
    inngest: target,
    event: target,
  };
}
