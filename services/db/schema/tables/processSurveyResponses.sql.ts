import type { InferModel } from 'drizzle-orm';
import { index, jsonb, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

// Anonymous response data. Intentionally has no FK to the submitter so
// responses cannot be linked back to a profile via schema-level joins.
export const decisionProcessSurveyResponses = pgTable(
  'decision_process_survey_responses',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    internalData: jsonb('internal_data')
      .$type<Record<string, unknown>>()
      .notNull(),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('dpsr_process_instance_id_idx').on(table.processInstanceId),
  ],
);

export type DecisionProcessSurveyResponse = InferModel<
  typeof decisionProcessSurveyResponses
>;

// Records which profiles have submitted a survey for a process instance.
// Used to gate duplicate submissions without linking submitters to responses.
export const decisionProcessSurveySubmitters = pgTable(
  'decision_process_survey_submitters',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    submittedByProfileId: uuid('submitted_by_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('dpss_submitted_by_profile_id_idx').on(table.submittedByProfileId),
    unique('dpss_instance_profile_unique').on(
      table.processInstanceId,
      table.submittedByProfileId,
    ),
  ],
);

export type DecisionProcessSurveySubmitter = InferModel<
  typeof decisionProcessSurveySubmitters
>;
