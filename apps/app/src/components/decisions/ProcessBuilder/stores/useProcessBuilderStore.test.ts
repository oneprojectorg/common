/**
 * Tests for the process builder store's dirty-tracking contract.
 *
 * The store is in-memory only. `dirty` must distinguish the user's own
 * edits from seeded server data: "Update Process" sends only dirty
 * fields, and seeding overlays only dirty fields — anything else would
 * let one admin's stale view shadow or revert another admin's saved
 * changes.
 */
import type { RubricTemplateSchema } from '@op/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type ProcessBuilderInstanceData,
  useProcessBuilderStore,
} from './useProcessBuilderStore';

const DECISION_ID = 'decision-1';

const rubric: RubricTemplateSchema = {
  type: 'object',
  properties: {
    criterion_1: {
      type: 'string',
      title: 'Community impact',
    },
  },
};

const serverDataV1: ProcessBuilderInstanceData = {
  name: 'Budgeting Pilot',
  description: 'Participatory budgeting pilot',
  rubricTemplate: { type: 'object', properties: {} },
  config: { hideBudget: false },
  phases: [{ phaseId: 'phase-1' }],
};

// Server state after another admin saved their rubric criteria
const serverDataV2: ProcessBuilderInstanceData = {
  ...serverDataV1,
  rubricTemplate: rubric,
};

beforeEach(() => {
  useProcessBuilderStore.setState({
    instances: {},
    dirty: {},
    saveStates: {},
  });
});

describe('useProcessBuilderStore dirty tracking', () => {
  it('seeding marks nothing dirty', () => {
    useProcessBuilderStore.getState().seedInstance(DECISION_ID, serverDataV1);

    expect(
      useProcessBuilderStore.getState().dirty[DECISION_ID],
    ).toBeUndefined();
  });

  it('re-seeding with fresh server data replaces the previous seed', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.seedInstance(DECISION_ID, serverDataV2);

    expect(
      useProcessBuilderStore.getState().instances[DECISION_ID]?.rubricTemplate,
    ).toEqual(rubric);
    expect(
      useProcessBuilderStore.getState().dirty[DECISION_ID],
    ).toBeUndefined();
  });

  it('edits record only the edited fields as dirty', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setRubricTemplateSchema(DECISION_ID, rubric);

    // Seeded fields (name, phases, config) must not ride along
    expect(useProcessBuilderStore.getState().dirty[DECISION_ID]).toEqual({
      rubricTemplate: rubric,
    });
  });

  it('deep-merges config edits into the dirty map', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setInstanceData(DECISION_ID, { config: { hideBudget: true } });
    store.setInstanceData(DECISION_ID, {
      config: { organizeByCategories: false },
    });

    expect(useProcessBuilderStore.getState().dirty[DECISION_ID]).toEqual({
      config: { hideBudget: true, organizeByCategories: false },
    });
  });

  it('removes confirmed-saved fields from dirty, keeping unsaved ones', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setInstanceData(DECISION_ID, { name: 'New name' });
    store.setRubricTemplateSchema(DECISION_ID, rubric);
    store.setInstanceData(DECISION_ID, {
      config: { hideBudget: true, organizeByCategories: false },
    });

    // Simulate a successful autosave of name + one config sub-key
    useProcessBuilderStore.getState().clearDirtyFields(DECISION_ID, {
      name: 'New name',
      config: { hideBudget: true },
    });

    // The failed/unsaved edits must survive
    expect(useProcessBuilderStore.getState().dirty[DECISION_ID]).toEqual({
      rubricTemplate: rubric,
      config: { organizeByCategories: false },
    });
  });

  it('drops the dirty entry entirely once every field is confirmed saved', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setInstanceData(DECISION_ID, { name: 'New name' });

    useProcessBuilderStore
      .getState()
      .clearDirtyFields(DECISION_ID, { name: 'New name' });

    expect(
      useProcessBuilderStore.getState().dirty[DECISION_ID],
    ).toBeUndefined();
  });

  it('clears dirty fields on clearInstance', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setRubricTemplateSchema(DECISION_ID, rubric);

    useProcessBuilderStore.getState().clearInstance(DECISION_ID);

    expect(
      useProcessBuilderStore.getState().dirty[DECISION_ID],
    ).toBeUndefined();
    expect(
      useProcessBuilderStore.getState().instances[DECISION_ID],
    ).toBeUndefined();
  });
});
