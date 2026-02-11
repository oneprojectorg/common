import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';

/**
 * Fetches instance-level configuration needed by the proposal editor.
 *
 * All field constraints (required, budget max, etc.) now live in the
 * proposal template schema — this hook only provides data the schema
 * can't express (e.g. the list of selectable categories).
 */
export function useInstanceConfig(instance: ProcessInstance) {
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });

  return { categories: categoriesData.categories };
}
