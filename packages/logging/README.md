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

## Client-side

```typescript
import { useLogger, WebVitals } from '@op/logging';

// In a component
const logger = useLogger();
logger.info('Button clicked', { buttonId: 'submit' });
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
