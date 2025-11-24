# Real-time Invalidation and Subscription Strategy

This document outlines a strategy for implementing real-time data synchronization in the application. It proposes a hybrid architecture that uses a dedicated real-time server to manage persistent connections, while integrating seamlessly with the existing tRPC and React Query stack.

## Core Principles

- **Hybrid Architecture**: Keep the stateless application backend on Vercel and delegate stateful, persistent connection management to a dedicated real-time server (e.g., Centrifugo).
- **Server-Authoritative Invalidation**: The backend is the single source of truth for what data is stale. Clients are simply notified to refetch data, not how to update it.
- **Leverage Existing Stack**: Utilize the power of tRPC for type-safety and React Query for robust client-side caching, refetching, and state management.

## Architecture Overview

The proposed data flow for a server-initiated invalidation is as follows:

1.  **Mutation**: A client executes a tRPC mutation.
2.  **Backend Logic**: The Next.js backend processes the mutation and updates the Supabase database.
3.  **Invalidation Service**: After a successful DB write, the backend calls a dedicated `invalidation-service`.
4.  **Publish Event**: The `invalidation-service` determines which data queries are affected and publishes a type-safe invalidation event to the appropriate channel(s) via the real-time server's API.
5.  **Client Notification**: The real-time server pushes the event to all clients subscribed to those channels.
6.  **Query Invalidation**: A custom tRPC link on the client receives the event and uses the payload to invalidate the specific React Query cache entry (e.g., `queryClient.invalidateQueries(event.queryKey)`).
7.  **Data Refetch**: React Query automatically and transparently refetches the latest data via its standard tRPC query link.

## Connection Management

**Strategy: One Connection Per Client**

Each client (i.e., browser tab) will establish a single, persistent WebSocket connection with the real-time server.

-   **Efficiency**: A single connection is multiplexed to handle all real-time subscriptions for that client, minimizing resource usage.
-   **Scalability**: This pattern is standard for large-scale applications and is what modern real-time servers are optimized for.
-   **Simplicity**: Simplifies client-side connection management logic.

## Channel & Invalidation Strategy

### Channel Design

We will use a hierarchical, topic-based channel naming convention. Clients subscribe to channels relevant to the data they are currently viewing.

-   `user:{userId}`: For user-specific data (e.g., notifications). Every authenticated user subscribes to their own channel.
-   `org:{orgId}`: For events related to a specific organization (e.g., new posts, proposal status changes).
-   `entity:{entityName}:{entityId}`: For granular updates on a specific record (e.g., live comments on `post:123`).
-   `global`: For application-wide announcements.

### Invalidation Flow Example (Post Upvote)

1.  A user upvotes `post:123` (belonging to `org:456`) via a tRPC mutation.
2.  The backend updates the vote count in the database.
3.  The backend publishes two distinct invalidation events:
    -   To channel `org:456` with payload `{ event: "invalidate", queryKey: ["posts", "list", { orgId: "456" }] }`
    -   To channel `entity:post:123` with payload `{ event: "invalidate", queryKey: ["posts", "get", { postId: "123" }] }`
4.  Clients viewing the post list for that org or that specific post will have their React Query caches invalidated and will automatically refetch the new data.

## Handling Complex Queries & Joins

To ensure that changes to data are reflected in all dependent queries (including complex joins), we will introduce a centralized invalidation service.

-   **Centralized Logic**: Create a new package, `packages/invalidation`, responsible for mapping database mutations to a comprehensive list of `queryKey`s that need to be invalidated.
-   **Decoupling**: This decouples the mutation logic from the invalidation logic. A tRPC mutation's only responsibility is to call the invalidation service with the changed entity; the service handles the rest.

**Example (User Role Change):**

1.  **Mutation**: `trpc.orgs.members.updateRole({ userId, orgId, newRole })` is called.
2.  **Invalidation Service**: The mutation calls `invalidationService.onUserRoleChange({ userId, orgId })`.
3.  **Mapping**: The service contains the business logic to know that a role change affects the user's session, the org's member list, and potentially other permissions-based queries.
4.  **Publishing**: The service compiles a list of invalidation events and publishes them via the real-time server to the `user:{userId}` and `org:{orgId}` channels.

## High-Level Implementation Plan

1.  **Phase 1: Infrastructure & Setup**
    -   Provision a self-hosted, open-source real-time server (e.g., Centrifugo) on a platform that supports persistent connections (e.g., Railway, DigitalOcean).
    -   Configure the server to use the same JWT secret as Supabase for authenticating WebSocket connections.

2.  **Phase 2: Backend Integration**
    -   Create a new package `packages/realtime` to house a lightweight API client for the real-time server.
    -   Create the `packages/invalidation` service to centralize invalidation logic.
    -   Modify existing tRPC mutations to call the invalidation service after successful database writes.

3.  **Phase 3: Client Integration**
    -   Implement a custom tRPC WebSocket link in `services/api/src/links.ts` that manages the connection to the real-time server.
    -   This link will listen for `invalidate` events and call `queryClient.invalidateQueries`.
    -   Update React hooks and components to subscribe/unsubscribe from channels (e.g., `useOrg(orgId)` subscribes to `org:{orgId}`).
