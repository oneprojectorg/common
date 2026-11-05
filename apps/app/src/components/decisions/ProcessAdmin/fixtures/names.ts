export const PROCESS_ADMIN_FIXTURE_NAMES = ['draft', 'live'] as const;

export type ProcessAdminFixtureName =
  (typeof PROCESS_ADMIN_FIXTURE_NAMES)[number];
