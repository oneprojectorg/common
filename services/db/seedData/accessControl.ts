/**
 * Access control seed data with predefined IDs
 * These constants are used in both seeding and tests to ensure consistency
 */
import { permission } from 'access-zones';

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
} as const;

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

// Permissions for the Admin role (all bits set)
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
  // Member gets read+update permissions on decisions zone (to view and submit proposals)
  {
    accessRoleId: ACCESS_ROLE_IDS.MEMBER,
    accessZoneId: ACCESS_ZONE_IDS.DECISIONS,
    permission: PERMISSIONS.READ | PERMISSIONS.UPDATE,
  },
];
