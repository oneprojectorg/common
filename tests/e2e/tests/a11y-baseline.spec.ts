import AxeBuilder from '@axe-core/playwright';
import { profiles } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import type { ConsoleMessage, Page } from '@playwright/test';
import type { AxeResults, ImpactValue, Result } from 'axe-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '../fixtures/index.js';

type Severity = NonNullable<ImpactValue>;
type WcagCriterion = string;

interface RouteScan {
  url: string;
  /** Report-stable URL with dynamic segments replaced by placeholders. */
  displayUrl?: string;
  label: string;
  auth: 'public' | 'authenticated';
}

type RouteResult =
  | {
      url: string;
      label: string;
      auth: 'public' | 'authenticated';
      status: 'ok';
      finalUrl: string;
      counts: Record<Severity, number>;
      violations: ViolationSummary[];
      axeVersion: string;
    }
  | {
      url: string;
      label: string;
      auth: 'public' | 'authenticated';
      status: 'error';
      finalUrl?: string;
      error: string;
    };

interface ViolationSummary {
  id: string;
  impact: Severity;
  help: string;
  helpUrl: string;
  wcagCriteria: WcagCriterion[];
  nodes: ViolationNode[];
}

interface ViolationNode {
  target: string[];
  html: string;
  failureSummary: string;
  screenshotPath?: string;
}

type RuleTotal = Pick<Result, 'id' | 'help' | 'helpUrl'> & {
  impact: Severity;
  occurrences: number;
  routes: number;
  wcagCriteria: WcagCriterion[];
};

interface BaselineReport {
  axeVersion: string;
  wcagTags: string[];
  totals: Record<Severity, number>;
  totalViolations: number;
  routesScanned: number;
  ruleTotals: RuleTotal[];
  routes: RouteResult[];
  screenshotsAttempted: number;
  screenshotsCaptured: number;
}

interface BaselineSummary {
  axeVersion: string;
  wcagTags: string[];
  totals: Record<Severity, number>;
  totalViolations: number;
  routesScanned: number;
  ruleTotals: Array<Omit<RuleTotal, 'help' | 'helpUrl'>>;
  routes: Array<{
    url: string;
    label: string;
    auth: 'public' | 'authenticated';
    status: 'ok' | 'error';
    counts: Record<Severity, number>;
    error?: string;
  }>;
  screenshotsAttempted: number;
  screenshotsCaptured: number;
}

// Truncates each node's HTML in markdown <details> blocks; keeps entries roughly three lines wide
// once GitHub renders them inside a collapsed details summary.
const HTML_PREVIEW_LIMIT = 240;
const SCREENSHOT_DIR_NAME = 'screenshots';
const PER_ROUTE_TIMEOUT_MS = 90_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.resolve(__dirname, '../a11y-baseline');
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SEVERITIES: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

// React 18/19 hydration warnings are emitted via console. If any fire during a
// route render, the DOM is unstable across runs and axe will produce drifting
// counts; treat the route as errored rather than baselining a half-hydrated page.
const HYDRATION_ERROR_PATTERNS = [
  /hydration failed because the server rendered html didn't match the client/i,
  /hydration completed but contains mismatches/i,
  /hydration (text content|node|attribute) mismatch/i,
];

const DOM_SETTLE_QUIET_MS = 500;
const DOM_SETTLE_TIMEOUT_MS = 5_000;

const PUBLIC_ROUTES: RouteScan[] = [
  { url: '/login', label: 'Login', auth: 'public' },
  { url: '/info/privacy', label: 'Privacy policy', auth: 'public' },
  { url: '/info/tos', label: 'Terms of service', auth: 'public' },
];

const STATIC_AUTH_ROUTES: RouteScan[] = [
  { url: '/en/', label: 'Home', auth: 'authenticated' },
  { url: '/en/decisions', label: 'Decisions index', auth: 'authenticated' },
  { url: '/en/profile', label: 'Profile index', auth: 'authenticated' },
  { url: '/en/search', label: 'Search', auth: 'authenticated' },
  { url: '/en/org', label: 'Org index', auth: 'authenticated' },
  // Intentional: scans the not-found page so its a11y is tracked alongside real routes.
  {
    url: '/en/does-not-exist',
    label: 'Not found (404)',
    auth: 'authenticated',
  },
];

let screenshotsAttempted = 0;
let screenshotsCaptured = 0;

test.describe('axe-core baseline scan', () => {
  test.describe.configure({ mode: 'serial' });

  test('scan all baseline routes and write report', async ({
    browser,
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(15 * 60_000);

    screenshotsAttempted = 0;
    screenshotsCaptured = 0;
    rmSync(path.join(REPORT_DIR, SCREENSHOT_DIR_NAME), {
      recursive: true,
      force: true,
    });

    const dynamicAuthRoutes = await seedDynamicRoutes(org);
    const allRoutes: RouteScan[] = [
      ...PUBLIC_ROUTES,
      ...STATIC_AUTH_ROUTES,
      ...dynamicAuthRoutes,
    ];

    // Public scan must NOT inherit the auth fixture's storageState; otherwise /login redirects
    // to home and the "public" rows silently scan the authenticated experience.
    const publicContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      reducedMotion: 'reduce',
    });

    const results: RouteResult[] = [];
    let axeVersion: string | null = null;

    for (const route of allRoutes) {
      // Fresh page per public route prevents cross-route state bleed (cookies set
      // by /login flow, sessionStorage, etc.).
      const page =
        route.auth === 'authenticated'
          ? authenticatedPage
          : await publicContext.newPage();

      if (route.auth === 'public') {
        const authCookies = (await page.context().cookies()).filter((c) =>
          /^sb-.*-auth-token/.test(c.name),
        );
        if (authCookies.length > 0) {
          throw new Error(
            `public route ${route.url} has Supabase auth cookies; storageState clearing failed`,
          );
        }
      }

      const result = await scanRouteWithTimeout(page, route);
      if (result.status === 'ok' && axeVersion === null) {
        axeVersion = result.axeVersion;
      }
      results.push(result);

      if (route.auth === 'public') {
        await page.close();
      }
    }

    await publicContext.close();

    if (axeVersion === null) {
      throw new Error(
        '[a11y-baseline] no route produced a successful axe scan; nothing to baseline',
      );
    }

    const report = buildReport(results, axeVersion);
    writeReport(report);

    console.log(
      `[a11y-baseline] ${report.totalViolations} violations across ${report.routesScanned} routes`,
    );
    console.log(
      `[a11y-baseline] critical=${report.totals.critical} serious=${report.totals.serious} moderate=${report.totals.moderate} minor=${report.totals.minor}`,
    );
    console.log(
      `[a11y-baseline] screenshots ${report.screenshotsCaptured}/${report.screenshotsAttempted}`,
    );
  });
});

async function seedDynamicRoutes(
  org: CreateOrganizationResult,
): Promise<RouteScan[]> {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
  });
  const proposal = await createProposal({
    processInstanceId: instance.instance.id,
    submittedByProfileId: org.adminUser.profileId,
    proposalData: { title: 'A11y baseline proposal' },
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
  });
  const [adminProfile] = await db
    .select({ slug: profiles.slug })
    .from(profiles)
    .where(eq(profiles.id, org.adminUser.profileId));
  if (!adminProfile?.slug) {
    throw new Error(
      `admin profile slug not found for profileId=${org.adminUser.profileId}`,
    );
  }

  return [
    {
      url: `/en/org/${org.organizationProfile.slug}`,
      displayUrl: '/en/org/{slug}',
      label: 'Organization page',
      auth: 'authenticated',
    },
    {
      url: `/en/org/${org.organizationProfile.slug}/relationships`,
      displayUrl: '/en/org/{slug}/relationships',
      label: 'Org relationships',
      auth: 'authenticated',
    },
    {
      url: `/en/profile/${adminProfile.slug}`,
      displayUrl: '/en/profile/{slug}',
      label: 'User profile',
      auth: 'authenticated',
    },
    {
      url: `/en/decisions/${instance.slug}`,
      displayUrl: '/en/decisions/{slug}',
      label: 'Decision detail',
      auth: 'authenticated',
    },
    {
      url: `/en/decisions/${instance.slug}/edit`,
      displayUrl: '/en/decisions/{slug}/edit',
      label: 'Decision editor',
      auth: 'authenticated',
    },
    {
      url: `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      displayUrl: '/en/decisions/{slug}/proposal/{profileId}',
      label: 'Proposal view',
      auth: 'authenticated',
    },
    {
      url: `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      displayUrl: '/en/decisions/{slug}/proposal/{profileId}/edit',
      label: 'Proposal editor',
      auth: 'authenticated',
    },
  ];
}

async function scanRouteWithTimeout(
  page: Page,
  route: RouteScan,
): Promise<RouteResult> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<RouteResult>((resolve) => {
    timeoutId = setTimeout(() => {
      console.error(
        `[a11y-baseline] route timeout after ${PER_ROUTE_TIMEOUT_MS}ms: ${route.label} (${route.url})`,
      );
      resolve({
        url: route.displayUrl ?? route.url,
        label: route.label,
        auth: route.auth,
        status: 'error',
        error: `route timeout after ${PER_ROUTE_TIMEOUT_MS}ms`,
      });
    }, PER_ROUTE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([scanRoute(page, route), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function scanRoute(page: Page, route: RouteScan): Promise<RouteResult> {
  const reportUrl = route.displayUrl ?? route.url;
  const hydrationErrors: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (HYDRATION_ERROR_PATTERNS.some((p) => p.test(text))) {
      hydrationErrors.push(text);
    }
  };
  page.on('console', onConsole);

  try {
    await page.goto(route.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // Don't swallow the load timeout — a partial render produces a partial axe
    // scan and silently shifts the baseline. Let it throw into the catch below.
    await page.waitForLoadState('load', { timeout: 15_000 });
    // axe `color-contrast` reads computed font metrics; without this wait it
    // measures fallback-font widths and counts drift run-to-run.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // Suspense queries and React Aria autogen IDs keep swapping DOM after the
    // load event. Wait for mutations to quiet so axe sees a stable tree.
    await waitForDomSettle(page, DOM_SETTLE_QUIET_MS, DOM_SETTLE_TIMEOUT_MS);

    if (hydrationErrors.length > 0) {
      throw new Error(
        `hydration error: ${hydrationErrors[0]?.slice(0, 200) ?? ''}`,
      );
    }

    const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const violations = summarize(axe);
    await captureScreenshots(page, route, violations);
    return {
      url: reportUrl,
      label: route.label,
      auth: route.auth,
      status: 'ok',
      finalUrl: page.url(),
      counts: countBySeverity(axe),
      violations,
      axeVersion: axe.testEngine.version,
    };
  } catch (err) {
    console.error(
      `[a11y-baseline] scan failed for ${route.label} (${route.url}):`,
      err,
    );
    return {
      url: reportUrl,
      label: route.label,
      auth: route.auth,
      status: 'error',
      finalUrl: page.url(),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    page.off('console', onConsole);
  }
}

async function waitForDomSettle(
  page: Page,
  quietMs: number,
  timeoutMs: number,
): Promise<void> {
  await page.evaluate(
    ({ quietMs, timeoutMs }) =>
      new Promise<void>((resolve, reject) => {
        let lastMutation = Date.now();
        const observer = new MutationObserver(() => {
          lastMutation = Date.now();
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
        const start = Date.now();
        const tick = () => {
          if (Date.now() - lastMutation >= quietMs) {
            observer.disconnect();
            resolve();
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            observer.disconnect();
            reject(new Error(`DOM did not settle within ${timeoutMs}ms`));
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { quietMs, timeoutMs },
  );
}

async function captureScreenshots(
  page: Page,
  route: RouteScan,
  violations: ViolationSummary[],
): Promise<void> {
  // Local-only: CI skips screenshots to keep artifacts small and the scan fast.
  // Devs running `pnpm a11y:baseline` locally get the visual previews.
  if (process.env.CI) {
    return;
  }
  const routeSlug = slugForRoute(route.displayUrl ?? route.url);
  const routeDir = path.join(REPORT_DIR, SCREENSHOT_DIR_NAME, routeSlug);
  mkdirSync(routeDir, { recursive: true });

  for (const violation of violations) {
    for (const [i, node] of violation.nodes.entries()) {
      const selector = node.target[0];
      if (!selector) {
        continue;
      }
      screenshotsAttempted += 1;
      const filename = `${violation.id}-${i + 1}.png`;
      const absPath = path.join(routeDir, filename);
      const ok = await captureNodeScreenshot(page, selector, absPath);
      if (ok) {
        screenshotsCaptured += 1;
        node.screenshotPath = path.posix.join(
          SCREENSHOT_DIR_NAME,
          routeSlug,
          filename,
        );
      }
    }
  }
}

async function captureNodeScreenshot(
  page: Page,
  selector: string,
  outPath: string,
): Promise<boolean> {
  try {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count === 0) {
      console.warn(`[a11y-baseline] selector matched 0 elements: ${selector}`);
      return false;
    }
    const visible = await locator
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!visible) {
      // Common for elements in <head> (meta-viewport) or display:none — not an error.
      return false;
    }
    await locator.scrollIntoViewIfNeeded({ timeout: 1000 }).catch((err) => {
      console.warn(
        `[a11y-baseline] scrollIntoView failed for ${selector}; capturing anyway:`,
        err instanceof Error ? err.message : err,
      );
    });
    await locator.screenshot({
      path: outPath,
      animations: 'disabled',
      timeout: 2000,
    });
    return true;
  } catch (err) {
    console.warn(
      `[a11y-baseline] screenshot failed for ${selector}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function slugForRoute(url: string): string {
  return url.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'root';
}

function emptyCounts(): Record<Severity, number> {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

function sumCounts(c: Record<Severity, number>): number {
  return SEVERITIES.reduce((n, s) => n + c[s], 0);
}

function severityRank(s: Severity): number {
  return SEVERITIES.length - SEVERITIES.indexOf(s);
}

function countBySeverity(axe: AxeResults): Record<Severity, number> {
  const counts = emptyCounts();
  for (const v of axe.violations) {
    const impact = normalizeImpact(v.impact);
    if (impact) {
      counts[impact] += v.nodes.length;
    }
  }
  return counts;
}

function summarize(axe: AxeResults): ViolationSummary[] {
  const out: ViolationSummary[] = [];
  for (const v of axe.violations) {
    const impact = normalizeImpact(v.impact);
    if (!impact) {
      // Drop with a warn rather than silently downgrading: a future axe-core impact tier we
      // don't recognize must not be relabeled into an existing bucket and skew the baseline.
      console.warn(
        `[a11y-baseline] dropping violation with unknown impact: ${v.id} (impact=${v.impact})`,
      );
      continue;
    }
    out.push({
      id: v.id,
      impact,
      help: v.help,
      helpUrl: v.helpUrl,
      wcagCriteria: extractWcagCriteria(v.tags),
      nodes: v.nodes.map((n: Result['nodes'][number]) => ({
        target: n.target.map((t) =>
          Array.isArray(t) ? t.join(' ') : String(t),
        ),
        html: n.html,
        failureSummary: n.failureSummary ?? '',
      })),
    });
  }
  return out.sort((a, b) => severityRank(b.impact) - severityRank(a.impact));
}

function extractWcagCriteria(tags: string[]): WcagCriterion[] {
  const out: WcagCriterion[] = [];
  for (const tag of tags) {
    // Criterion tags are wcag<P><G><CC>: principle 1 digit, guideline 1 digit,
    // criterion 1 or 2 digits. Conformance-level tags (wcag2aa etc.) don't match.
    const match = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag);
    if (match) {
      out.push(`${match[1]}.${match[2]}.${match[3]}`);
    }
  }
  return out;
}

function normalizeImpact(impact: ImpactValue | undefined): Severity | null {
  if (
    impact === 'critical' ||
    impact === 'serious' ||
    impact === 'moderate' ||
    impact === 'minor'
  ) {
    return impact;
  }
  return null;
}

function buildReport(
  results: RouteResult[],
  axeVersion: string,
): BaselineReport {
  const totals = emptyCounts();
  const ruleAgg = new Map<
    string,
    {
      id: string;
      impact: Severity;
      occurrences: number;
      routes: Set<string>;
      help: string;
      helpUrl: string;
      wcagCriteria: WcagCriterion[];
    }
  >();

  for (const r of results) {
    if (r.status !== 'ok') {
      continue;
    }
    for (const sev of SEVERITIES) {
      totals[sev] += r.counts[sev];
    }
    for (const v of r.violations) {
      const existing = ruleAgg.get(v.id);
      if (existing) {
        existing.occurrences += v.nodes.length;
        existing.routes.add(r.url);
      } else {
        ruleAgg.set(v.id, {
          id: v.id,
          impact: v.impact,
          occurrences: v.nodes.length,
          routes: new Set([r.url]),
          help: v.help,
          helpUrl: v.helpUrl,
          wcagCriteria: v.wcagCriteria,
        });
      }
    }
  }

  const ruleTotals = Array.from(ruleAgg.values())
    .map((r) => ({
      id: r.id,
      impact: r.impact,
      occurrences: r.occurrences,
      routes: r.routes.size,
      help: r.help,
      helpUrl: r.helpUrl,
      wcagCriteria: r.wcagCriteria,
    }))
    .sort(
      (a, b) =>
        severityRank(b.impact) - severityRank(a.impact) ||
        b.occurrences - a.occurrences,
    );

  return {
    axeVersion,
    wcagTags: WCAG_TAGS,
    totals,
    totalViolations: sumCounts(totals),
    routesScanned: results.length,
    ruleTotals,
    routes: results,
    screenshotsAttempted,
    screenshotsCaptured,
  };
}

function buildSummary(report: BaselineReport): BaselineSummary {
  return {
    axeVersion: report.axeVersion,
    wcagTags: report.wcagTags,
    totals: report.totals,
    totalViolations: report.totalViolations,
    routesScanned: report.routesScanned,
    ruleTotals: report.ruleTotals.map((r) => ({
      id: r.id,
      impact: r.impact,
      occurrences: r.occurrences,
      routes: r.routes,
      wcagCriteria: r.wcagCriteria,
    })),
    routes: report.routes.map((r) => {
      if (r.status === 'ok') {
        return {
          url: r.url,
          label: r.label,
          auth: r.auth,
          status: 'ok',
          counts: r.counts,
        };
      }
      return {
        url: r.url,
        label: r.label,
        auth: r.auth,
        status: 'error',
        counts: emptyCounts(),
        error: r.error,
      };
    }),
    screenshotsAttempted: report.screenshotsAttempted,
    screenshotsCaptured: report.screenshotsCaptured,
  };
}

function writeReport(report: BaselineReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  // summary.json is committed and used for PR-vs-base diffing — kept small and stable.
  // report.json carries full per-node detail (selectors, html snippets, screenshot paths)
  // and is gitignored because those churn every run.
  writeFileSync(
    path.join(REPORT_DIR, 'summary.json'),
    `${JSON.stringify(buildSummary(report), null, 2)}\n`,
  );
  writeFileSync(
    path.join(REPORT_DIR, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(path.join(REPORT_DIR, 'report.md'), renderMarkdown(report));
}

function renderMarkdown(r: BaselineReport): string {
  const lines: string[] = [];
  lines.push('# Accessibility Baseline Scan');
  lines.push('');
  lines.push(`Engine: axe-core ${r.axeVersion}`);
  lines.push(`WCAG tags: ${r.wcagTags.join(', ')}`);
  if (r.screenshotsAttempted > 0) {
    lines.push(
      `Screenshots: ${r.screenshotsCaptured}/${r.screenshotsAttempted} captured`,
    );
  }
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push('| Severity | Violation nodes |');
  lines.push('| --- | ---: |');
  for (const sev of SEVERITIES) {
    lines.push(`| ${sev} | ${r.totals[sev]} |`);
  }
  lines.push(`| **total** | **${r.totalViolations}** |`);
  lines.push('');
  lines.push('## By route');
  lines.push('');
  lines.push(
    '| Route | Status | Critical | Serious | Moderate | Minor | Total |',
  );
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const route of r.routes) {
    if (route.status === 'ok') {
      const total = sumCounts(route.counts);
      lines.push(
        `| \`${route.url}\` (${route.label}) | ok | ${route.counts.critical} | ${route.counts.serious} | ${route.counts.moderate} | ${route.counts.minor} | ${total} |`,
      );
    } else {
      lines.push(
        `| \`${route.url}\` (${route.label}) | error | — | — | — | — | — |`,
      );
    }
  }
  lines.push('');
  lines.push('## Top rules');
  lines.push('');
  lines.push('| Rule | Impact | WCAG | Nodes | Routes | Help |');
  lines.push('| --- | --- | --- | ---: | ---: | --- |');
  for (const rule of r.ruleTotals.slice(0, 30)) {
    lines.push(
      `| \`${rule.id}\` | ${rule.impact} | ${rule.wcagCriteria.join(', ') || '—'} | ${rule.occurrences} | ${rule.routes} | [${rule.help}](${rule.helpUrl}) |`,
    );
  }
  lines.push('');
  for (const route of r.routes) {
    lines.push(`### \`${route.url}\` — ${route.label}`);
    lines.push('');
    if (route.status === 'error') {
      lines.push(`> Scan error: ${route.error}`);
      lines.push('');
      continue;
    }
    if (route.violations.length === 0) {
      lines.push('No violations.');
      lines.push('');
      continue;
    }
    lines.push('| Rule | Impact | WCAG | Nodes | Help |');
    lines.push('| --- | --- | --- | ---: | --- |');
    for (const v of route.violations) {
      lines.push(
        `| \`${v.id}\` | ${v.impact} | ${v.wcagCriteria.join(', ') || '—'} | ${v.nodes.length} | [${v.help}](${v.helpUrl}) |`,
      );
    }
    lines.push('');
    for (const v of route.violations) {
      const count = v.nodes.length;
      lines.push(
        `<details><summary><code>${v.id}</code> — ${count} node${count === 1 ? '' : 's'}</summary>`,
      );
      lines.push('');
      for (const n of v.nodes) {
        const selector = n.target.map((t) => `\`${t}\``).join(' › ');
        lines.push(`- ${selector}`);
        lines.push('');
        if (n.screenshotPath) {
          lines.push(`  ![${v.id} preview](${n.screenshotPath})`);
          lines.push('');
        }
        lines.push('  ```html');
        lines.push(`  ${truncate(n.html, HTML_PREVIEW_LIMIT)}`);
        lines.push('  ```');
        lines.push('');
        if (n.failureSummary) {
          for (const line of n.failureSummary.split('\n')) {
            const trimmed = line.replace(/^\s+/, '');
            if (!trimmed) {
              lines.push('');
              continue;
            }
            const isHeader = /:$/.test(trimmed);
            lines.push(isHeader ? `  ${trimmed}` : `  - ${trimmed}`);
          }
        }
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

function truncate(s: string, max: number): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
