import { User } from '@op/supabase/lib';

import { TransitionEngine } from './transitionEngine';

export interface CheckTransitionsInput {
  instanceId: string;
  toStateId?: string;
}

export const checkTransitions = async ({
  data,
  user,
}: {
  data: CheckTransitionsInput;
  user: User;
}) => {
  return TransitionEngine.checkAvailableTransitions({
    instanceId: data.instanceId,
    toStateId: data.toStateId,
    user,
  });
};
