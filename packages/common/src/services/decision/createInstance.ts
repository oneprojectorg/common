import type { User } from '@op/supabase/lib';

import {
  blankInstanceData,
  composeInstanceTemplate,
} from './composeInstanceTemplate';
import {
  createDecisionInstance,
  resolveInstanceCreator,
} from './createInstanceFromTemplate';
import type { CreateInstanceInput } from './schemas/createInstance';
import { createInstanceDataFromTemplate } from './schemas/instanceData';

export const createInstance = async ({
  draft,
  user,
}: {
  draft: CreateInstanceInput;
  user: User;
}) => {
  const creator = await resolveInstanceCreator(user);

  const instanceData =
    draft.phases.length > 0
      ? createInstanceDataFromTemplate({
          template: composeInstanceTemplate(draft),
        })
      : blankInstanceData(draft);

  return createDecisionInstance({
    ...creator,
    processId: null,
    instanceData,
    name: draft.name,
  });
};
