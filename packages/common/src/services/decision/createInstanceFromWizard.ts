import type { User } from '@op/supabase/lib';

import {
  type WizardDraft,
  blankWizardInstanceData,
  composeWizardTemplate,
} from './composeWizardTemplate';
import {
  createDecisionInstance,
  resolveInstanceCreator,
} from './createInstanceFromTemplate';
import { findTemplateIdBySchemaId } from './getTemplate';
import { simpleVoting } from './schemas/definitions';
import { createInstanceDataFromTemplate } from './schemas/instanceData';

/**
 * Creates a draft decision from the create-process wizard's answers. The
 * composed template lives in `instance_data`; the seeded template row only
 * satisfies the instance's foreign key.
 */
export const createInstanceFromWizard = async ({
  draft,
  user,
}: {
  draft: WizardDraft;
  user: User;
}) => {
  const creator = await resolveInstanceCreator(user);
  const processId = await findTemplateIdBySchemaId(simpleVoting.id);

  const instanceData =
    draft.phases.length > 0
      ? createInstanceDataFromTemplate({
          template: composeWizardTemplate(draft),
        })
      : blankWizardInstanceData(draft);

  return createDecisionInstance({
    ...creator,
    processId,
    instanceData,
    name: draft.name,
  });
};
