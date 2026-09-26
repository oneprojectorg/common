import type { Page, Response } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/**
 * The policy comes from the proxy (per-request nonce) or from
 * `next.config.mjs` (static, for the routes the matcher skips), never both —
 * two policies on one response are intersected and block every script.
 */

const getSolePolicy = async (response: Response | null, path: string) => {
  expect(response, `no response for ${path}`).not.toBeNull();

  // `headersArray` preserves duplicates; `headers()` would join them and hide
  // the failure this is checking for.
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

/** What the browser actually refused. Call before the first navigation. */
const captureViolations = async (page: Page) => {
  const violations: Array<string> = [];

  await page.exposeFunction('recordCspViolation', (violation: string) => {
    violations.push(violation);
  });

  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      // The source location is what makes a failure actionable.
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

    // The served HTML, not the live DOM: scripts the runtime injects after
    // hydration inherit trust through 'strict-dynamic' and carry no nonce.
    // Parsed rather than regexed so tag case and attribute quoting are the
    // parser's problem (CodeQL js/bad-tag-filter); DOMParser is inert.
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

    expect(getNonce(policy)).toBeNull();
    expect(policy).not.toContain("'strict-dynamic'");
    expect(policy).toContain("object-src 'none'");
  });

  test('/login is reachable and served exactly one policy', async ({
    page,
  }) => {
    const response = await page.goto('/login');

    expect(response?.status()).toBe(200);
    expect(getNonce(await getSolePolicy(response, '/login'))).toBeNull();
  });

  test.describe('routes served the static, nonce-free policy', () => {
    // These deny 'unsafe-eval'. The one violation they raise is zod's feature
    // probe, which degrades to an interpreted parser; anything else is a real
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
        // A blocked bundle still returns 200 with an empty body.
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
    const violations = await captureViolations(authenticatedPage);

    await authenticatedPage.goto('/en/');
    await expect(
      authenticatedPage.getByRole('heading', { level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    expect(violations).toEqual([]);
  });
});
