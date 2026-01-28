import { NextResponse } from 'next/server';

/**
 * Proxy browser OTLP traces to SigNoz.
 * This avoids CORS issues and keeps API keys server-side.
 */
export async function POST(request: Request) {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!otelEndpoint) {
    return NextResponse.json(
      { error: 'OTEL endpoint not configured' },
      { status: 503 },
    );
  }

  try {
    const body = await request.arrayBuffer();
    const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

    const response = await fetch(`${otelEndpoint}/v1/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
    });

    if (!response.ok) {
      // Log error but don't expose details to client
      console.error(
        '[OTel Proxy] Failed to forward traces:',
        response.status,
        await response.text(),
      );
      return new NextResponse(null, { status: 502 });
    }

    return new NextResponse(null, { status: response.status });
  } catch (error) {
    console.error('[OTel Proxy] Error forwarding traces:', error);
    return new NextResponse(null, { status: 502 });
  }
}

function parseHeaders(headersStr: string | undefined): Record<string, string> {
  if (!headersStr) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const pair of headersStr.split(',')) {
    const [key, value] = pair.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  }
  return headers;
}
