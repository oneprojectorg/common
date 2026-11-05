import {
  PROCESS_ADMIN_FIXTURE_NAMES,
  type ProcessAdminFixtureName,
} from './names';

/**
 * The fixture a `?fixture=` query names, or null. Production builds never
 * resolve one, so the switch cannot reach a real admin.
 */
export function readFixtureName(
  value: string | string[] | undefined,
): ProcessAdminFixtureName | null {
  if (process.env.NODE_ENV === 'production' || typeof value !== 'string') {
    return null;
  }

  return PROCESS_ADMIN_FIXTURE_NAMES.find((name) => name === value) ?? null;
}
