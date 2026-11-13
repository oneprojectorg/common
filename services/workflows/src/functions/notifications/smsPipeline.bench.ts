import {
  describeEnrolmentDecision,
  findDecisionPhoneNumber,
  findPendingVoterEnrolment,
  getPhoneSignupState,
  listSmsDecisions,
  parsePhoneNumber,
  summarizeSmsBallot,
} from '@op/common';
import { afterAll, beforeAll, bench, describe } from 'vitest';

import { SmsCommandFixture } from '../../../testing/smsCommandFixture';

const MEMBER = parsePhoneNumber('+15005551200');
const LINE = parsePhoneNumber('+16145551200');

const cleanups: Array<() => void | Promise<void>> = [];

let authUserId!: string;
let instanceId!: string;

beforeAll(async () => {
  const fixture = new SmsCommandFixture('sms-bench', (fn) => {
    cleanups.push(fn);
  });
  const owner = await fixture.createPhoneOnlyAccount(MEMBER);
  authUserId = owner.authUserId;
  const created = await fixture.createVotingInstance({
    owner,
    name: 'Bench decision sms-bench',
    proposalTitles: [
      { title: 'Crosswalk lighting', budget: 85_000 },
      { title: 'Protected bike lane', budget: 310_000 },
      { title: 'Speed humps', budget: 45_000 },
      { title: 'Rec center evening hours', budget: 240_000 },
      { title: 'Neighborhood tree planting', budget: 150_000 },
    ],
  });
  instanceId = created.instanceId;
  await fixture.addMember(created.instanceProfileId, owner);
  await fixture.bindLine(instanceId, LINE);
});

afterAll(async () => {
  for (const fn of cleanups.reverse()) {
    await fn();
  }
});

describe('preamble reads behind resolve-context', () => {
  bench('getPhoneSignupState (resolve-account)', async () => {
    await getPhoneSignupState({ phone: MEMBER });
  });

  bench('findDecisionPhoneNumber (resolve-line)', async () => {
    await findDecisionPhoneNumber({ phone: LINE });
  });

  bench('old shape: account then line, two steps', async () => {
    await getPhoneSignupState({ phone: MEMBER });
    await findDecisionPhoneNumber({ phone: LINE });
  });

  bench('new shape: account and line in parallel, one step', async () => {
    await Promise.all([
      getPhoneSignupState({ phone: MEMBER }),
      findDecisionPhoneNumber({ phone: LINE }),
    ]);
  });
});

describe('handler reads behind command steps', () => {
  bench('listSmsDecisions (SHOW, free text)', async () => {
    await listSmsDecisions({ authUserId });
  });

  bench('findPendingVoterEnrolment (free text)', async () => {
    await findPendingVoterEnrolment({ authUserId });
  });

  bench('describeEnrolmentDecision (VOTE, AGREE, free text)', async () => {
    await describeEnrolmentDecision({ instanceId, authUserId });
  });

  bench('summarizeSmsBallot (LIST, DONE)', async () => {
    await summarizeSmsBallot({ instanceId, authUserId });
  });
});
