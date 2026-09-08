# @op/logging

OpenTelemetry-based logging utilities for Common.

## Overview

This package provides a simple, service-agnostic logging interface built on OpenTelemetry. The backend (Axiom, Vercel, etc.) is determined by environment configuration and the `@vercel/otel` setup in `instrumentation.ts`.

## Usage

```typescript
import { logger } from '@op/logging';

// Server-side logging
logger.info('User logged in', { userId: '123' });
logger.error('Failed to process request', { error: err.message });
logger.warn('Rate limit approaching', { remaining: 5 });
logger.debug('Processing item', { itemId: 'abc' });
```

## Middleware

```typescript
import { logger, transformMiddlewareRequest } from '@op/logging';

export function middleware(request: NextRequest) {
  logger.info(...transformMiddlewareRequest(request));
  // ...
}
```

## Configuration

Logging backend is configured via `@vercel/otel` in your `instrumentation.ts`. The package automatically uses the OpenTelemetry API which routes to whatever exporter is configured.

See [Vercel OTEL documentation](https://github.com/vercel/otel) for backend configuration options.

## What not to log

Log records ship to PostHog, so treat every attribute as data we are keeping in a third-party product.

- **Never log a raw client IP.** An IP is personal data (GDPR Recital 30) and a per-request log line is not a proportionate place to retain it (Art. 5(1)(c)). `transformMiddlewareRequest` deliberately omits it; the tRPC logger (`services/api/src/middlewares/withLogger.ts`) attaches it only to authorization and rate-limit failures, and only as an anonymized network prefix (`anonymizeIp`).
- The same goes for anything else that identifies a person directly — email addresses, tokens, request bodies. Log the id we already store (`posthogDistinctId`, `requestId`) instead.

**Retention is not set from this repo.** The log stream's retention window lives in the PostHog project settings (Settings → Environment → Logs); the code here cannot bound how long a record survives. Anything logged is kept for whatever window that setting specifies.
