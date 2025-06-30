export const RELATIONSHIP_OPTIONS = [
  {
    key: 'partnership',
    label: 'Partnership',
    noun: 'Partner',
    description: (orgName: string) =>
      `You’ve partnered with ${orgName} on projects/programs`,
  },
  {
    key: 'funding',
    label: 'Funding',
    noun: 'Funder',
    description: (orgName: string) =>
      `You’ve either received or given funds to ${orgName}`,
  },
  {
    key: 'fundee',
    label: 'Fundee',
    noun: 'Fundee',
    description: (orgName: string) => `You’ve received from ${orgName}`,
  },
  {
    key: 'memberOf',
    label: 'Membership',
    noun: 'Member',
    description: (orgName: string) =>
      `Your organization is a member of ${orgName}'s network`,
  },
  {
    key: 'affiliation',
    label: 'Affiliation',
    noun: 'Affiliate',
    description: (orgName: string) =>
      `Your organization informally supports or collaborates with  ${orgName}`,
  },
];

export const relationshipMap = RELATIONSHIP_OPTIONS.reduce(
  (accum, option) => ({ ...accum, [option.key]: option }),
  {} as Record<RelationshipType, (typeof RELATIONSHIP_OPTIONS)[number]>,
);

export type RelationshipType = (typeof RELATIONSHIP_OPTIONS)[number]['key'];
