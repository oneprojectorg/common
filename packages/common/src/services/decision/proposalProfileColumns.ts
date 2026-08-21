/**
 * Column picks for the `submittedBy`/`profile` relations on list rows. Covers
 * the fields the widest consumer needs — the legacy results encoder
 * (`baseProfileEncoder`, via `getInstanceResults`) requires the full profile
 * shape, while the non-legacy `proposalSchema` encoder narrows further on the
 * wire. Keeps only the generated `search` tsvector and other never-encoded
 * columns out of the lateral joins.
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
