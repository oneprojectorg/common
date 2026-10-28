import type { DecisionSchemaDefinition } from '@op/common';
import {
  TEST_USER_DEFAULT_PASSWORD,
  createDecisionInstance,
  createOrganization,
  createProposal,
  getSeededTemplate,
} from '@op/common/testing/data';
import {
  ProposalStatus,
  processInstances,
  proposals as proposalsTable,
  stateTransitionHistory,
} from '@op/db/schema';
import { db, eq, inArray } from '@op/db/test';
import { writeFileSync } from 'node:fs';

import { createSupabaseAdminClient } from '../fixtures/auth.js';

const args = new Map(
  process.argv
    .slice(2)
    .map((arg) => arg.replace(/^--/, '').split('='))
    .map(([key, value]) => [key, value ?? 'true']),
);
const label = args.get('label') ?? 'demo';
const processBudget = Number(args.get('budget') ?? 12000);
const hideBudget = args.get('hide-budget') === 'true';
const out = args.get('out');

const schema: DecisionSchemaDefinition = {
  id: 'award-demo-last-phase',
  version: '1.0.0',
  name: 'Award demo',
  description:
    'Pipeline limits submission → final to zero proposals; final is last.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    {
      id: 'final',
      name: 'Final',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};

const specs = [
  { title: 'Proposal Alpha', budget: { amount: 5000, currency: 'USD' } },
  { title: 'Proposal Beta', budget: { amount: 8000, currency: 'USD' } },
  { title: 'Proposal Gamma', budget: { amount: 2500, currency: 'USD' } },
  { title: 'Proposal Euro', budget: { amount: 4000, currency: 'EUR' } },
];

const testId = `award-demo-${label}`;
const supabaseAdmin = createSupabaseAdminClient();

const org = await createOrganization({
  testId,
  supabaseAdmin,
  users: { admin: 1, member: 1 },
  organizationName: `Award Demo Org ${label}`,
});

const template = await getSeededTemplate();
const instance = await createDecisionInstance({
  processId: template.id,
  ownerProfileId: org.organizationProfile.id,
  authUserId: org.adminUser.authUserId,
  email: org.adminUser.email,
  name: `Award demo ${label}`,
  schema,
  phaseSettings: { final: { budget: processBudget } },
});

const proposals = await Promise.all(
  specs.map(({ title, budget }) =>
    createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: { title, budget },
      status: ProposalStatus.DRAFT,
    }),
  ),
);

await db
  .update(proposalsTable)
  .set({ status: ProposalStatus.SUBMITTED })
  .where(
    inArray(
      proposalsTable.id,
      proposals.map((p) => p.id),
    ),
  );

const instanceData = instance.instance.instanceData;
await db
  .update(processInstances)
  .set({
    currentStateId: 'final',
    ...(hideBudget &&
      typeof instanceData === 'object' &&
      instanceData !== null && {
        instanceData: {
          ...instanceData,
          config: {
            ...('config' in instanceData &&
            typeof instanceData.config === 'object'
              ? instanceData.config
              : {}),
            hideBudget: true,
          },
        },
      }),
  })
  .where(eq(processInstances.id, instance.instance.id));

await db.insert(stateTransitionHistory).values({
  processInstanceId: instance.instance.id,
  fromStateId: 'submission',
  toStateId: 'final',
  transitionData: {},
});

const member = org.memberUsers[0];
const result = {
  label,
  processBudget,
  hideBudget,
  password: TEST_USER_DEFAULT_PASSWORD,
  admin: { email: org.adminUser.email, authUserId: org.adminUser.authUserId },
  member: member
    ? { email: member.email, authUserId: member.authUserId }
    : null,
  instance: { id: instance.instance.id, slug: instance.slug },
  proposals: proposals.map((proposal, index) => ({
    id: proposal.id,
    title: specs[index]?.title,
    budget: specs[index]?.budget,
  })),
  cleanup: {
    profileIds: [...org.createdIds.profileIds, instance.profileId],
    authUserIds: org.createdIds.authUserIds,
  },
};

const json = JSON.stringify(result, null, 2);
if (out) {
  writeFileSync(out, json);
}
console.log(json);
process.exit(0);
