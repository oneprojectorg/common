import { readFileSync } from 'node:fs';

type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

interface RuleSummary {
  id: string;
  impact: Severity;
  occurrences: number;
  routes: number;
  wcagCriteria: string[];
}

interface RouteSummary {
  url: string;
  label: string;
  status: 'ok' | 'error';
  counts: Record<Severity, number>;
}

interface BaselineSummary {
  axeVersion?: string;
  wcagTags?: string[];
  totals?: Record<Severity, number>;
  totalViolations?: number;
  routesScanned?: number;
  ruleTotals?: RuleSummary[];
  routes?: RouteSummary[];
  screenshotsAttempted?: number;
  screenshotsCaptured?: number;
}

const SEVERITIES: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

const [, , basePath, currentPath, artifactUrl] = process.argv;
if (!basePath || !currentPath) {
  console.error(
    'Usage: a11y-baseline-diff.ts <base-summary> <current-summary> [artifact-url]',
  );
  process.exit(2);
}

const base = readSummary(basePath);
const current = readSummary(currentPath);

console.log(render(base, current, artifactUrl));

function readSummary(p: string): BaselineSummary {
  try {
    const text = readFileSync(p, 'utf8').trim();
    if (!text) {
      return {};
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function render(
  base: BaselineSummary,
  current: BaselineSummary,
  artifactUrl: string | undefined,
): string {
  const lines: string[] = [];
  lines.push('<!-- a11y-baseline-diff -->');
  lines.push('## Accessibility baseline diff');
  lines.push('');

  const baseScanned = !!base.totals;
  if (!baseScanned) {
    lines.push(
      'No baseline on the target branch yet — this PR establishes the baseline.',
    );
    lines.push('');
  }

  const baseTotals = base.totals ?? emptyCounts();
  const curTotals = current.totals ?? emptyCounts();
  const baseTotal = sumCounts(baseTotals);
  const curTotal = sumCounts(curTotals);

  lines.push('| Severity | base | this PR | Δ |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const sev of SEVERITIES) {
    const b = baseTotals[sev];
    const c = curTotals[sev];
    lines.push(`| ${sev} | ${b} | ${c} | ${formatDelta(c - b)} |`);
  }
  lines.push(
    `| **total** | **${baseTotal}** | **${curTotal}** | **${formatDelta(curTotal - baseTotal)}** |`,
  );
  lines.push('');

  const baseRules = new Map((base.ruleTotals ?? []).map((r) => [r.id, r]));
  const curRules = new Map((current.ruleTotals ?? []).map((r) => [r.id, r]));

  const newRules: RuleSummary[] = [];
  const resolvedRules: RuleSummary[] = [];
  const changedRules: Array<{
    id: string;
    impact: Severity;
    base: number;
    current: number;
  }> = [];

  for (const [id, rule] of curRules) {
    const prev = baseRules.get(id);
    if (!prev) {
      newRules.push(rule);
    } else if (prev.occurrences !== rule.occurrences) {
      changedRules.push({
        id,
        impact: rule.impact,
        base: prev.occurrences,
        current: rule.occurrences,
      });
    }
  }
  for (const [id, rule] of baseRules) {
    if (!curRules.has(id)) {
      resolvedRules.push(rule);
    }
  }

  if (newRules.length > 0) {
    lines.push('### New rules');
    for (const r of sortByImpact(newRules)) {
      lines.push(
        `- \`${r.id}\` (${r.impact}, WCAG ${r.wcagCriteria.join(', ') || '—'}) — ${r.occurrences} node${r.occurrences === 1 ? '' : 's'} on ${r.routes} route${r.routes === 1 ? '' : 's'}`,
      );
    }
    lines.push('');
  }

  if (resolvedRules.length > 0) {
    lines.push('### Resolved rules');
    for (const r of sortByImpact(resolvedRules)) {
      lines.push(
        `- \`${r.id}\` (was ${r.impact}, ${r.occurrences} node${r.occurrences === 1 ? '' : 's'})`,
      );
    }
    lines.push('');
  }

  if (changedRules.length > 0) {
    lines.push('### Changed rules');
    for (const r of changedRules.sort(
      (a, b) =>
        severityRank(b.impact) - severityRank(a.impact) ||
        Math.abs(b.current - b.base) - Math.abs(a.current - a.base),
    )) {
      lines.push(
        `- \`${r.id}\` (${r.impact}): ${r.base} → ${r.current} ${formatDelta(r.current - r.base)}`,
      );
    }
    lines.push('');
  }

  if (
    newRules.length === 0 &&
    resolvedRules.length === 0 &&
    changedRules.length === 0 &&
    baseScanned
  ) {
    lines.push('No rule-level changes vs base.');
    lines.push('');
  }

  const baseRoutes = new Map((base.routes ?? []).map((r) => [r.url, r]));
  const changedRoutes: Array<{
    url: string;
    label: string;
    status: 'ok' | 'error';
    base: number;
    current: number;
  }> = [];
  for (const route of current.routes ?? []) {
    const prev = baseRoutes.get(route.url);
    const baseRouteTotal = prev ? sumCounts(prev.counts) : 0;
    const curRouteTotal = sumCounts(route.counts);
    if (
      baseRouteTotal !== curRouteTotal ||
      (prev && prev.status !== route.status)
    ) {
      changedRoutes.push({
        url: route.url,
        label: route.label,
        status: route.status,
        base: baseRouteTotal,
        current: curRouteTotal,
      });
    }
  }

  if (changedRoutes.length > 0) {
    lines.push('### Changed routes');
    lines.push('');
    lines.push('| Route | Status | base | this PR | Δ |');
    lines.push('| --- | --- | ---: | ---: | ---: |');
    for (const r of changedRoutes) {
      lines.push(
        `| \`${r.url}\` (${r.label}) | ${r.status} | ${r.base} | ${r.current} | ${formatDelta(r.current - r.base)} |`,
      );
    }
    lines.push('');
  }

  if (current.screenshotsAttempted !== undefined) {
    const captured = current.screenshotsCaptured ?? 0;
    const attempted = current.screenshotsAttempted;
    lines.push(`Screenshots: ${captured}/${attempted} captured.`);
    lines.push('');
  }

  if (artifactUrl) {
    lines.push(`[Full report (artifact)](${artifactUrl})`);
  } else {
    lines.push(
      'Full report (`report.md`, `report.csv`, `screenshots/`) attached as the `a11y-baseline-report` workflow artifact.',
    );
  }
  lines.push('');

  return lines.join('\n');
}

function sortByImpact(rules: RuleSummary[]): RuleSummary[] {
  return rules
    .slice()
    .sort(
      (a, b) =>
        severityRank(b.impact) - severityRank(a.impact) ||
        b.occurrences - a.occurrences,
    );
}

function severityRank(s: Severity): number {
  return SEVERITIES.length - SEVERITIES.indexOf(s);
}

function emptyCounts(): Record<Severity, number> {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

function sumCounts(c: Record<Severity, number>): number {
  return SEVERITIES.reduce((n, s) => n + c[s], 0);
}

function formatDelta(d: number): string {
  if (d === 0) {
    return '0';
  }
  if (d > 0) {
    return `+${d} ⚠️`;
  }
  return `${d} ✅`;
}
