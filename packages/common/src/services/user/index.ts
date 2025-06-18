import { db, eq } from '@op/db/client';
import { allowList, users } from '@op/db/schema';

export interface User {
  id: number;
  email: string;
}

export const createUserByEmail = async ({
  email,
  authUserId,
}: {
  authUserId: string;
  email: string;
}): Promise<void> => {
  try {
    // Attempt to insert a new user; on conflict (duplicate email) do nothing
    const newUser = await db
      .insert(users)
      .values({ authUserId, email })
      .onConflictDoNothing()
      .returning();

    // If insertion was successful, return the new user
    if (newUser.length > 0) {
      // return newUser;
      return;
    }

    // Otherwise, fetch the existing user by email
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      // return existingUser[0];
      return;
    }
  } catch (e) {
    return;
    // If no user is found, throw an error
    // throw new Error('User upsert failed: no user found.');
  }
};

export const getAllowListUser = async ({ email }: { email?: string }) => {
  if (!email) {
    return;
  }

  const [allowedEmail] = await db
    .select({
      email: allowList.email,
      organizationId: allowList.organizationId,
    })
    .from(allowList)
    .where(eq(allowList.email, email))
    .limit(1);

  return allowedEmail;
};
