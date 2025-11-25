/**
 * Helper utilities for generating tRPC query keys in the new TanStack integration
 *
 * In the new TanStack React Query integration, we use native hooks and need to
 * manually manage query keys. These helpers ensure consistent key generation.
 */

/**
 * Creates a query key for a tRPC procedure
 * @param path - The procedure path as an array (e.g., ['content', 'linkPreview'])
 * @param input - The input parameters for the query
 * @returns A properly formatted query key
 */
export function createQueryKey(path: string[], input?: unknown): unknown[] {
  if (input === undefined) {
    return path;
  }
  return [path, input];
}

/**
 * Creates a mutation key for a tRPC procedure
 * @param path - The procedure path as an array (e.g., ['posts', 'createPost'])
 * @returns A properly formatted mutation key
 */
export function createMutationKey(path: string[]): string[] {
  return path;
}
