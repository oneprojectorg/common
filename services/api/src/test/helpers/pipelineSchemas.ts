/**
 * Process schemas used by pipeline / transition tests.
 */

/**
 * Process schema with a limit(2) selectionPipeline on the departing 'submission' phase.
 * Used to test that transitions persist only selected proposals.
 */
export const schemaWithPipeline = {
  id: 'pipeline-schema',
  version: '1.0.0',
  name: 'Pipeline Process',
  proposalTemplate: { type: 'object' },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-block', type: 'limit', count: 2 }],
      },
    },
    { id: 'review', name: 'Review', rules: {} },
  ],
};

/**
 * Three-phase schema with a limiting selectionPipeline on each of the first two phases.
 * submission → review (limit 3), review → final (limit 2).
 * Used to test multi-transition chaining: proposals must survive both pipelines.
 */
export const schemaWithThreePhasesAndPipelines = {
  id: 'three-phase-pipeline-schema',
  version: '1.0.0',
  name: 'Three Phase Pipeline Process',
  proposalTemplate: { type: 'object' },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-1', type: 'limit', count: 3 }],
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-2', type: 'limit', count: 2 }],
      },
    },
    { id: 'final', name: 'Final', rules: {} },
  ],
};

/**
 * Same schema without any selectionPipeline — all proposals survive the transition.
 */
export const schemaWithoutPipeline = {
  ...schemaWithPipeline,
  phases: [
    { id: 'submission', name: 'Submission', rules: {} },
    { id: 'review', name: 'Review', rules: {} },
  ],
};

/**
 * Three-phase schema without any selectionPipeline. Lets a middle phase have
 * both inbound and outbound transitions so tests can exercise drafts created
 * strictly inside a bounded phase window.
 */
export const schemaWithThreePhases = {
  ...schemaWithPipeline,
  phases: [
    { id: 'submission', name: 'Submission', rules: {} },
    { id: 'review', name: 'Review', rules: {} },
    { id: 'final', name: 'Final', rules: {} },
  ],
};
