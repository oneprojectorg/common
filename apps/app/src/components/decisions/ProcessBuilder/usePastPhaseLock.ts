import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';

import { type GetPhaseLock, getPastPhaseLock } from './pastPhaseLock';

/** Which phases of a published decision the builder must not change. */
export const usePastPhaseLock = (instanceId: string): GetPhaseLock => {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  return getPastPhaseLock({
    isDraft: instance.status === ProcessStatus.DRAFT,
    currentStateId: instance.currentStateId,
    phases: instance.instanceData?.phases,
  });
};
