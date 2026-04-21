import { getOrganizationUsers } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.uuid(),
});

const organizationUserEncoder = z.object({
  id: z.string(),
  authUserId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  about: z.string().nullable(),
  organizationId: z.string(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
  profile: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      slug: z.string(),
      bio: z.string().nullable(),
      email: z.string().nullable(),
      type: z.string(),
      avatarImage: z
        .object({
          id: z.string(),
          name: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
});

export const listUsersRouter = router({
  listUsers: commonAuthedProcedure()
    .input(inputSchema)
    .output(z.array(organizationUserEncoder))
    .query(async ({ ctx, input }) => {
      const { profileId } = input;
      const { user } = ctx;

      const users = await getOrganizationUsers({
        profileId,
        user,
      });

      return users.map((user) => organizationUserEncoder.parse(user));
    }),
});
