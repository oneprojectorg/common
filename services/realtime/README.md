# @op/realtime

Real-time messaging service built on Supabase Realtime Broadcast for bidirectional client-server communication.

## Overview

Provides WebSocket-based real-time messaging with channel-based pub/sub architecture:

- **Server-side**: Supabase service client for publishing messages to channels
- **Client-side**: Supabase realtime client for subscribing to channels and receiving messages

## Channel Strategy

- `global` - For data visible to all users (explore page, global feed)
- `org:${orgId}` - For organization-scoped data (org feeds, org updates)
- `user:${userId}` - For user-specific data (notifications, personal updates)
- `profileJoinRequest:${type}:${profileId}` - For profile join request updates

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
import { createSBBrowserClient } from '@op/supabase/client';

// Initialize the manager with Supabase client (do this once at app startup)
const supabase = createSBBrowserClient();
RealtimeManager.initialize({ supabase });

// Subscribe to channels
const manager = RealtimeManager.getInstance();

const unsubscribe = manager.subscribe('user:123', (message) => {
  console.log('Received:', message);
});

// Later, when you want to clean up the subscription:
unsubscribe();
```

## Environment Variables

The realtime service uses your existing Supabase configuration:

**Server:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE` - Service role key for server-side publishing

**Client:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key for client-side subscriptions
