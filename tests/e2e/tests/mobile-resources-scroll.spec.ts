import {
  resourceCollectionItems,
  resourceCollectionProfiles,
  resourceCollections,
  resources,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createDecisionInstance, getSeededTemplate } from '@op/test';
import type { Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * The Resources rows are both the drag target and the scroll surface, and both
 * have to keep working. E2E because `touch-action` only resolves once Tailwind
 * has compiled and a browser has rendered the row.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const RESOURCE_COUNT = 8;

test.use({ viewport: MOBILE_VIEWPORT });

test.describe('Resources panel on mobile', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('a manager can pan the overflowing resource list and still drag it into a new order', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `resources-scroll-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });
    await seedLinkResources({
      profileId: instance.profileId,
      count: RESOURCE_COUNT,
    });

    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    // The panel's open state lives in the URL, so this lands on the tab.
    await page.goto(`/en/decisions/${instance.slug}?panel=resources`, {
      waitUntil: 'domcontentloaded',
    });

    const panel = page.locator('[data-slot="sheet-content"]');
    const rows = panel.getByRole('listitem');
    await expect(rows).toHaveCount(RESOURCE_COUNT, { timeout: 20000 });

    // Without this the pan check below would pass on a panel that simply fits.
    const listOverflowsItsScroller = await rows.first().evaluate((row) => {
      for (let node = row.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return node.scrollHeight > node.clientHeight;
        }
      }
      return false;
    });
    expect(listOverflowsItsScroller).toBe(true);

    for (const row of await rows.all()) {
      await expectVerticalPanAllowed(row);
    }

    // Stripping the drag listeners would satisfy the pan check on its own.
    await expect(rows.first()).toHaveAccessibleName('Seeded resource 1');
    await dragRowOntoTheNext(rows.first(), rows.nth(1));
    await expect(rows.first()).toHaveAccessibleName('Seeded resource 2');
  });
});

// Stepped, not one jump: a single move past MouseSensor's 8px threshold drops
// before the sortable strategy has shifted anything.
async function dragRowOntoTheNext(row: Locator, next: Locator) {
  const page = row.page();
  const from = await boundingBox(row);
  const to = await boundingBox(next);
  const x = from.x + from.width / 2;
  const startY = from.y + 20;
  const endY = to.y + 20;

  await page.mouse.move(x, startY);
  await page.mouse.down();
  const steps = 12;
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(x, startY + ((endY - startY) * step) / steps);
  }
  await page.mouse.up();
}

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element is not rendered, so its geometry cannot be read.');
  }
  return box;
}

// The contract, not the keyword: any value permitting a vertical pan will do.
async function expectVerticalPanAllowed(row: Locator) {
  const touchAction = await row.evaluate(
    (element) => getComputedStyle(element).touchAction,
  );
  expect(
    touchAction === 'auto' ||
      touchAction === 'manipulation' ||
      touchAction.includes('pan-y'),
    `touch-action: ${touchAction} blocks a vertical pan on this row`,
  ).toBe(true);
}

// Seeded directly because the Add Resource flow needs storage and link
// unfurling. Sort keys are fractional in production but only read as ordered
// ASCII, so padded indices sort the same.
async function seedLinkResources({
  profileId,
  count,
}: {
  profileId: string;
  count: number;
}) {
  const sortKeyAt = (index: number) => `a${String(index).padStart(4, '0')}`;

  const [collection] = await db
    .insert(resourceCollections)
    .values({ name: 'Default' })
    .returning();
  if (!collection) {
    throw new Error('Failed to seed a resource collection.');
  }

  await db.insert(resourceCollectionProfiles).values({
    collectionId: collection.id,
    profileId,
    sortKey: sortKeyAt(0),
  });

  const inserted = await db
    .insert(resources)
    .values(
      Array.from({ length: count }, (_, index) => ({
        title: `Seeded resource ${index + 1}`,
        linkUrl: `https://example.com/resource-${index + 1}`,
      })),
    )
    .returning();
  if (inserted.length !== count) {
    throw new Error(`Seeded ${inserted.length} of ${count} resources.`);
  }

  // `returning()` keeps insert order, so index matches title.
  await db.insert(resourceCollectionItems).values(
    inserted.map((resource, index) => ({
      collectionId: collection.id,
      resourceId: resource.id,
      sortKey: sortKeyAt(index),
    })),
  );
}
