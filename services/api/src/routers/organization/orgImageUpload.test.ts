import { db, eq } from '@op/db/client';
import { organizationUsers, organizations, profiles } from '@op/db/schema';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
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
 * Runs the production draft-image upload sequence via a tRPC caller: sign a
 * draft-space URL, PUT to storage (service-role admin client). The returned
 * path is what the org forms pass into organization.create/update.
 */
async function uploadDraftImageForTest({
  caller,
  fileName = 'logo.png',
  mimeType = 'image/png',
  body = TEST_PNG_BUFFER,
}: {
  caller: AuthenticatedCaller;
  fileName?: string;
  mimeType?: string;
  body?: Buffer;
}) {
  const signed = await caller.profile.signDraftProfileImageUploadUrl({
    fileName,
  });

  const { error } = await supabaseTestAdminClient.storage
    .from('assets')
    .upload(signed.storagePath, body, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(`draft image test upload failed: ${error.message}`);
  }

  return signed;
}

async function getOrgProfileImageRow(organizationId: string) {
  const orgRow = await db.query.organizations.findFirst({
    where: { id: organizationId },
    columns: { profileId: true },
  });
  if (!orgRow) {
    throw new Error('organization not found');
  }
  return db.query.profiles.findFirst({
    where: { id: orgRow.profileId },
    columns: { avatarImageId: true, headerImageId: true },
  });
}

describe.concurrent('organization draft image claim', () => {
  it('organization.create persists claimed draft avatar and banner', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization();
    const caller = await createAuthenticatedCaller(adminUser.email);

    const avatar = await uploadDraftImageForTest({ caller });
    const banner = await uploadDraftImageForTest({
      caller,
      fileName: 'banner.png',
    });

    const created = await caller.organization.create({
      name: `Image Org ${task.id}`,
      website: 'https://example.com',
      orgType: 'nonprofit',
      bio: 'org with images',
      orgAvatarImagePath: avatar.storagePath,
      orgBannerImagePath: banner.storagePath,
    });
    // The org was created through the API, not the data manager, so it needs
    // its own cleanup or the global deseed check fails.
    onTestFinished(async () => {
      const orgRow = await db.query.organizations.findFirst({
        where: { id: created.id },
        columns: { profileId: true },
      });
      await db
        .delete(organizationUsers)
        .where(eq(organizationUsers.organizationId, created.id));
      await db.delete(organizations).where(eq(organizations.id, created.id));
      if (orgRow) {
        await db.delete(profiles).where(eq(profiles.id, orgRow.profileId));
      }
    });

    const profileRow = await getOrgProfileImageRow(created.id);
    expect(profileRow?.avatarImageId).toBeTruthy();
    expect(profileRow?.headerImageId).toBeTruthy();
  });

  it("organization.create rejects a draft path from another user's draft space", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser, memberUsers } = await testData.createOrganization({
      users: { admin: 1, member: 1 },
    });
    const ownerCaller = await createAuthenticatedCaller(adminUser.email);
    const otherCaller = await createAuthenticatedCaller(memberUsers[0]!.email);

    const avatar = await uploadDraftImageForTest({ caller: ownerCaller });

    await expect(
      otherCaller.organization.create({
        name: `Stolen Image Org ${task.id}`,
        website: 'https://example.com',
        orgType: 'nonprofit',
        bio: 'should fail',
        orgAvatarImagePath: avatar.storagePath,
      }),
    ).rejects.toThrow(/does not belong/i);
  });

  it('organization.update claims a new draft banner and leaves omitted images untouched', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUser } = await testData.createOrganization();
    const caller = await createAuthenticatedCaller(adminUser.email);

    const banner = await uploadDraftImageForTest({
      caller,
      fileName: 'banner.png',
    });
    await caller.organization.update({
      id: organization.id,
      orgBannerImagePath: banner.storagePath,
    });

    const afterBanner = await getOrgProfileImageRow(organization.id);
    expect(afterBanner?.headerImageId).toBeTruthy();

    // A follow-up update without image paths must not clear the banner.
    await caller.organization.update({
      id: organization.id,
      bio: 'updated bio',
    });
    const afterBioOnly = await getOrgProfileImageRow(organization.id);
    expect(afterBioOnly?.headerImageId).toBe(afterBanner?.headerImageId);
  });

  it('organization.update rejects a non-image draft object', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUser } = await testData.createOrganization();
    const caller = await createAuthenticatedCaller(adminUser.email);

    // A PDF is on the shared upload allowlist, so this proves the image-only
    // guard in the claim specifically rejects it.
    const pdf = await uploadDraftImageForTest({
      caller,
      fileName: 'not-an-image.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 not really a pdf'),
    });

    await expect(
      caller.organization.update({
        id: organization.id,
        orgAvatarImagePath: pdf.storagePath,
      }),
    ).rejects.toThrow(/image/i);
  });
});
