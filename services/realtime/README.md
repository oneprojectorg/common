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

// Publish to user channel
await realtime.publish(Channels.user(userId), {
  mutationId: 'mutation-id',
});
```

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
