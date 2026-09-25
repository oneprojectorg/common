import type { Page, Response } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/**
 * The app emits its Content-Security-Policy from two places, and a response
 * must never carry both:
 *
 *  - `apps/app/src/proxy.ts` mints a per-request nonce for the dynamically
 *    rendered routes its matcher catches.
 *  - `apps/app/next.config.mjs` serves a static, nonce-free policy to the HTML
 *    routes the matcher skips: `/info/*` is prerendered, so no request exists
 *    to mint a nonce from, and `/login` sits outside `app/[locale]`, so the
 *    proxy would redirect it to an `/en/login` that does not exist.
 *
 * Two policies on one response are intersected, so a nonce-free policy landing
 * on a nonced page would block every script on it.
 */

const getSolePolicy = async (response: Response | null, path: string) => {
  expect(response, `no response for ${path}`).not.toBeNull();

  // `headersArray` preserves duplicates; `headers()` would silently join them
  // and hide exactly the failure this is checking for.
  const policies = (await response!.headersArray()).filter(
    (header) => header.name.toLowerCase() === 'content-security-policy',
  );

  expect(
    policies,
    `${path} must carry exactly one Content-Security-Policy header`,
  ).toHaveLength(1);

  return policies[0]!.value;
};

const readCsp = async (page: Page, path: string) =>
  getSolePolicy(await page.goto(path), path);

const getNonce = (policy: string) =>
  policy.match(/'nonce-([^']+)'/)?.[1] ?? null;

declare global {
  interface Window {
    /** Bound by `captureViolations` below. */
    recordCspViolation?: (violation: string) => void;
  }
}

/**
 * Collects what the browser actually refused, which is the only check that
 * catches a directive that is present but too narrow. Must be called before
 * the first navigation.
 */
const captureViolations = async (page: Page) => {
  const violations: Array<string> = [];

  await page.exposeFunction('recordCspViolation', (violation: string) => {
    violations.push(violation);
  });

  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      // The source location is what makes a failure here actionable — a bare
      // directive name does not say which dependency tripped it.
      window.recordCspViolation?.(
        `${event.effectiveDirective} blocked ${event.blockedURI} from ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });

  return violations;
};

test.describe('Content-Security-Policy', () => {
  test('dynamic routes carry a nonce that every served script tag matches', async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.goto('/en/');
    const policy = await getSolePolicy(response, '/en/');
    const nonce = getNonce(policy);

    expect(nonce, 'proxy-served routes must carry a nonce').not.toBeNull();
    expect(policy).toContain("'strict-dynamic'");

    // A nonce nothing matches is the failure mode this design risks: the
    // header looks right and the page is blank. Assert against the served
    // HTML, not the live DOM — scripts the runtime injects after hydration
    // inherit trust through 'strict-dynamic' and carry no nonce by design.
    //
    // Parsed, not pattern-matched. A regex over `<script ...>` has to get tag
    // case, attribute quoting and `>` inside attribute values all right to be
    // trusted, and every way of getting it wrong silently skips the tags this
    // assertion exists to check (CodeQL js/bad-tag-filter). DOMParser builds
    // an inert document, so nothing executes and nonce attributes survive.
    const html = await response!.text();
    const nonces = await authenticatedPage.evaluate(
      (raw) =>
        [
          ...new DOMParser()
            .parseFromString(raw, 'text/html')
            .querySelectorAll('script'),
        ].map((script) => script.getAttribute('nonce')),
      html,
    );

    expect(nonces.length).toBeGreaterThan(0);
    expect(nonces.filter((value) => value !== nonce)).toEqual([]);
  });

  test('the policy denies the directives this change exists to deny', async ({
    authenticatedPage,
  }) => {
    const policy = await readCsp(authenticatedPage, '/en/');

    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  test('prerendered routes get the static policy, never a nonce', async ({
    page,
  }) => {
    const policy = await readCsp(page, '/info/privacy');

    // These pages are built once, with no request to mint a nonce from.
    expect(getNonce(policy)).toBeNull();
    expect(policy).not.toContain("'strict-dynamic'");
    expect(policy).toContain("object-src 'none'");
  });

  test('/login is reachable and served exactly one policy', async ({
    page,
  }) => {
    // /login lives outside app/[locale]. Routing it through the proxy would
    // send it through the locale redirect to a /en/login that does not exist.
    const response = await page.goto('/login');

    expect(response?.status()).toBe(200);
    expect(getNonce(await getSolePolicy(response, '/login'))).toBeNull();
  });

  test.describe('routes served the static, nonce-free policy', () => {
    // These deny 'unsafe-eval', which the nonce policy has to allow. The one
    // violation they do raise is zod's feature probe — it degrades to an
    // interpreted parser, so the page is unaffected. Anything else is a real
    // break on the login screen or the legal pages.
    const STATIC_ROUTES = [
      '/login',
      '/info/privacy',
      '/info/tos',
      '/info/community-commitments',
      '/info/columbus-addendum',
    ];

    for (const path of STATIC_ROUTES) {
      test(`${path} renders without blocking anything it needs`, async ({
        page,
      }) => {
        const violations = await captureViolations(page);
        const response = await page.goto(path);

        expect(response?.status()).toBe(200);
        // A blocked bundle still returns 200 with an empty body, so assert the
        // page rendered before trusting the violation list. Auto-retrying,
        // which also removes the need to wait on networkidle.
        await expect(page.locator('body')).not.toBeEmpty();

        expect(
          violations.filter(
            (violation) => !violation.startsWith('script-src blocked eval'),
          ),
        ).toEqual([]);
      });
    }
  });

  test('a rendered page raises no violations through hydration', async ({
    authenticatedPage,
  }) => {
    // The assertions above read the header. This one reads what the browser
    // actually did with it, which is the only check that catches a directive
    // that is present but too narrow.
    const violations = await captureViolations(authenticatedPage);

    await authenticatedPage.goto('/en/');
    await expect(
      authenticatedPage.getByRole('heading', { level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    expect(violations).toEqual([]);
  });
});
