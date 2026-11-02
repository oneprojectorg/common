import { vi } from 'vitest';

// Server flags read as off; a test that needs one on stubs the switch itself.
process.env.NEXT_PUBLIC_E2E = '';

const UNIT_DATABASE_GUARD_MESSAGE =
  'Unit tests must not open a database connection. Remove the .unit marker so this file runs in the integration project, or mock the @op/db entry in the test.';

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
