import { EntityType } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { setupPhase } from '../../test/helpers/phaseTestUtils';

describeAccessTierGating('profile.search', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.profile.search({ q: 'x' }), 'none');
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.search({ q: 'x' }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.profile.search({ q: 'x' }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.profile.search({ q: 'x' }));
    },
  ),
});

describe.concurrent('profile.search: phase profiles', () => {
  it('never returns a phase profile, even when asked for', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    // One word unique to this test, so only this phase could match it.
    const name = `phasesearch${randomUUID().replace(/[^a-f]/g, '')}`;
    await adminCaller.decision.renamePhase({ phaseId: phase.id, name });

    const groups = await adminCaller.profile.search({
      q: name,
      types: [EntityType.PHASE, EntityType.ORG],
    });

    expect(groups.map((group) => group.type)).not.toContain(EntityType.PHASE);
    const ids = groups.flatMap((group) =>
      group.results.map((result) => result.id),
    );
    expect(ids).not.toContain(phase.profileId);
  });
});
