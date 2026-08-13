import { describe, expect, it } from 'vitest';

import type {
  RubricCriterionType,
  RubricTemplateSchema,
} from './rubricTemplate';
import {
  addCriterion,
  changeCriterionType,
  createCriterionJsonSchema,
  createEmptyRubricTemplate,
  getCriteria,
  getCriterion,
  getCriterionOptions,
  getCriterionType,
  inferCriterionType,
  setCriterionRequired,
  setSelectOptions,
  updateCriterionDescription,
  updateCriterionJsonSchema,
} from './rubricTemplate';

const ALL_TYPES: RubricCriterionType[] = [
  'scored',
  'yes_no',
  'single_select',
  'long_text',
];

function templateWithCriterion(
  type: RubricCriterionType,
  criterionId = 'crit1',
): RubricTemplateSchema {
  return addCriterion(createEmptyRubricTemplate(), criterionId, type, 'Label');
}

describe('createCriterionJsonSchema / inferCriterionType round-trip', () => {
  it.each(ALL_TYPES)('round-trips %s', (type) => {
    const schema = createCriterionJsonSchema(type);
    expect(inferCriterionType(schema)).toBe(type);
  });

  it('creates a single-select schema seeded with the given option labels', () => {
    const schema = createCriterionJsonSchema('single_select', [
      'Yes',
      'Maybe',
      'No',
    ]);

    expect(schema.type).toBe('string');
    expect(schema['x-format']).toBe('dropdown');
    expect(schema.oneOf).toHaveLength(3);

    const titles: string[] = [];
    for (const entry of schema.oneOf ?? []) {
      if (typeof entry === 'boolean') {
        throw new Error('expected oneOf entries to be schema objects');
      }
      expect(typeof entry.const).toBe('string');
      expect(entry.const).not.toBe('');
      titles.push(String(entry.title));
    }
    expect(titles).toEqual(['Yes', 'Maybe', 'No']);
  });

  it('falls back to two blank options when no labels are given', () => {
    const schema = createCriterionJsonSchema('single_select');

    expect(schema.oneOf).toHaveLength(2);
    for (const entry of schema.oneOf ?? []) {
      if (typeof entry === 'boolean') {
        throw new Error('expected oneOf entries to be schema objects');
      }
      expect(entry.title).toBe('');
    }
  });

  it('generates distinct option ids per option and per invocation', () => {
    const first = createCriterionJsonSchema('single_select');
    const second = createCriterionJsonSchema('single_select');

    const idsOf = (schema: ReturnType<typeof createCriterionJsonSchema>) =>
      (schema.oneOf ?? []).map((e) =>
        typeof e === 'boolean' ? undefined : e.const,
      );

    const allIds = [...idsOf(first), ...idsOf(second)];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('does not affect yes_no / scored inference', () => {
    expect(inferCriterionType(createCriterionJsonSchema('yes_no'))).toBe(
      'yes_no',
    );
    expect(inferCriterionType(createCriterionJsonSchema('scored'))).toBe(
      'scored',
    );
  });
});

describe('setSelectOptions', () => {
  it('adds an option', () => {
    const template = templateWithCriterion('single_select');
    const before = getCriterionOptions(template, 'crit1');

    const updated = setSelectOptions(template, 'crit1', [
      ...before,
      { value: 'opt-new', title: 'New' },
    ]);
    const after = getCriterionOptions(updated, 'crit1');

    expect(after).toHaveLength(before.length + 1);
    expect(after[after.length - 1]).toEqual({ value: 'opt-new', title: 'New' });
    // Immutability: original template untouched
    expect(getCriterionOptions(template, 'crit1')).toEqual(before);
  });

  it('relabels an option without changing its stored value', () => {
    const template = setSelectOptions(
      templateWithCriterion('single_select'),
      'crit1',
      [
        { value: 'opt-a', title: 'Parks' },
        { value: 'opt-b', title: 'Transit' },
      ],
    );

    const relabeled = getCriterionOptions(template, 'crit1').map((option) =>
      option.value === 'opt-a'
        ? { ...option, title: 'Parks Department' }
        : option,
    );
    const updated = setSelectOptions(template, 'crit1', relabeled);

    expect(getCriterionOptions(updated, 'crit1')).toEqual([
      { value: 'opt-a', title: 'Parks Department' },
      { value: 'opt-b', title: 'Transit' },
    ]);
  });

  it('removes an option', () => {
    let template = templateWithCriterion('single_select');
    template = setSelectOptions(template, 'crit1', [
      { value: 'opt-a', title: 'A' },
      { value: 'opt-b', title: 'B' },
      { value: 'opt-c', title: 'C' },
    ]);

    const remaining = getCriterionOptions(template, 'crit1').filter(
      (option) => option.value !== 'opt-a',
    );
    const updated = setSelectOptions(template, 'crit1', remaining);
    const values = getCriterionOptions(updated, 'crit1').map((o) => o.value);

    expect(values).toEqual(['opt-b', 'opt-c']);
  });

  it('reorders options while preserving stored values', () => {
    let template = templateWithCriterion('single_select');
    template = setSelectOptions(template, 'crit1', [
      { value: 'opt-a', title: 'A' },
      { value: 'opt-b', title: 'B' },
      { value: 'opt-c', title: 'C' },
    ]);

    const reversed = [...getCriterionOptions(template, 'crit1')].reverse();
    const updated = setSelectOptions(template, 'crit1', reversed);

    expect(getCriterionOptions(updated, 'crit1')).toEqual([
      { value: 'opt-c', title: 'C' },
      { value: 'opt-b', title: 'B' },
      { value: 'opt-a', title: 'A' },
    ]);
  });

  it('round-trips per-option descriptions through edits', () => {
    let template = templateWithCriterion('single_select');
    template = setSelectOptions(template, 'crit1', [
      { value: 'yes', title: 'Yes', description: 'Feasible as scoped' },
      { value: 'maybe', title: 'Maybe', description: 'Needs modification' },
      { value: 'no', title: 'No', description: 'Not feasible' },
    ]);

    expect(getCriterionOptions(template, 'crit1')).toEqual([
      { value: 'yes', title: 'Yes', description: 'Feasible as scoped' },
      { value: 'maybe', title: 'Maybe', description: 'Needs modification' },
      { value: 'no', title: 'No', description: 'Not feasible' },
    ]);

    // Relabel one option the way the editor does (spread + new title):
    // untouched descriptions must survive.
    const relabeled = getCriterionOptions(template, 'crit1').map((option) =>
      option.value === 'yes' ? { ...option, title: 'Definitely' } : option,
    );
    const updated = setSelectOptions(template, 'crit1', relabeled);

    expect(getCriterionOptions(updated, 'crit1')).toEqual([
      { value: 'yes', title: 'Definitely', description: 'Feasible as scoped' },
      { value: 'maybe', title: 'Maybe', description: 'Needs modification' },
      { value: 'no', title: 'No', description: 'Not feasible' },
    ]);
  });

  it('is a no-op on non-single-select criteria', () => {
    const scored = templateWithCriterion('scored');
    expect(
      setSelectOptions(scored, 'crit1', [{ value: 'opt-a', title: 'A' }]),
    ).toBe(scored);

    const yesNo = templateWithCriterion('yes_no');
    expect(
      setSelectOptions(yesNo, 'crit1', [{ value: 'opt-a', title: 'A' }]),
    ).toBe(yesNo);
  });
});

describe('changeCriterionType', () => {
  it('preserves label, description, and required when switching to single_select', () => {
    let template = templateWithCriterion('scored');
    template = updateCriterionDescription(template, 'crit1', 'Guidance');
    template = setCriterionRequired(template, 'crit1', true);

    const updated = changeCriterionType(template, 'crit1', 'single_select', [
      'Yes',
      'Maybe',
      'No',
    ]);
    const criterion = getCriterion(updated, 'crit1');

    expect(getCriterionType(updated, 'crit1')).toBe('single_select');
    expect(criterion?.label).toBe('Label');
    expect(criterion?.description).toBe('Guidance');
    expect(criterion?.required).toBe(true);
    expect(criterion?.options.map((o) => o.title)).toEqual([
      'Yes',
      'Maybe',
      'No',
    ]);
  });

  it('preserves label, description, and required when switching away from single_select', () => {
    let template = templateWithCriterion('single_select');
    template = updateCriterionDescription(template, 'crit1', 'Guidance');
    template = setCriterionRequired(template, 'crit1', true);

    const updated = changeCriterionType(template, 'crit1', 'long_text');
    const criterion = getCriterion(updated, 'crit1');

    expect(getCriterionType(updated, 'crit1')).toBe('long_text');
    expect(criterion?.label).toBe('Label');
    expect(criterion?.description).toBe('Guidance');
    expect(criterion?.required).toBe(true);
    expect(criterion?.options).toEqual([]);
  });
});

describe('getCriteria', () => {
  it('exposes options on single-select criteria and empty arrays elsewhere', () => {
    let template = createEmptyRubricTemplate();
    template = addCriterion(template, 'score1', 'scored', 'Score');
    template = addCriterion(template, 'multi1', 'single_select', 'Department');
    template = setSelectOptions(
      template,
      'multi1',
      getCriterionOptions(template, 'multi1').map((option, i) =>
        i === 0 ? { ...option, title: 'Parks' } : option,
      ),
    );

    const criteria = getCriteria(template);
    const scored = criteria.find((c) => c.id === 'score1');
    const single = criteria.find((c) => c.id === 'multi1');

    expect(scored?.options).toEqual([]);
    expect(single?.criterionType).toBe('single_select');
    expect(single?.options).toHaveLength(2);
    expect(single?.options[0]?.title).toBe('Parks');
  });
});

describe('section membership under type changes', () => {
  it('keeps x-section when a criterion changes type', () => {
    let template = createEmptyRubricTemplate();
    template = addCriterion(template, 'crit1', 'scored', 'Impact');
    template = updateCriterionJsonSchema(template, 'crit1', {
      'x-section': 'cost',
    });

    const updated = changeCriterionType(template, 'crit1', 'long_text');

    expect(getCriterionType(updated, 'crit1')).toBe('long_text');
    // Sections are presentation only: any type can live in any section, so
    // switching the type must not silently regroup the criterion.
    expect(updated.properties?.crit1).toMatchObject({ 'x-section': 'cost' });
  });

  it('leaves an unsectioned criterion unsectioned', () => {
    let template = createEmptyRubricTemplate();
    template = addCriterion(template, 'crit1', 'scored', 'Impact');

    const updated = changeCriterionType(template, 'crit1', 'yes_no');

    expect(updated.properties?.crit1).not.toHaveProperty('x-section');
  });
});
