import { TestDecisionsDataManager } from '@op/common/testing';

import { createAuthenticatedCaller } from '../supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

/** A draft made by the create-process wizard: it links to no process template. */
export async function createWizardDraft(
  task: { id: string },
  onTestFinished: OnTestFinished,
) {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });
  const caller = await createAuthenticatedCaller(setup.userEmail);

  const created = await caller.decision.createInstance({
    type: 'grant',
    phases: [{ kind: 'submissions', name: 'Send your application' }],
    name: `Wizard ${task.id}`,
  });
  testData.trackProfileForCleanup(created.id);

  return { created, caller, testData };
}
