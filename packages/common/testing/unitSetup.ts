import { vi } from 'vitest';

const UNIT_DATABASE_GUARD_MESSAGE =
  'Unit tests must not open a database connection. Remove the .unit marker so this file runs in the integration project, or mock the @op/db entry in the test.';

// Unit tests hold no phase rows, so readers fall back to instanceData.phases.
vi.mock('../src/services/decision/phaseHelpers', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/services/decision/phaseHelpers')
  >()),
  listPhasesByInstance: vi.fn(async () => new Map()),
}));

vi.mock(
  '@op/analytics/client',
  async () => (await import('./mocks/analytics')).analyticsClientMock,
);

// Each factory throws on import, so a unit test that pulls in the real client
// through any entry of @op/db fails instead of quietly opening a connection to
// the test database.
vi.mock('@op/db', () => {
  throw new Error(UNIT_DATABASE_GUARD_MESSAGE);
});
vi.mock('@op/db/client', () => {
  throw new Error(UNIT_DATABASE_GUARD_MESSAGE);
});
vi.mock('@op/db/test', () => {
  throw new Error(UNIT_DATABASE_GUARD_MESSAGE);
});
