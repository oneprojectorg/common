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

/**
 * Stops reading once the cap is passed, rather than buffering the whole body
 * and measuring after. `Content-Length` cannot be trusted to be there — a
 * chunked request declares none — so the limit has to hold while reading.
 */
const readBoundedBody = async (
  request: NextRequest,
): Promise<{ ok: true; text: string } | { ok: false }> => {
  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, text: '' };
  }

  const chunks: Array<Uint8Array> = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();

      return { ok: false };
    }

    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(body) };
};

export async function POST(request: NextRequest): Promise<Response> {
  const body = await readBoundedBody(request);
  if (!body.ok) {
    return new Response(null, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
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
