import {
  links,
  Organization,
  organizations,
  organizationUsers,
} from '@op/db/schema';
import { z } from 'zod';
import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

export const getOrganization = async ({
  slug,
  id,
  user,
}: { user: User } & (
  | { id: string; slug?: undefined }
  | { id?: undefined; slug: string }
)) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  if (!slug && !id) {
    return;
  }

  // assertAccess({ organization, permission: 'read' }, user.roles);

  const result = await db.query.organizations.findFirst({
    where: slug
      ? (table, { eq }) => eq(table.slug, slug)
      : (table, { eq }) => eq(table.id, id!),
    with: {
      projects: true,
      links: true,
      headerImage: true,
      avatarImage: true,
    },
  });

  return result;
};

export const organizationInputSchema = z
  .object({
    slug: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    isOfferingFunds: z.boolean().optional(),
    isReceivingFunds: z.boolean().optional(),
    website: z.string().url().optional(),
    mission: z.string().optional(),
    whereWeWork: z.any().optional(),
  })
  .strip()
  .partial();

type OrganizationInput = z.infer<typeof organizationInputSchema>;

const OrganizationInputParser = organizationInputSchema.transform(
  (data: OrganizationInput) => {
    // Remove keys with undefined values
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    ) as OrganizationInput;
  },
);

export const fundingLinksnputSchema = z
  .object({
    receivingFundsLink: z
      .string()
      .url({ message: 'Enter a valid website address' })
      .optional(),
    offeringFundsDescription: z.string().optional(),
    offeringFundsLink: z
      .string()
      .url({ message: 'Enter a valid website address' })
      .optional(),
  })
  .strip()
  .partial();
type FundingLinksInput = z.infer<typeof fundingLinksnputSchema>;

export const createOrganization = async ({
  data,
  user,
}: {
  data: OrganizationInput & FundingLinksInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  const orgInputs = OrganizationInputParser.parse({
    slug: randomUUID(),
    email: user.email,
    ...data,
  });

  // Create organization and link user
  const result = await db.transaction(async (tx) => {
    const [newOrg] = await tx
      .insert(organizations)
      // @ts-expect-error - TODO: this is well defined with zod
      .values(orgInputs)
      .returning();

    if (!newOrg) {
      throw new NotFoundError('Failed to create organization');
    }

    // Insert organizationUser linking the user to organization, with a default role of owner
    const [newOrgUser] = await tx
      .insert(organizationUsers)
      .values({
        organizationId: newOrg.id,
        authUserId: user.id,
        email: user.email!,
      })
      .returning();

    // Add funding links
    await Promise.all([
      ...(data.receivingFundsLink
        ? [
            tx.insert(links).values({
              organizationId: newOrg.id,
              href: data.receivingFundsLink,
              type: 'receiving',
            }),
          ]
        : []),
      ...(data.offeringFundsLink
        ? [
            tx.insert(links).values({
              organizationId: newOrg.id,
              href: data.offeringFundsLink,
              type: 'offering',
            }),
          ]
        : []),
    ]);

    if (!newOrgUser) {
      throw new CommonError('Failed to associate organization with user');
    }

    return newOrg;
  });

  return result;
};
