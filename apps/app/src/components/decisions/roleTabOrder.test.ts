import type { Role } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { getRolesInTabOrder } from './roleTabOrder';

const role = ({ name, admin }: { name: string; admin: boolean }): Role => ({
  id: `${name}-id`,
  name,
  description: null,
  permissions: {
    admin,
    create: admin,
    read: true,
    update: admin,
    delete: admin,
  },
});

const roleWithoutPermissions = (name: string): Role => ({
  id: `${name}-id`,
  name,
  description: null,
});

const namesOf = (roles: Array<Role>) => roles.map((entry) => entry.name);

describe('getRolesInTabOrder', () => {
  it('moves the admin role behind the participant role', () => {
    const ordered = getRolesInTabOrder([
      role({ name: 'Admin', admin: true }),
      role({ name: 'Participant', admin: false }),
    ]);

    expect(namesOf(ordered)).toEqual(['Participant', 'Admin']);
  });

  it('puts every admin role last, not just the first one', () => {
    const ordered = getRolesInTabOrder([
      role({ name: 'Admin', admin: true }),
      role({ name: 'Facilitator', admin: true }),
      role({ name: 'Participant', admin: false }),
      role({ name: 'Reviewer', admin: false }),
    ]);

    expect(namesOf(ordered)).toEqual([
      'Participant',
      'Reviewer',
      'Admin',
      'Facilitator',
    ]);
  });

  it('keeps the incoming order within each group', () => {
    const ordered = getRolesInTabOrder([
      role({ name: 'Alternate', admin: false }),
      role({ name: 'Admin', admin: true }),
      role({ name: 'Board', admin: true }),
      role({ name: 'Contributor', admin: false }),
    ]);

    expect(namesOf(ordered)).toEqual([
      'Alternate',
      'Contributor',
      'Admin',
      'Board',
    ]);
  });

  it('treats a role the decisions zone grants nothing on as non-admin', () => {
    const ordered = getRolesInTabOrder([
      role({ name: 'Admin', admin: true }),
      roleWithoutPermissions('Observer'),
    ]);

    expect(namesOf(ordered)).toEqual(['Observer', 'Admin']);
  });

  it('returns roles unchanged when none of them grant admin', () => {
    const ordered = getRolesInTabOrder([
      role({ name: 'Participant', admin: false }),
      role({ name: 'Reviewer', admin: false }),
    ]);

    expect(namesOf(ordered)).toEqual(['Participant', 'Reviewer']);
  });

  it('returns roles unchanged when all of them grant admin', () => {
    const ordered = getRolesInTabOrder([
      role({ name: 'Admin', admin: true }),
      role({ name: 'Owner', admin: true }),
    ]);

    expect(namesOf(ordered)).toEqual(['Admin', 'Owner']);
  });
});
