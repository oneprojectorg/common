/**
 * Access control seed data with predefined IDs
 * These constants are used in both seeding and tests to ensure consistency
 */
import { permission } from 'access-zones';

/**
 * Decision-specific permission bits (bits 5–8), extending the standard ACRUD bits (0–4).
 * Duplicated from @op/common/src/services/decision/permissions.ts to avoid a
 * circular dependency (@op/db cannot depend on @op/common).
 */
const DECISION_BITS = {
  INVITE_MEMBERS: 0b1_00000, // 32
  REVIEW: 0b10_00000, // 64
  SUBMIT_PROPOSALS: 0b100_00000, // 128
  VOTE: 0b1000_00000, // 256
} as const;

// Predefined UUIDs for access zones (v4 format with version=4 and variant=8)
const ACCESS_ZONE_IDS = {
  PROFILE: '00000000-0000-4000-8000-000000000001',
  ADMIN: '00000000-0000-4000-8000-000000000002',
  DECISIONS: '00000000-0000-4000-8000-000000000003',
} as const;

// Predefined UUIDs for access roles (v4 format with version=4 and variant=8)
const ACCESS_ROLE_IDS = {
  ADMIN: '00000000-0000-4000-8000-000000000011',
  MEMBER: '00000000-0000-4000-8000-000000000012',
  PUBLIC_PARTICIPANT: '00000000-0000-4000-8000-000000000013',
} as const;

/**
 * Name of the stable global "Public Participant" role. Runtime code identifies
 * global roles by name (the ids here are for seeds/tests), so this is the
 * canonical identifier the access layer keys the public grant on. Global roles
 * cannot be renamed via the API.
 */
export const PUBLIC_PARTICIPANT_ROLE_NAME = 'Public Participant';

// Access zones data
export const ACCESS_ZONES = [
  {
    id: ACCESS_ZONE_IDS.PROFILE,
    name: 'profile',
    description: null,
  },
  {
    id: ACCESS_ZONE_IDS.ADMIN,
    name: 'admin',
    description: 'Allows admin access to the item',
  },
  {
    id: ACCESS_ZONE_IDS.DECISIONS,
    name: 'decisions',
    description: 'Allows accessing to decision making func',
  },
];

// Access roles data
export const ACCESS_ROLES = [
  {
    id: ACCESS_ROLE_IDS.MEMBER,
    name: 'Member',
    description: null,
  },
  {
    id: ACCESS_ROLE_IDS.ADMIN,
    name: 'Admin',
    description: null,
  },
  {
    id: ACCESS_ROLE_IDS.PUBLIC_PARTICIPANT,
    name: PUBLIC_PARTICIPANT_ROLE_NAME,
    description:
      'Read-only public access to a profile’s decisions/proposals. Never granted by hand — anchored on the GLOBAL_USER_PUBLIC row for the one public process.',
  },
];

// Role name to ID mapping for convenient access (avoids string references)
export const ROLES = {
  ADMIN: {
    id: ACCESS_ROLE_IDS.ADMIN,
    name: 'Admin',
  },
  MEMBER: {
    id: ACCESS_ROLE_IDS.MEMBER,
    name: 'Member',
  },
  PUBLIC_PARTICIPANT: {
    id: ACCESS_ROLE_IDS.PUBLIC_PARTICIPANT,
    name: PUBLIC_PARTICIPANT_ROLE_NAME,
  },
} as const;

// Zone name to ID mapping for convenient access (avoids string references)
export const ZONES = {
  PROFILE: {
    id: ACCESS_ZONE_IDS.PROFILE,
    name: 'profile',
  },
  ADMIN: {
    id: ACCESS_ZONE_IDS.ADMIN,
    name: 'admin',
  },
  DECISIONS: {
    id: ACCESS_ZONE_IDS.DECISIONS,
    name: 'decisions',
  },
} as const;

// Permission flags
export const PERMISSIONS = permission;

// Permissions for the Admin role (ACRUD bits only — admin access is checked
// via the ADMIN bit in OR-patterns, so custom decision bits aren't needed)
const ADMIN_ROLE_PERMISSIONS =
  PERMISSIONS.ADMIN |
  PERMISSIONS.CREATE |
  PERMISSIONS.READ |
  PERMISSIONS.UPDATE |
  PERMISSIONS.DELETE;

// Access role permissions on access zones (based on production patterns)
export const ACCESS_ROLE_PERMISSIONS = [
  // Admin gets full permissions on admin zone
  {
    accessRoleId: ACCESS_ROLE_IDS.ADMIN,
    accessZoneId: ACCESS_ZONE_IDS.ADMIN,
    permission: ADMIN_ROLE_PERMISSIONS,
  },
  // Admin gets full permissions on decisions zone
  {
    accessRoleId: ACCESS_ROLE_IDS.ADMIN,
    accessZoneId: ACCESS_ZONE_IDS.DECISIONS,
    permission: ADMIN_ROLE_PERMISSIONS,
  },
  // Admin gets full permissions on profile zone
  {
    accessRoleId: ACCESS_ROLE_IDS.ADMIN,
    accessZoneId: ACCESS_ZONE_IDS.PROFILE,
    permission: ADMIN_ROLE_PERMISSIONS,
  },
  // Member gets read permissions on profile zone
  {
    accessRoleId: ACCESS_ROLE_IDS.MEMBER,
    accessZoneId: ACCESS_ZONE_IDS.PROFILE,
    permission: PERMISSIONS.READ,
  },
  // Member gets read+update permissions on decisions zone plus submit proposals and vote
  {
    accessRoleId: ACCESS_ROLE_IDS.MEMBER,
    accessZoneId: ACCESS_ZONE_IDS.DECISIONS,
    permission:
      PERMISSIONS.READ |
      PERMISSIONS.UPDATE |
      DECISION_BITS.SUBMIT_PROPOSALS |
      DECISION_BITS.VOTE,
  },
  // Public Participant gets read-only access to the decisions zone (global,
  // profileId IS NULL) — "public = read decisions/proposals" applies uniformly.
  {
    accessRoleId: ACCESS_ROLE_IDS.PUBLIC_PARTICIPANT,
    accessZoneId: ACCESS_ZONE_IDS.DECISIONS,
    permission: PERMISSIONS.READ,
  },
];
