import { db } from '@op/db/client';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import {
  createAuthenticatedCaller,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';

type AuthenticatedCaller = Awaited<
  ReturnType<typeof createAuthenticatedCaller>
>;

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// 1x1 PNG; small enough to keep tests cheap, still a valid image.
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

async function getPersonalProfileId(caller: AuthenticatedCaller) {
  const account = await caller.account.getMyAccount();
  const profileId = account?.profile?.id;
  if (!profileId) {
    throw new Error('test user has no personal profile');
  }
  return profileId;
}

/**
 * Runs the production profile-image upload sequence via a tRPC caller: sign
 * URL, PUT to storage (service-role admin client), leaving the record step to
 * the test. Returns the signed path so callers can assert on it.
 */
async function uploadProfileImageForTest({
  caller,
  profileId,
  imageType,
  fileName = 'photo.png',
  mimeType = 'image/png',
  body = TEST_PNG_BUFFER,
}: {
  caller: AuthenticatedCaller;
  profileId: string;
  imageType: 'avatar' | 'banner';
  fileName?: string;
  mimeType?: string;
  body?: Buffer;
}) {
  const signed = await caller.profile.signProfileImageUploadUrl({
    profileId,
    fileName,
    imageType,
  });

  const { error } = await supabaseTestAdminClient.storage
    .from('assets')
    .upload(signed.storagePath, body, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(`profile image test upload failed: ${error.message}`);
  }

  return signed;
}

async function getProfileImageRow(profileId: string) {
  return db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { avatarImageId: true, headerImageId: true },
  });
}

describe.concurrent('saveProfileImage', () => {
  it('records an uploaded avatar on both the personal profile and the user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const profileId = await getPersonalProfileId(caller);

    const signed = await uploadProfileImageForTest({
      caller,
      profileId,
      imageType: 'avatar',
    });
    const result = await caller.profile.saveProfileImage({
      profileId,
      storagePath: signed.storagePath,
      mimeType: 'image/png',
      imageType: 'avatar',
    });
    expect(result.storagePath).toBe(signed.storagePath);

    const profileRow = await getProfileImageRow(profileId);
    expect(profileRow?.avatarImageId).toBeTruthy();
    const userRow = await db.query.users.findFirst({
      where: { email: setup.userEmail },
      columns: { avatarImageId: true },
    });
    expect(userRow?.avatarImageId).toBe(profileRow?.avatarImageId);
  });

  it('records an uploaded banner on the personal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const profileId = await getPersonalProfileId(caller);

    const signed = await uploadProfileImageForTest({
      caller,
      profileId,
      imageType: 'banner',
    });
    await caller.profile.saveProfileImage({
      profileId,
      storagePath: signed.storagePath,
      mimeType: 'image/png',
      imageType: 'banner',
    });

    const profileRow = await getProfileImageRow(profileId);
    expect(profileRow?.headerImageId).toBeTruthy();
  });

  it('lets a caller with profile UPDATE access set an org profile banner', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const orgProfileId = setup.organization.profileId;
    // The org profile isn't the caller's personal profile, so access comes
    // from an Admin role (which carries profile UPDATE) on the org profile.
    await testData.grantProfileAccess(
      orgProfileId,
      setup.user.id,
      setup.userEmail,
    );

    const signed = await uploadProfileImageForTest({
      caller,
      profileId: orgProfileId,
      imageType: 'banner',
    });
    await caller.profile.saveProfileImage({
      profileId: orgProfileId,
      storagePath: signed.storagePath,
      mimeType: 'image/png',
      imageType: 'banner',
    });

    const profileRow = await getProfileImageRow(orgProfileId);
    expect(profileRow?.headerImageId).toBeTruthy();
  });

  it("rejects signing for another user's personal profile", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const ownerProfileId = await getPersonalProfileId(ownerCaller);
    const otherUser = await testData.createMemberUser({
      organization: setup.organization,
    });
    const otherCaller = await createAuthenticatedCaller(otherUser.email);

    await expect(
      otherCaller.profile.signProfileImageUploadUrl({
        profileId: ownerProfileId,
        fileName: 'photo.png',
        imageType: 'avatar',
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it("rejects a storage path from another profile's prefix", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const ownerProfileId = await getPersonalProfileId(ownerCaller);
    const otherUser = await testData.createMemberUser({
      organization: setup.organization,
    });
    const otherCaller = await createAuthenticatedCaller(otherUser.email);
    const otherProfileId = otherUser.profileId;

    const signed = await uploadProfileImageForTest({
      caller: ownerCaller,
      profileId: ownerProfileId,
      imageType: 'avatar',
    });

    // The other user may edit their own profile, but the object lives under
    // the owner's profile prefix — the trust-boundary check rejects it.
    await expect(
      otherCaller.profile.saveProfileImage({
        profileId: otherProfileId,
        storagePath: signed.storagePath,
        mimeType: 'image/png',
        imageType: 'avatar',
      }),
    ).rejects.toThrow();

    const profileRow = await getProfileImageRow(otherProfileId);
    expect(profileRow?.avatarImageId).toBeFalsy();
  });

  it('rejects a path that was signed but never uploaded', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const profileId = await getPersonalProfileId(caller);

    const signed = await caller.profile.signProfileImageUploadUrl({
      profileId,
      fileName: 'never-uploaded.png',
      imageType: 'avatar',
    });

    await expect(
      caller.profile.saveProfileImage({
        profileId,
        storagePath: signed.storagePath,
        mimeType: 'image/png',
        imageType: 'avatar',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects a non-image upload even though PDF is on the allowlist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const profileId = await getPersonalProfileId(caller);

    // A PDF passes the shared allowlist + prefix + declared==stored checks,
    // so this proves the image-only guard specifically rejects it.
    const signed = await uploadProfileImageForTest({
      caller,
      profileId,
      imageType: 'banner',
      fileName: 'photo.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 not really a pdf'),
    });

    await expect(
      caller.profile.saveProfileImage({
        profileId,
        storagePath: signed.storagePath,
        mimeType: 'application/pdf',
        imageType: 'banner',
      }),
    ).rejects.toThrow(/image/i);
  });

  it('rejects a declared mimeType that does not match the stored object', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const profileId = await getPersonalProfileId(caller);

    const signed = await uploadProfileImageForTest({
      caller,
      profileId,
      imageType: 'avatar',
    });

    await expect(
      caller.profile.saveProfileImage({
        profileId,
        storagePath: signed.storagePath,
        mimeType: 'image/jpeg',
        imageType: 'avatar',
      }),
    ).rejects.toThrow(/mimeType/i);
  });
});

describeAccessTierGating('profile.signProfileImageUploadUrl', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.signProfileImageUploadUrl({
        profileId: NIL_UUID,
        fileName: 'avatar.png',
        imageType: 'avatar',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.signProfileImageUploadUrl({
          profileId: NIL_UUID,
          fileName: 'avatar.png',
          imageType: 'avatar',
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.profile.signProfileImageUploadUrl({
          profileId: NIL_UUID,
          fileName: 'avatar.png',
          imageType: 'avatar',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.signProfileImageUploadUrl({
          profileId: NIL_UUID,
          fileName: 'avatar.png',
          imageType: 'avatar',
        }),
      );
    },
  ),
});

describeAccessTierGating('profile.saveProfileImage', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.saveProfileImage({
        profileId: NIL_UUID,
        storagePath: `profiles/${NIL_UUID}/avatar/x.png`,
        mimeType: 'image/png',
        imageType: 'avatar',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.saveProfileImage({
          profileId: NIL_UUID,
          storagePath: `profiles/${NIL_UUID}/avatar/x.png`,
          mimeType: 'image/png',
          imageType: 'avatar',
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.profile.saveProfileImage({
          profileId: NIL_UUID,
          storagePath: `profiles/${NIL_UUID}/avatar/x.png`,
          mimeType: 'image/png',
          imageType: 'avatar',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.saveProfileImage({
          profileId: NIL_UUID,
          storagePath: `profiles/${NIL_UUID}/avatar/x.png`,
          mimeType: 'image/png',
          imageType: 'avatar',
        }),
      );
    },
  ),
});
