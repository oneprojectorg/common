import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.list', {
  noJwt: accessTierGatingCell(
    'rejects no-JWT caller at the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(caller.profile.list(), 'none');
    },
  ),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller at the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(caller.profile.list(), 'anon');
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller at the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(caller.profile.list(), 'user');
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.profile.list());
    },
  ),
});

describeAccessTierGating('profile.getBySlug', {
  noJwt: accessTierGatingCell(
    'rejects no-JWT caller at the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.profile.getBySlug({ slug: 'x' }),
        'none',
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller at the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.getBySlug({ slug: 'x' }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller at the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.profile.getBySlug({ slug: 'x' }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the access-tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.profile.getBySlug({ slug: 'x' }));
    },
  ),
});
