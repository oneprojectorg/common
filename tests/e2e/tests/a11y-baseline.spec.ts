import AxeBuilder from '@axe-core/playwright';
import type { AxeResults, ImpactValue, Result } from 'axe-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '../fixtures/index.js';

type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

interface RouteScan {
  url: string;
  label: string;
  auth: boolean;
}

interface RouteResult {
  url: string;
  label: string;
  auth: boolean;
  status: 'ok' | 'error';
  finalUrl?: string;
  error?: string;
  counts: Record<Severity, number>;
  violations: ViolationSummary[];
  axeVersion?: string;
}

interface ViolationSummary {
  id: string;
  impact: Severity;
  help: string;
  helpUrl: string;
  nodeCount: number;
  nodes: ViolationNode[];
}

interface ViolationNode {
  target: string[];
  html: string;
  failureSummary: string;
  screenshotPath?: string;
}

const HTML_PREVIEW_LIMIT = 240;
const SCREENSHOT_DIR_NAME = 'screenshots';

interface BaselineReport {
  generatedAt: string;
  axeVersion: string;
  wcagTags: string[];
  totals: Record<Severity, number>;
  totalViolations: number;
  routesScanned: number;
  ruleTotals: Array<{
    id: string;
    impact: Severity;
    occurrences: number;
    routes: number;
    help: string;
    helpUrl: string;
  }>;
  routes: RouteResult[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.resolve(__dirname, '../a11y-baseline');
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SEVERITIES: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

const PUBLIC_ROUTES: RouteScan[] = [
  { url: '/login', label: 'Login', auth: false },
  { url: '/info/privacy', label: 'Privacy policy', auth: false },
  { url: '/info/tos', label: 'Terms of service', auth: false },
];

const STATIC_AUTH_ROUTES: RouteScan[] = [
  { url: '/en/', label: 'Home', auth: true },
  { url: '/en/decisions', label: 'Decisions index', auth: true },
  { url: '/en/profile', label: 'Profile index', auth: true },
  { url: '/en/search', label: 'Search', auth: true },
  { url: '/en/org', label: 'Org index', auth: true },
];

test.describe('axe-core baseline scan', () => {
  test.describe.configure({ mode: 'serial' });

  test('scan all baseline routes and write report', async ({
    browser,
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(5 * 60_000);

    const dynamicAuthRoutes: RouteScan[] = [
      {
        url: `/en/org/${org.organizationProfile.slug}`,
        label: 'Organization page',
        auth: true,
      },
    ];

    const allRoutes: RouteScan[] = [
      ...PUBLIC_ROUTES,
      ...STATIC_AUTH_ROUTES,
      ...dynamicAuthRoutes,
    ];

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    const results: RouteResult[] = [];
    let axeVersion = 'unknown';

    for (const route of allRoutes) {
      const page = route.auth ? authenticatedPage : publicPage;
      const result = await scanRoute(page, route);
      if (result.axeVersion) {
        axeVersion = result.axeVersion;
      }
      results.push(result);
    }

    await publicContext.close();

    const report = buildReport(results, axeVersion);
    writeReport(report);

    console.log(
      `[a11y-baseline] ${report.totalViolations} violations across ${report.routesScanned} routes`,
    );
    console.log(
      `[a11y-baseline] critical=${report.totals.critical} serious=${report.totals.serious} moderate=${report.totals.moderate} minor=${report.totals.minor}`,
    );
  });
});

async function scanRoute(
  page: import('@playwright/test').Page,
  route: RouteScan,
): Promise<RouteResult> {
  const empty: Record<Severity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  try {
    await page.goto(route.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {
        // networkidle can flake on apps with persistent connections; proceed anyway
      });

    await page.emulateMedia({ reducedMotion: 'reduce' });

    const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const violations = summarize(axe);
    await captureScreenshots(page, route, violations);
    return {
      url: route.url,
      label: route.label,
      auth: route.auth,
      status: 'ok',
      finalUrl: page.url(),
      counts: countBySeverity(axe),
      violations,
      axeVersion: axe.testEngine.version,
    };
  } catch (err) {
    return {
      url: route.url,
      label: route.label,
      auth: route.auth,
      status: 'error',
      finalUrl: page.url(),
      error: err instanceof Error ? err.message : String(err),
      counts: empty,
      violations: [],
    };
  }
}

async function captureScreenshots(
  page: import('@playwright/test').Page,
  route: RouteScan,
  violations: ViolationSummary[],
): Promise<void> {
  const routeDir = path.join(
    REPORT_DIR,
    SCREENSHOT_DIR_NAME,
    slugForRoute(route.url),
  );
  mkdirSync(routeDir, { recursive: true });

  for (const violation of violations) {
    for (let i = 0; i < violation.nodes.length; i++) {
      const node = violation.nodes[i]!;
      const selector = node.target[0];
      if (!selector) {
        continue;
      }
      const filename = `${violation.id}-${i + 1}.png`;
      const absPath = path.join(routeDir, filename);
      const ok = await captureNodeScreenshot(page, selector, absPath);
      if (ok) {
        node.screenshotPath = path.posix.join(
          SCREENSHOT_DIR_NAME,
          slugForRoute(route.url),
          filename,
        );
      }
    }
  }
}

async function captureNodeScreenshot(
  page: import('@playwright/test').Page,
  selector: string,
  outPath: string,
): Promise<boolean> {
  try {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count === 0) {
      return false;
    }
    const visible = await locator
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!visible) {
      return false;
    }
    await locator.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
    await locator.screenshot({
      path: outPath,
      animations: 'disabled',
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

function slugForRoute(url: string): string {
  const slug = url
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'root';
}

function countBySeverity(axe: AxeResults): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const v of axe.violations) {
    const impact = normalizeImpact(v.impact);
    if (impact) {
      counts[impact] += v.nodes.length;
    }
  }
  return counts;
}

function summarize(axe: AxeResults): ViolationSummary[] {
  return axe.violations
    .map((v: Result) => ({
      id: v.id,
      impact: normalizeImpact(v.impact) ?? 'minor',
      help: v.help,
      helpUrl: v.helpUrl,
      nodeCount: v.nodes.length,
      nodes: v.nodes.map((n) => ({
        target: n.target.map((t) =>
          Array.isArray(t) ? t.join(' ') : String(t),
        ),
        html: n.html,
        failureSummary: n.failureSummary ?? '',
      })),
    }))
    .sort((a, b) => severityRank(b.impact) - severityRank(a.impact));
}

function normalizeImpact(
  impact: ImpactValue | null | undefined,
): Severity | null {
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

function severityRank(s: Severity): number {
  switch (s) {
    case 'critical':
      return 4;
    case 'serious':
      return 3;
    case 'moderate':
      return 2;
    case 'minor':
      return 1;
  }
}

function buildReport(
  results: RouteResult[],
  axeVersion: string,
): BaselineReport {
  const totals: Record<Severity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  const ruleAgg = new Map<
    string,
    {
      id: string;
      impact: Severity;
      occurrences: number;
      routes: Set<string>;
      help: string;
      helpUrl: string;
    }
  >();

  for (const r of results) {
    for (const sev of SEVERITIES) {
      totals[sev] += r.counts[sev];
    }
    for (const v of r.violations) {
      const existing = ruleAgg.get(v.id);
      if (existing) {
        existing.occurrences += v.nodeCount;
        existing.routes.add(r.url);
      } else {
        ruleAgg.set(v.id, {
          id: v.id,
          impact: v.impact,
          occurrences: v.nodeCount,
          routes: new Set([r.url]),
          help: v.help,
          helpUrl: v.helpUrl,
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
    }))
    .sort(
      (a, b) =>
        severityRank(b.impact) - severityRank(a.impact) ||
        b.occurrences - a.occurrences,
    );

  return {
    generatedAt: new Date().toISOString(),
    axeVersion,
    wcagTags: WCAG_TAGS,
    totals,
    totalViolations:
      totals.critical + totals.serious + totals.moderate + totals.minor,
    routesScanned: results.length,
    ruleTotals,
    routes: results,
  };
}

function writeReport(report: BaselineReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
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
  lines.push(`Generated: ${r.generatedAt}`);
  lines.push(`Engine: axe-core ${r.axeVersion}`);
  lines.push(`WCAG tags: ${r.wcagTags.join(', ')}`);
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
    const total =
      route.counts.critical +
      route.counts.serious +
      route.counts.moderate +
      route.counts.minor;
    lines.push(
      `| \`${route.url}\` (${route.label}) | ${route.status} | ${route.counts.critical} | ${route.counts.serious} | ${route.counts.moderate} | ${route.counts.minor} | ${total} |`,
    );
  }
  lines.push('');
  lines.push('## Top rules');
  lines.push('');
  lines.push('| Rule | Impact | Nodes | Routes | Help |');
  lines.push('| --- | --- | ---: | ---: | --- |');
  for (const rule of r.ruleTotals.slice(0, 30)) {
    lines.push(
      `| \`${rule.id}\` | ${rule.impact} | ${rule.occurrences} | ${rule.routes} | [${rule.help}](${rule.helpUrl}) |`,
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
    lines.push('| Rule | Impact | Nodes | Help |');
    lines.push('| --- | --- | ---: | --- |');
    for (const v of route.violations) {
      lines.push(
        `| \`${v.id}\` | ${v.impact} | ${v.nodeCount} | [${v.help}](${v.helpUrl}) |`,
      );
    }
    lines.push('');
    for (const v of route.violations) {
      lines.push(
        `<details><summary><code>${v.id}</code> — ${v.nodeCount} node${v.nodeCount === 1 ? '' : 's'}</summary>`,
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
