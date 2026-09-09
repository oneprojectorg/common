import { vi } from 'vitest';

// The factory throws on import, so a unit test that pulls in the real client
// fails instead of quietly opening a connection to the test database.
vi.mock('@op/db/client', () => {
  throw new Error(
    'Unit tests must not open a database connection. Remove the .unit marker so this file runs in the integration project, or mock @op/db/client in the test.',
  );
});
