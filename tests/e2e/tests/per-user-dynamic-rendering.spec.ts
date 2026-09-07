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
 * The authed layout renders `SiteHeader` and the landing headline on the
 * server, and the headline greets the signed-in user by name. Nothing about
 * that render may survive the request: a cached one would greet the next
 * visitor with the previous visitor's name.
 *
 * `(main)/layout.tsx` is `force-dynamic` and every server-side user read goes
 * through `cookies()`, so this should hold — these are the executable proof,
 * because the failure mode is silent and only appears with two real users.
 */
test.describe('Per-user server rendering', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('two users hitting the same server each get their own server-rendered headline', async ({
    browser,
  }) => {
    const [orgA, orgB] = await Promise.all([
      createOrganization({
        testId: `dyn-a-${randomUUID().slice(0, 6)}`,
        supabaseAdmin: admin,
        users: { admin: 1, member: 0 },
      }),
      createOrganization({
        testId: `dyn-b-${randomUUID().slice(0, 6)}`,
        supabaseAdmin: admin,
        users: { admin: 1, member: 0 },
      }),
    ]);

    // A fresh admin's `currentProfile` is their own individual profile, so
    // the headline greets the person, not the org.
    const nameA = profileNameOf(orgA);
    const nameB = profileNameOf(orgB);
    expect(nameA).not.toBe(nameB);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      await authenticateAsUser(pageA, {
        email: orgA.adminUser.email,
        password: TEST_USER_DEFAULT_PASSWORD,
      });
      await authenticateAsUser(pageB, {
        email: orgB.adminUser.email,
        password: TEST_USER_DEFAULT_PASSWORD,
      });

      // A first, then B, against the same running server. If the landing
      // render were cached, B would be served A's headline.
      await pageA.goto('/en/', { waitUntil: 'domcontentloaded' });
      await expect(pageA.getByTestId('welcome-heading')).toContainText(nameA);

      await pageB.goto('/en/', { waitUntil: 'domcontentloaded' });
      await expect(pageB.getByTestId('welcome-heading')).toContainText(nameB);
      await expect(pageB.getByTestId('welcome-heading')).not.toContainText(
        nameA,
      );

      // Re-check A after B rendered, to catch a cache that is populated by
      // whichever request happens to land last.
      await pageA.reload({ waitUntil: 'domcontentloaded' });
      await expect(pageA.getByTestId('welcome-heading')).toContainText(nameA);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('switching accounts in one browser re-renders the headline for the new user', async ({
    page,
  }) => {
    const [orgA, orgB] = await Promise.all([
      createOrganization({
        testId: `dyn-swap-a-${randomUUID().slice(0, 6)}`,
        supabaseAdmin: admin,
        users: { admin: 1, member: 0 },
      }),
      createOrganization({
        testId: `dyn-swap-b-${randomUUID().slice(0, 6)}`,
        supabaseAdmin: admin,
        users: { admin: 1, member: 0 },
      }),
    ]);

    await authenticateAsUser(page, {
      email: orgA.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await page.goto('/en/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('welcome-heading')).toContainText(
      profileNameOf(orgA),
    );

    // Same browser, same cookie jar, different session: the server must not
    // reuse the render it just produced for the previous occupant.
    await authenticateAsUser(page, {
      email: orgB.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await page.goto('/en/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('welcome-heading')).toContainText(
      profileNameOf(orgB),
    );
    await expect(page.getByTestId('welcome-heading')).not.toContainText(
      profileNameOf(orgA),
    );
  });

  test('the landing page is served uncacheable, never as a shared static document', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `dyn-hdr-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });

    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    const response = await page.goto('/en/', {
      waitUntil: 'domcontentloaded',
    });
    const cacheControl = response?.headers()['cache-control'] ?? '';

    // Next marks a dynamically rendered document no-store. A `public` or
    // `s-maxage` document here would let a shared cache serve one user's
    // header and headline to the next.
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).not.toContain('public');
    expect(cacheControl).not.toContain('s-maxage');
  });
});

/** The signed-in admin's own profile name, which the headline greets. */
function profileNameOf(org: { adminUser: { email: string } }): string {
  const [localPart] = org.adminUser.email.split('@');
  if (!localPart) {
    throw new Error(`Unexpected fixture email: ${org.adminUser.email}`);
  }
  return localPart;
}
