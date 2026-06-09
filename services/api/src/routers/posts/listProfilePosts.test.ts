import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// These cells only assert the caller is admitted *past the tier gate* — i.e. the
// rejection (if any) is not an `AccessTierError`. They don't exercise a real
// resource, so a bogus profileId is enough: the open procedure lets the caller
// through and the service rejects on the missing profile, which still counts as
// passing the gate. Resource-level authorization is covered by postAuthorization.test.ts.
describeAccessTierGating('posts.listProfilePosts', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProfilePosts({ profileId: 'x' }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProfilePosts({ profileId: 'x' }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProfilePosts({ profileId: 'x' }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProfilePosts({ profileId: 'x' }),
      );
    },
  ),
});
