import {
  processInstances,
  proposalCategories,
  ProposalStatus,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import slugify from 'slugify';

import {
  createDecisionBoundary,
  createDecisionChatLine,
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
  makeDecisionPublic,
  testSimpleVotingSchema,
} from './data';

const ADMIN_AUTH_USER_ID = '7224d58a-f460-4c0f-934a-27ea96127b18';
const ADMIN_EMAIL = 'ivan@oneproject.org';
const OWNER_PROFILE_ID = 'aaf7451a-86e8-4963-9597-2c595a6de15a';
const LINE_NUMBER = '+13306254729';
const SLUG = 'sms-voting-test';
const ATTESTATION =
  'I live in Columbus and I am 16 or older. I will vote once.';

type Ring = ReadonlyArray<readonly [number, number]>;

const box = (
  west: number,
  south: number,
  east: number,
  north: number,
): Ring => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];

const DISTRICTS = [
  { name: 'District 5', ring: box(-83.04, 39.93, -82.97, 39.99) },
  { name: 'District 3', ring: box(-82.97, 39.93, -82.9, 39.99) },
] as const;

const PROPOSALS = [
  {
    title: 'Shade trees on Parsons Ave',
    amount: 85_000,
    district: 'District 5',
    lat: 39.955,
    lng: -82.985,
  },
  {
    title: 'Lit crosswalks at Livingston & 18th',
    amount: 120_000,
    district: 'District 5',
    lat: 39.951,
    lng: -82.98,
  },
  {
    title: 'Schiller Park splash pad',
    amount: 450_000,
    district: 'District 5',
    lat: 39.942,
    lng: -82.99,
  },
  {
    title: 'Mobile food market, four stops a week',
    amount: 300_000,
    district: 'District 5',
    lat: 39.96,
    lng: -83.0,
  },
  {
    title: 'Little free pantries at six corners',
    amount: 60_000,
    district: 'District 5',
    lat: 39.948,
    lng: -82.995,
  },
  {
    title: 'Protected bike lane on Whittier St',
    amount: 200_000,
    district: 'District 5',
    lat: 39.945,
    lng: -83.01,
  },
  {
    title: 'Playground resurfacing, Nelson Park',
    amount: 150_000,
    district: 'District 3',
    lat: 39.96,
    lng: -82.93,
  },
  {
    title: 'Bus shelter on E Main at Champion',
    amount: 95_000,
    district: 'District 3',
    lat: 39.957,
    lng: -82.95,
  },
] as const;

const schema = {
  ...testSimpleVotingSchema,
  id: 'sms-voting-test',
  name: 'SMS Voting Test',
  description: 'Participatory budget vote by text message.',
  phases: testSimpleVotingSchema.phases.map((phase) =>
    phase.id === 'voting'
      ? {
          ...phase,
          rules: {
            ...phase.rules,
            voting: {
              submit: true,
              edit: true,
              ranked: true,
              voterBudget: 1_000_000,
              voterCostField: 'budget',
              enrolment: { attestation: ATTESTATION, boundary: true },
            },
          },
        }
      : phase,
  ),
};

const ensureTerm = async (label: string): Promise<string> => {
  let taxonomy = await db.query.taxonomies.findFirst({
    where: { name: 'proposal' },
  });
  if (!taxonomy) {
    [taxonomy] = await db
      .insert(taxonomies)
      .values({ name: 'proposal', description: 'Proposal categories' })
      .returning();
  }
  if (!taxonomy) {
    throw new Error('Could not create the proposal taxonomy');
  }
  const termUri = slugify(label.trim(), {
    lower: true,
    strict: true,
    trim: true,
  });
  const existing = await db.query.taxonomyTerms.findFirst({
    where: { taxonomyId: taxonomy.id, termUri },
  });
  if (existing) {
    return existing.id;
  }
  const [term] = await db
    .insert(taxonomyTerms)
    .values({ taxonomyId: taxonomy.id, termUri, label, facet: 'category' })
    .returning();
  if (!term) {
    throw new Error(`Could not create the term ${label}`);
  }
  return term.id;
};

const main = async () => {
  const existing = await db.query.profiles.findFirst({
    where: { slug: SLUG },
    columns: { id: true },
  });
  if (existing) {
    throw new Error(
      `A profile with slug ${SLUG} already exists: ${existing.id}`,
    );
  }

  const template = await createDecisionProcess({
    createdByProfileId: OWNER_PROFILE_ID,
    name: schema.name,
    schema,
  });

  const decision = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: OWNER_PROFILE_ID,
    authUserId: ADMIN_AUTH_USER_ID,
    email: ADMIN_EMAIL,
    name: schema.name,
    schema,
    slug: SLUG,
  });

  const termByDistrict = new Map<string, string>();
  for (const district of DISTRICTS) {
    const taxonomyTermId = await ensureTerm(district.name);
    termByDistrict.set(district.name, taxonomyTermId);
    await createDecisionBoundary({
      profileId: decision.profileId,
      name: district.name,
      taxonomyTermId,
      ring: district.ring,
    });
  }

  const codes: Array<{ code: number | null; title: string; district: string }> =
    [];
  for (const item of PROPOSALS) {
    const proposal = await createProposal({
      processInstanceId: decision.instance.id,
      submittedByProfileId: OWNER_PROFILE_ID,
      authUserId: ADMIN_AUTH_USER_ID,
      email: ADMIN_EMAIL,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: item.title,
        description: `<p>${item.title} for ${item.district}.</p>`,
        budget: { amount: item.amount, currency: 'USD' },
        category: [item.district],
        location: { lat: item.lat, lng: item.lng },
      },
    });
    const taxonomyTermId = termByDistrict.get(item.district);
    if (!taxonomyTermId) {
      throw new Error(`No term for ${item.district}`);
    }
    await db
      .insert(proposalCategories)
      .values({ proposalId: proposal.id, taxonomyTermId });
    const [row] = await db.query.proposals.findMany({
      where: { id: proposal.id },
      columns: { shortCode: true },
    });
    codes.push({
      code: row?.shortCode ?? null,
      title: item.title,
      district: item.district,
    });
  }

  await makeDecisionPublic({ profileId: decision.profileId });

  await db
    .update(processInstances)
    .set({ currentStateId: 'voting' })
    .where(eq(processInstances.id, decision.instance.id));

  await createDecisionChatLine({
    processInstanceId: decision.instance.id,
    phoneNumber: LINE_NUMBER,
  });

  console.log(
    JSON.stringify(
      {
        instanceId: decision.instance.id,
        profileId: decision.profileId,
        slug: decision.slug,
        line: LINE_NUMBER,
        url: `http://localhost:3100/en/decisions/${decision.slug}`,
        proposals: codes,
      },
      null,
      2,
    ),
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
