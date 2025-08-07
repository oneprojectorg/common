import { User } from '@op/supabase/lib';
import { TransitionEngine } from './transitionEngine';

export interface ExecuteTransitionInput {
  instanceId: string;
  toStateId: string;
  transitionData?: Record<string, unknown>;
}

export const executeTransition = async ({
  data,
  user,
}: {
  data: ExecuteTransitionInput;
  user: User;
}) => {
  return TransitionEngine.executeTransition({
    data,
    user,
  });
};