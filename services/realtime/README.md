# @op/realtime

Real-time messaging service built on Centrifugo for bidirectional client-server communication.

## Overview

Provides WebSocket-based real-time messaging with channel-based pub/sub architecture:

- **Server-side**: HTTP API for publishing messages to channels
- **Client-side**: WebSocket manager for subscribing to channels and receiving messages

## Channel Strategy

All channels are prefixed with `trpc:` to indicate they're for tRPC invalidations:

- `trpc:global` - For data visible to all users (explore page, global feed)
- `trpc:org:${orgId}` - For organization-scoped data (org feeds, org updates)
- `trpc:user:${userId}` - For user-specific data (notifications, personal updates)

## Usage

### Server-side Publishing

```typescript
import { Channels, realtime } from '@op/realtime/server';

// Publish to user channel
await realtime.publish(Channels.user(userId), {
  type: 'query-invalidation',
  queryKey: ['user', 'notifications'],
});
```

### Client-side Subscription

```typescript
import { RealtimeManager } from '@op/realtime/client';

import { trpc } from './trpc';

// Your tRPC client

// Initialize the manager with configuration (do this once at app startup)
RealtimeManager.initialize({
  wsUrl: process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL!,
  getToken: async () => {
    const result = await trpc.realtime.getToken.query();
    return result.token;
  },
});

// Subscribe to channels
const manager = RealtimeManager.getInstance();

const unsubscribe = manager.subscribe('trpc:user:123', (message) => {
  console.log('Received:', message);
});

// Later, when you want to clean up the subscription:
unsubscribe();
```

**Note:** The `getToken` function is called automatically by Centrifuge when:

- Initially connecting to the WebSocket server
- The token is about to expire (tokens are valid for 24 hours)

## Development

### Running Centrifugo Locally

Centrifugo runs as a Docker container for local development and testing. The configuration is managed entirely through environment variables in `.env.test`.

**Start Centrifugo:**

```bash
pnpm w:realtime dev
```

This runs Centrifugo on `http://localhost:8000`.

**Stop Centrifugo:**

```bash
pnpm w:realtime down
```

## Environment Variables

**Server:**

- `CENTRIFUGO_API_URL` - Centrifugo HTTP API endpoint
- `CENTRIFUGO_API_KEY` - API key for server publishing
- `CENTRIFUGO_TOKEN_SECRET` - Secret key for signing JWT tokens

**Client:**

- `NEXT_PUBLIC_CENTRIFUGO_WS_URL` - WebSocket endpoint

The `.env.test` file contains local configuration for Centrifugo (used for both development and testing).
