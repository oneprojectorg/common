# @op/realtime

Real-time messaging service built on Supabase Realtime for bidirectional client-server communication.

## Overview

Provides channel-based pub/sub architecture using Supabase Realtime Broadcast:

- **Server-side**: Publishes messages via the Supabase Broadcast REST API
- **Client-side**: Subscribes to channels via Supabase Realtime WebSocket

## Channel Strategy

- `global` - For data visible to all users (explore page, global feed)
- `org:${orgId}` - For organization-scoped data (org feeds, org updates)
- `user:${userId}` - For user-specific data (notifications, personal updates)

## Usage

### Server-side Publishing

```typescript
import { Channels, realtime } from '@op/realtime/server';

// Publish to a single channel
await realtime.publish(Channels.user(userId), {
  mutationId: 'mutation-id',
});

// Or fan out to many channels at once. Channels are deduped and published
// concurrently, one request each, and settled independently so one failing
// channel doesn't discard the rest.
await realtime.publishMany(
  [Channels.user(userId), Channels.org(orgId)],
  { mutationId: 'mutation-id' },
);
```

Publishing is **best-effort**: each request has a 3-second per-attempt timeout
and is retried once on a transient failure (5xx, network error, timeout).
Failures are swallowed rather than thrown — by the time we publish, the
mutation has already committed, and clients recover on their next full fetch.
Failed channels are logged and counted on the `realtime.publish.failures`
OpenTelemetry counter, so a silent invalidation outage is still visible.

`429` is deliberately not retried: the backoff lands inside the same rate-limit
window, so retrying only adds load to a backend that just asked us to slow
down.

### Client-side Subscription

```typescript
import { RealtimeManager } from '@op/realtime/client';

// Initialize the manager with Supabase config (do this once at app startup)
RealtimeManager.initialize({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});

// Subscribe to channels
const manager = RealtimeManager.getInstance();

const unsubscribe = manager.subscribe('user:123', (message) => {
  console.log('Received:', message);
});

// Later, when you want to clean up the subscription:
unsubscribe();
```

## Environment Variables

**Server:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE` - Service role key for server-side publishing

**Client:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key for client subscriptions
