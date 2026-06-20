import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

const input = { q: 'main street' };

describeAccessTierGating('taxonomy.getGeoNames', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.taxonomy.getGeoNames(input), 'none');
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.taxonomy.getGeoNames(input));
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.taxonomy.getGeoNames(input));
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.taxonomy.getGeoNames(input));
    },
  ),
});
