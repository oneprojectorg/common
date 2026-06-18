import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// flagItem is an `openProcedure`: the tier gate admits every caller (including
// no-JWT) and authorization is fully the service layer's job — a sessionless
// caller is held to public visibility and may flag a publicly readable item. A
// syntactically valid uuid that exists nowhere lets every tier (no-JWT
// included) get past the gate and 404 at the service, which counts as passing.
// Item-level authorization (existence + read access before anything ships to
// the provider) is the service layer's job — see assertModerationItemAccess.
const input = {
  itemType: 'post' as const,
  itemId: '11111111-1111-4111-8111-111111111111',
};

describeAccessTierGating('moderation.flagItem', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate (handler fails it closed)',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(caller.moderation.flagItem(input));
    },
  ),

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
