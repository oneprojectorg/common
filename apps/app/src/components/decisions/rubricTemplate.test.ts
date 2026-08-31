import type { XFormatPropertySchema } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import type {
  RubricCriterionType,
  RubricTemplateSchema,
} from './rubricTemplate';
import {
  YES_NO_VALUES,
  addCriterion,
  changeCriterionType,
  createCriterionJsonSchema,
  createEmptyRubricTemplate,
  getCriteria,
  getCriterion,
  getCriterionErrors,
  getCriterionOptions,
  getCriterionType,
  getSelectedOptionValues,
  inferCriterionType,
  reorderCriteria,
  setCriterionRequired,
  setSelectOptions,
  translateRubricTemplate,
  updateCriterionDescription,
  withYesNoDefaults,
} from './rubricTemplate';

// Every builder-creatable type. `money` and `multi_select` are
// template-authored — `createCriterionJsonSchema` throws for both — so they are
// excluded here and covered separately below.
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

// ---------------------------------------------------------------------------
// Money criteria (template-authored, not creatable in the builder)
// ---------------------------------------------------------------------------

const MONEY_SCHEMA: XFormatPropertySchema = {
  type: 'object',
  title: 'Estimated Cost',
  'x-format': 'money',
  properties: {
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', const: 'USD', default: 'USD' },
  },
  required: ['amount', 'currency'],
  additionalProperties: false,
};

function templateWithMoneyCriterion(): RubricTemplateSchema {
  let template = createEmptyRubricTemplate();
  template = addCriterion(template, 'scored1', 'scored', 'Impact');
  template = {
    ...template,
    properties: { ...template.properties, cost1: { ...MONEY_SCHEMA } },
    'x-field-order': [...(template['x-field-order'] ?? []), 'cost1'],
  };
  return setCriterionRequired(template, 'cost1', true);
}

describe('money criteria', () => {
  it('infers the money type from the declared x-format', () => {
    expect(inferCriterionType({ ...MONEY_SCHEMA })).toBe('money');
  });

  it('does not reclassify an object criterion without the declaration', () => {
    expect(
      inferCriterionType({
        type: 'object',
        properties: { amount: { type: 'number' } },
      }),
    ).toBeUndefined();
  });

  it('surfaces money criteria in getCriteria', () => {
    const criteria = getCriteria(templateWithMoneyCriterion());
    const money = criteria.find((c) => c.id === 'cost1');

    expect(criteria.map((c) => c.id)).toEqual(['scored1', 'cost1']);
    expect(money?.criterionType).toBe('money');
    expect(money?.label).toBe('Estimated Cost');
    expect(money?.required).toBe(true);
    expect(money?.maxPoints).toBeUndefined();
    expect(money?.options).toEqual([]);
  });

  it('reports no builder validation errors for a money criterion', () => {
    const money = getCriteria(templateWithMoneyCriterion()).find(
      (c) => c.id === 'cost1',
    );

    expect(money && getCriterionErrors(money)).toEqual([]);
  });

  // The builder can't edit money criteria, so an error would be unfixable.
  it('reports no label error for an untitled money criterion', () => {
    let template = templateWithMoneyCriterion();
    template = {
      ...template,
      properties: {
        ...template.properties,
        cost1: { ...MONEY_SCHEMA, title: undefined },
      },
    };
    const money = getCriteria(template).find((c) => c.id === 'cost1');

    expect(money && getCriterionErrors(money)).toEqual([]);
  });

  it('refuses to change a money criterion into an editable type', () => {
    const template = templateWithMoneyCriterion();

    expect(changeCriterionType(template, 'cost1', 'scored')).toBe(template);
    expect(getCriterionType(template, 'cost1')).toBe('money');
  });

  it('keeps money criteria in x-field-order when other criteria are reordered', () => {
    const template = templateWithMoneyCriterion();
    const reordered = reorderCriteria(
      template,
      getCriteria(template)
        .map((c) => c.id)
        .reverse(),
    );

    expect(reordered['x-field-order']).toEqual(['cost1', 'scored1']);
  });
});

describe('translateRubricTemplate', () => {
  const rubric = () => {
    let template = createEmptyRubricTemplate();
    template = addCriterion(template, 'impact', 'single_select', 'Impact');
    template = updateCriterionDescription(template, 'impact', 'How many?');
    template = setSelectOptions(template, 'impact', [
      { value: 'high', title: 'High', description: 'Whole city' },
      { value: 'low', title: 'Low' },
    ]);
    template = setCriterionRequired(template, 'impact', true);
    return template;
  };

  const meta = {
    fieldTitles: { impact: 'Impacto' },
    fieldDescriptions: { impact: '¿A cuántas personas?' },
    optionLabels: { impact: { high: 'Alto', low: 'Bajo' } },
    optionDescriptions: { impact: { high: 'Toda la ciudad' } },
  };

  it('replaces criterion prompts, descriptions, and option copy', () => {
    const criterion = getCriterion(
      translateRubricTemplate(rubric(), meta),
      'impact',
    );

    expect(criterion?.label).toBe('Impacto');
    expect(criterion?.description).toBe('¿A cuántas personas?');
    expect(criterion?.options.map((option) => option.title)).toEqual([
      'Alto',
      'Bajo',
    ]);
    expect(criterion?.options[0]?.description).toBe('Toda la ciudad');
  });

  // Answers are stored against the option `const`, and validation runs off the
  // required list — translating display copy must not disturb either.
  it('leaves option values and the required list untouched', () => {
    const translated = translateRubricTemplate(rubric(), meta);
    const criterion = getCriterion(translated, 'impact');

    expect(criterion?.options.map((option) => option.value)).toEqual([
      'high',
      'low',
    ]);
    expect(criterion?.required).toBe(true);
    expect(translated.required).toEqual(['impact']);
  });

  it('keeps authored copy for criteria and options with no translation', () => {
    const translated = translateRubricTemplate(rubric(), {
      fieldTitles: {},
      fieldDescriptions: {},
      optionLabels: { impact: { high: 'Alto' } },
      optionDescriptions: {},
    });
    const criterion = getCriterion(translated, 'impact');

    expect(criterion?.label).toBe('Impact');
    expect(criterion?.description).toBe('How many?');
    expect(criterion?.options.map((option) => option.title)).toEqual([
      'Alto',
      'Low',
    ]);
  });

  it('returns the template unchanged with no translation', () => {
    const template = rubric();
    expect(translateRubricTemplate(template, null)).toBe(template);
  });
});

describe('withYesNoDefaults', () => {
  function template(): RubricTemplateSchema {
    let t = templateWithCriterion('yes_no', 'boundaries');
    t = addCriterion(t, 'impact', 'scored', 'Impact');
    t = addCriterion(t, 'notes', 'long_text', 'Notes');
    return t;
  }

  it('seeds a missing yes/no answer with no', () => {
    expect(withYesNoDefaults(template(), {})).toEqual({
      boundaries: YES_NO_VALUES.no,
    });
  });

  it('leaves an existing yes/no answer alone', () => {
    expect(
      withYesNoDefaults(template(), { boundaries: YES_NO_VALUES.yes }),
    ).toEqual({ boundaries: YES_NO_VALUES.yes });
  });

  it('never seeds non-yes/no criteria', () => {
    const seeded = withYesNoDefaults(template(), {});
    expect(seeded).not.toHaveProperty('impact');
    expect(seeded).not.toHaveProperty('notes');
  });

  it('preserves already-defined values, including a stored null', () => {
    // Only a truly absent answer is seeded; a legacy null is left for the
    // form to surface rather than silently rewritten to "no".
    expect(
      withYesNoDefaults(template(), { boundaries: null, impact: 3 }),
    ).toEqual({ boundaries: null, impact: 3 });
  });

  it('does not mutate the answers it is given', () => {
    const answers = {};
    withYesNoDefaults(template(), answers);
    expect(answers).toEqual({});
  });
});

// `multi_select` is template-authored — the builder never offers it — so these
// exercise the shape a seed writes and the readers the renderer runs on it.
describe('multi_select', () => {
  /**
   * The canonical array shape, hand-written the way a template author (or a
   * seed) writes it — `x-format` on the property, options on `items`. This is
   * the only place it is spelled out, since nothing builds it from a type.
   */
  const MULTI_SELECT_CRITERION: XFormatPropertySchema = {
    type: 'array',
    title: 'Which departments would this fall under?',
    'x-format': 'dropdown',
    minItems: 1,
    items: {
      type: 'string',
      oneOf: [
        { const: 'parks', title: 'Parks', description: 'Green space' },
        { const: 'transit', title: 'Transportation' },
      ],
    },
  };

  function multiSelectTemplate(): RubricTemplateSchema {
    return {
      type: 'object',
      'x-field-order': ['department'],
      properties: { department: MULTI_SELECT_CRITERION },
    };
  }

  it('is inferred from the authored array shape', () => {
    expect(inferCriterionType(MULTI_SELECT_CRITERION)).toBe('multi_select');
  });

  it('is never built from a type alone, like money', () => {
    expect(() => createCriterionJsonSchema('multi_select')).toThrow(
      'Multi-select criteria are template-authored',
    );
    expect(() => createCriterionJsonSchema('money')).toThrow(
      'Money criteria are template-authored',
    );
  });

  it('reads options off items, descriptions included', () => {
    expect(getCriterionOptions(multiSelectTemplate(), 'department')).toEqual([
      { value: 'parks', title: 'Parks', description: 'Green space' },
      { value: 'transit', title: 'Transportation' },
    ]);
  });

  it('is not mistaken for a single-select or a scored criterion', () => {
    expect(getCriterionType(multiSelectTemplate(), 'department')).toBe(
      'multi_select',
    );
    expect(inferCriterionType(createCriterionJsonSchema('single_select'))).toBe(
      'single_select',
    );
  });

  it('yields no builder errors — its options are unfixable there', () => {
    const criterion = getCriterion(multiSelectTemplate(), 'department');
    if (!criterion) {
      throw new Error('expected the criterion to be read back');
    }

    expect(getCriterionErrors(criterion)).toEqual([]);
  });

  it('translates option copy on items without touching option values', () => {
    const translated = translateRubricTemplate(multiSelectTemplate(), {
      fieldTitles: { department: '¿Qué departamentos?' },
      fieldDescriptions: {},
      optionLabels: { department: { parks: 'Parques' } },
      optionDescriptions: { department: { parks: 'Zonas verdes' } },
    });
    const criterion = getCriterion(translated, 'department');

    expect(criterion?.label).toBe('¿Qué departamentos?');
    expect(criterion?.options).toEqual([
      { value: 'parks', title: 'Parques', description: 'Zonas verdes' },
      { value: 'transit', title: 'Transportation' },
    ]);
  });

  it('reads the selected option ids off a stored array answer', () => {
    expect(getSelectedOptionValues(['parks', 'transit'])).toEqual([
      'parks',
      'transit',
    ]);
  });

  it('reads nothing off a value the criterion cannot have produced', () => {
    expect(getSelectedOptionValues(undefined)).toEqual([]);
    expect(getSelectedOptionValues('parks')).toEqual([]);
    expect(getSelectedOptionValues([1, null, 'parks'])).toEqual(['parks']);
  });
});
