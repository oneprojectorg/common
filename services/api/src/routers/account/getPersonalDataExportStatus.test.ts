import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
} from '../../test/helpers/gating';

// Same tier as the mutation that starts the export, and for the same reason: the
// record's own `userId` is what decides who may read it, so the gate only has to
// establish that there is a real account behind the request.
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

  // Past the gate, an id nobody owns reads as `not_found` rather than as a
  // rejection. That is what makes the ownership check the only thing standing
  // between a caller and someone else's file, and why it is asserted directly
  // in `getPersonalDataExportStatus.test.ts` in `@op/common`.
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
