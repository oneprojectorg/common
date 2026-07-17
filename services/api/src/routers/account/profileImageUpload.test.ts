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

// 1x1 PNG; small enough to keep tests cheap, still a valid image.
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

/**
 * Runs the production profile-image upload sequence via a tRPC caller: sign
 * URL, PUT to storage (service-role admin client), leaving the record step to
 * the test. Returns the signed path so callers can assert on it.
 */
async function uploadProfileImageForTest({
  caller,
  imageType,
  fileName = 'photo.png',
  mimeType = 'image/png',
  body = TEST_PNG_BUFFER,
}: {
  caller: AuthenticatedCaller;
  imageType: 'avatar' | 'banner';
  fileName?: string;
  mimeType?: string;
  body?: Buffer;
}) {
  const signed = await caller.account.signProfileImageUploadUrl({
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

async function getUserImageRows(userEmail: string) {
  const userRow = await db.query.users.findFirst({
    where: { email: userEmail },
    columns: { avatarImageId: true, profileId: true },
  });
  const profileRow = userRow?.profileId
    ? await db.query.profiles.findFirst({
        where: { id: userRow.profileId },
        columns: { avatarImageId: true, headerImageId: true },
      })
    : undefined;
  return { userRow, profileRow };
}

describe.concurrent('saveProfileImage', () => {
  it('records an uploaded avatar on both the user and their personal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const signed = await uploadProfileImageForTest({
      caller,
      imageType: 'avatar',
    });
    const result = await caller.account.saveProfileImage({
      storagePath: signed.storagePath,
      mimeType: 'image/png',
      imageType: 'avatar',
    });
    expect(result.storagePath).toBe(signed.storagePath);

    const { userRow, profileRow } = await getUserImageRows(setup.userEmail);
    expect(userRow?.avatarImageId).toBeTruthy();
    expect(profileRow?.avatarImageId).toBe(userRow?.avatarImageId);
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

    const signed = await uploadProfileImageForTest({
      caller,
      imageType: 'banner',
    });
    await caller.account.saveProfileImage({
      storagePath: signed.storagePath,
      mimeType: 'image/png',
      imageType: 'banner',
    });

    const { profileRow } = await getUserImageRows(setup.userEmail);
    expect(profileRow?.headerImageId).toBeTruthy();
  });

  it('rejects a storage path uploaded by another user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const otherUser = await testData.createMemberUser({
      organization: setup.organization,
    });
    const otherCaller = await createAuthenticatedCaller(otherUser.email);

    const signed = await uploadProfileImageForTest({
      caller: ownerCaller,
      imageType: 'avatar',
    });

    // The path prefix is scoped to the uploader's user id, so another caller
    // can't claim the object.
    await expect(
      otherCaller.account.saveProfileImage({
        storagePath: signed.storagePath,
        mimeType: 'image/png',
        imageType: 'avatar',
      }),
    ).rejects.toThrow();

    const { userRow } = await getUserImageRows(otherUser.email);
    expect(userRow?.avatarImageId).toBeFalsy();
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

    const signed = await caller.account.signProfileImageUploadUrl({
      fileName: 'never-uploaded.png',
      imageType: 'avatar',
    });

    await expect(
      caller.account.saveProfileImage({
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

    // A PDF passes the shared allowlist + prefix + declared==stored checks,
    // so this proves the image-only guard specifically rejects it.
    const signed = await uploadProfileImageForTest({
      caller,
      imageType: 'banner',
      fileName: 'photo.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 not really a pdf'),
    });

    await expect(
      caller.account.saveProfileImage({
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

    const signed = await uploadProfileImageForTest({
      caller,
      imageType: 'avatar',
    });

    await expect(
      caller.account.saveProfileImage({
        storagePath: signed.storagePath,
        mimeType: 'image/jpeg',
        imageType: 'avatar',
      }),
    ).rejects.toThrow(/mimeType/i);
  });
});

describeAccessTierGating('account.signProfileImageUploadUrl', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.account.signProfileImageUploadUrl({
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
        caller.account.signProfileImageUploadUrl({
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
        caller.account.signProfileImageUploadUrl({
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
        caller.account.signProfileImageUploadUrl({
          fileName: 'avatar.png',
          imageType: 'avatar',
        }),
      );
    },
  ),
});

describeAccessTierGating('account.saveProfileImage', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.account.saveProfileImage({
        storagePath: 'x/avatar/x.png',
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
        caller.account.saveProfileImage({
          storagePath: 'x/avatar/x.png',
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
        caller.account.saveProfileImage({
          storagePath: 'x/avatar/x.png',
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
        caller.account.saveProfileImage({
          storagePath: 'x/avatar/x.png',
          mimeType: 'image/png',
          imageType: 'avatar',
        }),
      );
    },
  ),
});
