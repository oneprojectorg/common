/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A signed-in user for the prototype shell to render against, so the real
 * header and its Create menu (both of which require a session) can be used
 * as-is instead of rebuilt. Nothing authenticates against this; it never leaves
 * the browser.
 */
/**
 * The shape the real `CommonUser` had, declared locally: the prototype build
 * depends on the design system and nothing else, and importing the API's types
 * would pull the server world back in for one interface.
 */
export interface PrototypeUser {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  lastOrgId: string | null;
  profileId: string;
  currentProfileId: string;
  tos: boolean;
  privacy: boolean;
  createdAt: string;
  isAnonymous: boolean;
  isNetworkMember: boolean;
}

export const PROTOTYPE_USER: PrototypeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  authUserId: '00000000-0000-4000-8000-000000000002',
  name: 'Lorena Reyes',
  email: 'lorena@example.org',
  lastOrgId: null,
  profileId: '00000000-0000-4000-8000-000000000003',
  currentProfileId: '00000000-0000-4000-8000-000000000003',
  tos: true,
  privacy: true,
  createdAt: '2026-01-05T09:00:00.000Z',
  isAnonymous: false,
  isNetworkMember: true,
};

/**
 * Who this admin could steward a process as. Nearly everyone has both a personal
 * account and at least one organisation, and which one fronts a process is a
 * real decision — an organisation lends it institutional weight, a person makes
 * it plainly theirs.
 */
export interface PrototypeSteward {
  id: string;
  name: string;
  kind: 'organization' | 'person';
}

export const PROTOTYPE_STEWARDS: PrototypeSteward[] = [
  {
    id: 'org-east-side',
    name: 'East Side Collective',
    kind: 'organization',
  },
  {
    id: 'person-you',
    name: PROTOTYPE_USER.name,
    kind: 'person',
  },
];
