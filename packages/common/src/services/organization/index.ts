import { db } from '@op/db/client';

export const getOrganization = async ({
  slug,
  id,
}:
  | ({ user: any } & { id: string; slug?: undefined })
  | { id?: undefined; slug: string }) => {
  const result = await db.query.organizations.findFirst({
    where: (table, { eq }) => (slug ? eq(table.slug, slug) : eq(table.id, id)),
    with: {
      projects: true,
      links: true,
      headerImage: true,
      avatarImage: true,
    },
  });

  return result;
};
