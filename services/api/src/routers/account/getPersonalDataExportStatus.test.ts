import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
} from '../../test/helpers/gating';

// Same tier as the mutation: the record's own `userId` decides who may read it,
// so the gate only establishes that there is a real account behind the request.
describeAccessTierGating('account.getPersonalDataExportStatus', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.account.getPersonalDataExportStatus({ exportId: randomUUID() }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.account.getPersonalDataExportStatus({ exportId: randomUUID() }),
        'anon',
      );
    },
  ),

  // Past the gate an unowned id reads as `not_found`; the ownership check itself
  // is asserted in `@op/common`.
  userJwt: accessTierGatingCell(
    'admits an out-of-network account holder',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      const result = await caller.account.getPersonalDataExportStatus({
        exportId: randomUUID(),
      });

      expect(result.status).toBe('not_found');
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits an in-network account holder',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      const result = await caller.account.getPersonalDataExportStatus({
        exportId: randomUUID(),
      });

      expect(result.status).toBe('not_found');
    },
  ),
});
