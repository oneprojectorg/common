export const ACCESS_ZONES = ['organization', 'projects', 'posts'] as const;
export type AccessZone = (typeof ACCESS_ZONES)[number];

export type AccessZonePermission = Partial<
  Record<(typeof ACCESS_ZONES)[number], number>
>;
