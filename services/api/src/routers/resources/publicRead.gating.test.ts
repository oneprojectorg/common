import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { setupInstance } from '../../test/helpers/resourcesTestUtils';

// The resources READ procedures are openProcedure: every caller tier (no-JWT,
// anon, user, network) is admitted past the gate; the service layer decides
// access. A regression to networkAuthenticatedProcedure would fail the first
// three cells.

describeAccessTierGating('resources.list', {
  noJwt: accessTierGatingCell(
    'admits no-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance } = await setupInstance({ task, onTestFinished });
      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.resources.list({ profileId: instance.profileId }),
      );
    },
  ),
  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance } = await setupInstance({ task, onTestFinished });
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.resources.list({ profileId: instance.profileId }),
      );
    },
  ),
  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance } = await setupInstance({ task, onTestFinished });
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.resources.list({ profileId: instance.profileId }),
      );
    },
  ),
  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance, setup } = await setupInstance({ task, onTestFinished });
      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.resources.list({ profileId: instance.profileId }),
      );
    },
  ),
});

describeAccessTierGating('resources.collections.list', {
  noJwt: accessTierGatingCell(
    'admits no-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance } = await setupInstance({ task, onTestFinished });
      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.resources.collections.list({ profileId: instance.profileId }),
      );
    },
  ),
  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance } = await setupInstance({ task, onTestFinished });
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.resources.collections.list({ profileId: instance.profileId }),
      );
    },
  ),
  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance } = await setupInstance({ task, onTestFinished });
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.resources.collections.list({ profileId: instance.profileId }),
      );
    },
  ),
  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance, setup } = await setupInstance({ task, onTestFinished });
      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.resources.collections.list({ profileId: instance.profileId }),
      );
    },
  ),
});

describeAccessTierGating('resources.listByCollection', {
  noJwt: accessTierGatingCell(
    'admits no-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance, adminCaller } = await setupInstance({
        task,
        onTestFinished,
      });
      const collection = await adminCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Gating',
      });
      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.resources.listByCollection({ collectionId: collection.id }),
      );
    },
  ),
  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance, adminCaller } = await setupInstance({
        task,
        onTestFinished,
      });
      const collection = await adminCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Gating',
      });
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.resources.listByCollection({ collectionId: collection.id }),
      );
    },
  ),
  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance, adminCaller } = await setupInstance({
        task,
        onTestFinished,
      });
      const collection = await adminCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Gating',
      });
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.resources.listByCollection({ collectionId: collection.id }),
      );
    },
  ),
  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const { instance, setup, adminCaller } = await setupInstance({
        task,
        onTestFinished,
      });
      const collection = await adminCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Gating',
      });
      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.resources.listByCollection({ collectionId: collection.id }),
      );
    },
  ),
});
