import { trackEvent } from '@op/analytics';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// CSP violation reports arrive in two shapes: the legacy `report-uri` channel
// (Firefox + older Chromium) POSTs `{ "csp-report": {...} }` with hyphenated
// keys, while the modern `report-to` Reporting API (Chromium) POSTs an array of
// `{ type, body }` entries with camelCase keys. Normalize both to one snake_case
// bag so PostHog gets consistent properties regardless of browser.

const cspReportSchema = z
  .object({
    'document-uri': z.string().optional(),
    documentURL: z.string().optional(),
    'violated-directive': z.string().optional(),
    'effective-directive': z.string().optional(),
    effectiveDirective: z.string().optional(),
    'blocked-uri': z.string().optional(),
    blockedURL: z.string().optional(),
    disposition: z.string().optional(),
    'source-file': z.string().optional(),
    sourceFile: z.string().optional(),
    'line-number': z.number().optional(),
    lineNumber: z.number().optional(),
    'column-number': z.number().optional(),
    columnNumber: z.number().optional(),
  })
  .passthrough();

type CspReport = z.infer<typeof cspReportSchema>;

const payloadSchema = z.union([
  z.array(
    z.object({
      type: z.string().optional(),
      body: cspReportSchema.optional(),
    }),
  ),
  z.object({ 'csp-report': cspReportSchema }),
]);

// The `report-to` batch is an attacker-suppliable array and this endpoint is
// unauthenticated by necessity, so cap the fan-out into PostHog.
const MAX_REPORTS_PER_REQUEST = 10;

const normalize = (report: CspReport) => ({
  document_uri: report['document-uri'] ?? report.documentURL,
  effective_directive:
    report['effective-directive'] ??
    report.effectiveDirective ??
    report['violated-directive'],
  blocked_uri: report['blocked-uri'] ?? report.blockedURL,
  disposition: report.disposition,
  source_file: report['source-file'] ?? report.sourceFile,
  line_number: report['line-number'] ?? report.lineNumber,
  column_number: report['column-number'] ?? report.columnNumber,
});

/** A real report is well under a kilobyte. */
const MAX_BODY_BYTES = 64_000;

export async function POST(request: NextRequest): Promise<Response> {
  // A declared oversize is refused before buffering; a chunked or header-less
  // body is measured after the read. Rejecting a missing content-length
  // outright would silently drop reports from any client that omits it.
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 204 });
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(null, { status: 204 });
  }

  const reports = (
    Array.isArray(parsed.data)
      ? parsed.data.flatMap((entry) =>
          entry.type === 'csp-violation' && entry.body ? [entry.body] : [],
        )
      : [parsed.data['csp-report']]
  ).slice(0, MAX_REPORTS_PER_REQUEST);

  const userAgent = request.headers.get('user-agent') ?? undefined;

  try {
    await Promise.all(
      reports.map((report) =>
        trackEvent({
          distinctId: 'csp-report',
          event: 'csp_violation',
          properties: { ...normalize(report), user_agent: userAgent },
        }),
      ),
    );
  } catch {
    // Reporting is best-effort; a PostHog hiccup must never surface to the
    // browser (and would just be retried on the next violation anyway).
  }

  return new Response(null, { status: 204 });
}
