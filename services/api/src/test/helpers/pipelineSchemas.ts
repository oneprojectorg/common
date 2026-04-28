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
 * Same shape as schemaWithPipeline but with an explicit pass-all selectionPipeline
 * (empty blocks) on the submission phase. Use this when a test wants every
 * proposal to survive the transition. Named "withoutPipeline" historically because
 * it predates the pass-none default; the explicit empty pipeline now expresses the
 * same intent.
 */
export const schemaWithoutPipeline = {
  ...schemaWithPipeline,
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    { id: 'review', name: 'Review', rules: {} },
  ],
};

/**
 * Schema with no selectionPipeline at all. Use this to exercise the pass-none
 * default fallback in advancePhase — proposals are NOT carried into the next phase
 * and the admin is expected to manually pick the survivors.
 */
export const schemaMissingPipeline = {
  ...schemaWithPipeline,
  phases: [
    { id: 'submission', name: 'Submission', rules: {} },
    { id: 'review', name: 'Review', rules: {} },
  ],
};
