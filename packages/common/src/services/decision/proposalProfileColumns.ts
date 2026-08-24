/**
 * Column picks for the `submittedBy`/`profile` relations on list rows. Wide
 * because the legacy results encoder (`baseProfileEncoder`) needs the whole
 * profile; keeps the generated `search` tsvector out of the lateral joins.
 */
export const proposalProfileColumns = {
  id: true,
  type: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  bio: true,
  mission: true,
  email: true,
  website: true,
} satisfies Record<string, true>;
