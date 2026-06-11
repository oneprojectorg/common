/**
 * Regression tests for the process builder store's persistence contract.
 *
 * The bug: visiting the editor of a published process persisted a
 * full server snapshot to localStorage. That stale snapshot shadowed other
 * admins' saved changes on later visits, and "Update Process" sent it back
 * to the server, silently reverting their edits.
 *
 * The contract under test: only fields the user actually edited (`dirty`)
 * are ever persisted. Seeded server data stays in memory.
 */
import type { RubricTemplateSchema } from '@op/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store module calls `createJSONStorage(() => localStorage)` at import
// time, so localStorage must exist before the import is evaluated.
vi.hoisted(() => {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
});

import {
  type ProcessBuilderInstanceData,
  useProcessBuilderStore,
} from './useProcessBuilderStore';

const STORAGE_KEY = 'process-builder';
const DECISION_ID = 'decision-1';

interface PersistedShape {
  state?: {
    dirty?: Record<string, Partial<ProcessBuilderInstanceData>>;
    instances?: Record<string, ProcessBuilderInstanceData>;
    saveStates?: Record<string, unknown>;
  };
  version?: number;
}

const readPersisted = (): PersistedShape | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const parsed: PersistedShape = JSON.parse(raw);
  return parsed;
};

const emptyRubric: RubricTemplateSchema = {
  type: 'object',
  properties: {},
};

const sarahsRubric: RubricTemplateSchema = {
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
  rubricTemplate: emptyRubric,
  config: { hideBudget: false },
  phases: [{ phaseId: 'phase-1' }],
};

// Server state after another admin saved their rubric criteria
const serverDataV2: ProcessBuilderInstanceData = {
  ...serverDataV1,
  rubricTemplate: sarahsRubric,
};

beforeEach(async () => {
  localStorage.clear();
  useProcessBuilderStore.setState({
    instances: {},
    dirty: {},
    saveStates: {},
  });
  await useProcessBuilderStore.persist.rehydrate();
});

describe('useProcessBuilderStore persistence contract', () => {
  it('does not persist seeded server data to localStorage', () => {
    useProcessBuilderStore.getState().seedInstance(DECISION_ID, serverDataV1);

    const persisted = readPersisted();
    expect(persisted?.state?.instances).toBeUndefined();
    expect(persisted?.state?.saveStates).toBeUndefined();
    expect(persisted?.state?.dirty?.[DECISION_ID]).toBeUndefined();
  });

  it('persists only the fields the user actually edited', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setRubricTemplateSchema(DECISION_ID, sarahsRubric);

    const persisted = readPersisted();
    expect(persisted?.state?.dirty?.[DECISION_ID]).toEqual({
      rubricTemplate: sarahsRubric,
    });
    // Seeded fields (name, phases, config) must not ride along
    expect(persisted?.state?.instances).toBeUndefined();
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

  it('leaves no dirty residue after viewing without editing, so fresh server data wins on the next visit', async () => {
    // Session 1: admin opens the editor, makes no edits
    useProcessBuilderStore.getState().seedInstance(DECISION_ID, serverDataV1);

    // Simulate a reload: in-memory state is gone, localStorage survives
    useProcessBuilderStore.setState({
      instances: {},
      dirty: {},
      saveStates: {},
    });
    await useProcessBuilderStore.persist.rehydrate();

    // Nothing was edited, so nothing must overlay the next seed
    expect(
      useProcessBuilderStore.getState().dirty[DECISION_ID],
    ).toBeUndefined();

    // Session 2: another admin saved their rubric in the meantime; seeding
    // with the new server data must show their criteria
    useProcessBuilderStore.getState().seedInstance(DECISION_ID, serverDataV2);
    expect(
      useProcessBuilderStore.getState().instances[DECISION_ID]?.rubricTemplate,
    ).toEqual(sarahsRubric);
  });

  it('discards legacy v0 full-snapshot localStorage on rehydrate', async () => {
    // Shape persisted by the pre-fix store: full instances + saveStates
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          instances: { [DECISION_ID]: serverDataV1 },
          saveStates: { [DECISION_ID]: { status: 'saved' } },
        },
        version: 0,
      }),
    );

    await useProcessBuilderStore.persist.rehydrate();

    const state = useProcessBuilderStore.getState();
    // The stale snapshot must not leak into either slice
    expect(state.instances).toEqual({});
    expect(state.dirty).toEqual({});
  });

  it('clears dirty fields and persisted residue on clearInstance', () => {
    const store = useProcessBuilderStore.getState();
    store.seedInstance(DECISION_ID, serverDataV1);
    store.setRubricTemplateSchema(DECISION_ID, sarahsRubric);

    useProcessBuilderStore.getState().clearInstance(DECISION_ID);

    expect(
      useProcessBuilderStore.getState().dirty[DECISION_ID],
    ).toBeUndefined();
    const persisted = readPersisted();
    expect(persisted?.state?.dirty?.[DECISION_ID]).toBeUndefined();
  });
});
