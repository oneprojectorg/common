import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// A syntactically valid uuid that exists nowhere: the authenticated tiers get
// past the gate and the service then 404s on the missing item, which still
// counts as passing. Item-level authorization (existence + read access before
// anything ships to the provider) is the service layer's job — see
// assertModerationItemAccess.
const input = {
  itemType: 'post' as const,
  itemId: '11111111-1111-4111-8111-111111111111',
};

describeAccessTierGating('moderation.flagItem', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.moderation.flagItem(input), 'none');
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.moderation.flagItem(input));
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.moderation.flagItem(input));
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.moderation.flagItem(input));
    },
  ),
});
