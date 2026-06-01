import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

describeGating('profile.list', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.profile.list()).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.profile.list()).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(caller.profile.list()).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.profile.list());
  },
});

describeGating('profile.getBySlug', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.profile.getBySlug({ slug: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthGateError' },
      },
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.profile.getBySlug({ slug: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthGateError' },
      },
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(caller.profile.getBySlug({ slug: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthGateError' },
      },
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.profile.getBySlug({ slug: 'x' }));
  },
});
