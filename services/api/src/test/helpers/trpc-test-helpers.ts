import type { User } from '@op/supabase/lib';

/**
 * Create a test context for tRPC procedures
 */
export async function createTestContext(user: User) {
  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}

/**
 * Mock context for unauthenticated requests
 */
export function createUnauthenticatedContext() {
  return {
    user: null,
    req: {} as any,
    res: {} as any,
  };
}