import { sql } from 'drizzle-orm';
import {
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { enumToPgEnum } from '../../helpers/enums';
import { decisionBoundaries } from './decisionBoundaries.sql';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export enum DecisionVoterEnrolmentStatus {
  AWAITING_ADDRESS = 'awaiting_address',
  AWAITING_AGREE = 'awaiting_agree',
  ENROLLED = 'enrolled',
}

export const decisionVoterEnrolmentStatusEnum = pgEnum(
  'decision_voter_enrolment_status',
  enumToPgEnum(DecisionVoterEnrolmentStatus),
);

export const decisionVoterEnrolments = pgTable(
  'decision_voter_enrolments',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    boundaryId: uuid('boundary_id').references(() => decisionBoundaries.id, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),
    status: decisionVoterEnrolmentStatusEnum('status')
      .notNull()
      .default(DecisionVoterEnrolmentStatus.AWAITING_ADDRESS),
    attestationHash: text('attestation_hash'),
    attestedAt: timestamp('attested_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('decision_voter_enrolments_instance_profile_uniq').on(
      table.processInstanceId,
      table.profileId,
    ),
    check(
      'decision_voter_enrolments_enrolled_chk',
      sql`${table.status} <> 'enrolled' OR (${table.attestationHash} IS NOT NULL AND ${table.attestedAt} IS NOT NULL)`,
    ),
  ],
);

export type DecisionVoterEnrolment =
  typeof decisionVoterEnrolments.$inferSelect;
