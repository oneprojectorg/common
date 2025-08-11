import { db } from '@op/db/client';

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface GetRolesResult {
  roles: Role[];
}

export const getRoles = async (): Promise<GetRolesResult> => {
  const roles = await db.query.accessRoles.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
    })),
  };
};