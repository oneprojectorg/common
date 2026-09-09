import { permission } from 'access-zones';
import { describe, expect, it } from 'vitest';

import { decisionPermission } from '../decision/permissions';
import { PUBLIC_ROLE_NAME, rolesIncludePublicGrant } from './publicGrant';

/**
 * `rolesIncludePublicGrant` answers "is this profile open to the public".
 * These pin the property that makes it worth having: the answer comes from the
 * grant's identity, never from a capability bit. A capability answers what the
 * caller may do, and the public grant's bits change.
 */
describe('rolesIncludePublicGrant', () => {
  const role = (name: string, decisions: number) => ({
    id: `role-${name}`,
    name,
    access: { decisions },
  });

  it('finds the public grant among a caller’s roles', () => {
    expect(
      rolesIncludePublicGrant([
        role('Participant', decisionPermission.SUBMIT_PROPOSALS),
        role(PUBLIC_ROLE_NAME, permission.READ | decisionPermission.VOTE),
      ]),
    ).toBe(true);
  });

  it('answers false for a role set that holds no public grant', () => {
    expect(
      rolesIncludePublicGrant([
        role('Participant', decisionPermission.SUBMIT_PROPOSALS),
      ]),
    ).toBe(false);
  });

  it('does not read publicness off a capability bit', () => {
    // The trap this replaces: `submitProposals` was used as a proxy for
    // "public", so a member holding it on a closed process read as public.
    expect(
      rolesIncludePublicGrant([
        role('Admin', decisionPermission.SUBMIT_PROPOSALS | permission.ADMIN),
      ]),
    ).toBe(false);

    // And the converse: the public grant carries no `SUBMIT_PROPOSALS`, so the
    // proxy would now read a public process as closed.
    expect(
      rolesIncludePublicGrant([
        role(PUBLIC_ROLE_NAME, permission.READ | decisionPermission.VOTE),
      ]),
    ).toBe(true);
  });

  it('answers false for a caller holding no roles at all', () => {
    expect(rolesIncludePublicGrant([])).toBe(false);
  });
});
