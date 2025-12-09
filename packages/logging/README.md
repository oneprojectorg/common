# @op/logging

OpenTelemetry-based logging utilities for Common.

## Overview

This package provides a simple, service-agnostic logging interface built on OpenTelemetry. The backend (Axiom, Vercel, etc.) is determined by environment configuration and the `@vercel/otel` setup in `instrumentation.ts`.

## Usage

```typescript
import { log } from '@op/logging';

// Server-side logging
log.info('User logged in', { userId: '123' });
log.error('Failed to process request', { error: err.message });
log.warn('Rate limit approaching', { remaining: 5 });
log.debug('Processing item', { itemId: 'abc' });
```

## Middleware

```typescript
import { log, transformMiddlewareRequest } from '@op/logging';

export function middleware(request: NextRequest) {
  log.info(...transformMiddlewareRequest(request));
  // ...
}
```

## Configuration

Logging backend is configured via `@vercel/otel` in your `instrumentation.ts`. The package automatically uses the OpenTelemetry API which routes to whatever exporter is configured.

See [Vercel OTEL documentation](https://github.com/vercel/otel) for backend configuration options.
