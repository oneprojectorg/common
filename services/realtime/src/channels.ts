/**
 * Channel name builders for realtime service.
 *
 * Channel strategy:
 * - `global`: For truly global data (explore page, global feed)
 * - `org:${orgId}`: For organization-scoped data (org feeds, org-specific updates)
 * - `user:${userId}`: For user-specific data (notifications, personal updates)
 *
 * Convention: scope[:id]
 */
export const Channels = {
  /** Global channel - for data visible to all users (explore page, global feed) */
  global: () => 'global' as const,

  /** Organization-scoped channel - for org-specific data (org feeds, org updates) */
  org: (orgId: string) => `org:${orgId}` as const,

  /** User-scoped channel - for personal notifications and user-specific updates */
  user: (userId: string) => `user:${userId}` as const,
} as const;

/** Extract channel types for TypeScript */
export type GlobalChannel = ReturnType<typeof Channels.global>;
export type OrgChannel = ReturnType<typeof Channels.org>;
export type UserChannel = ReturnType<typeof Channels.user>;
