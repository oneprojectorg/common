import type { User } from '@op/supabase/lib';

import {
  blankInstanceData,
  composeInstanceTemplate,
} from './composeInstanceTemplate';
import {
  createDecisionInstance,
  resolveInstanceCreator,
} from './createInstanceFromTemplate';
import { getSeededTemplateId } from './getTemplate';
import type { CreateInstanceInput } from './schemas/createInstance';
import { simpleVoting } from './schemas/definitions';
import { createInstanceDataFromTemplate } from './schemas/instanceData';

export const createInstance = async ({
  draft,
  user,
}: {
  draft: CreateInstanceInput;
  user: User;
}) => {
  const [creator, processId] = await Promise.all([
    resolveInstanceCreator(user),
    getSeededTemplateId(simpleVoting.id),
  ]);

  const instanceData =
    draft.phases.length > 0
      ? createInstanceDataFromTemplate({
          template: composeInstanceTemplate(draft),
        })
      : blankInstanceData(draft);

  return createDecisionInstance({
    ...creator,
    processId,
    instanceData,
    name: draft.name,
  });
};
