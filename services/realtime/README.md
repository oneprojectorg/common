# @op/realtime

Real-time messaging service built on Centrifugo for bidirectional client-server communication.

## Overview

Provides WebSocket-based real-time messaging with channel-based pub/sub architecture:

- **Server-side**: HTTP API for publishing messages to channels
- **Client-side**: WebSocket manager for subscribing to channels and receiving messages

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
  type: 'cache-invalidation',
  queryKey: ['user', 'notifications'],
});
```

### Client-side Subscription

```typescript
import { RealtimeManager } from '@op/realtime/client';

const manager = RealtimeManager.getInstance();

manager.subscribe('user:123', (message) => {
  console.log('Received:', message);
});
```

## Environment Variables

**Server:**

- `CENTRIFUGO_API_URL` - Centrifugo HTTP API endpoint
- `CENTRIFUGO_API_KEY` - API key for server publishing

**Client:**

- `NEXT_PUBLIC_CENTRIFUGO_WS_URL` - WebSocket endpoint
- `NEXT_PUBLIC_CENTRIFUGO_TOKEN` - Connection token
