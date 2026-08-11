import { describe, expect, it } from 'vitest';

import {
  addCriterion,
  createEmptyRubricTemplate,
  setCriterionRequired,
} from '../rubricTemplate';
import { compileRubricSchema } from './rubric';

describe('compileRubricSchema', () => {
  it('returns an empty array for a template without criteria', () => {
    expect(compileRubricSchema(createEmptyRubricTemplate())).toEqual([]);
  });

  it('stamps required from the template required array', () => {
    let template = createEmptyRubricTemplate();
    template = addCriterion(template, 'crit1', 'scored', 'Impact');
    template = addCriterion(template, 'crit2', 'long_text', 'Notes');
    template = setCriterionRequired(template, 'crit1', true);

    const fields = compileRubricSchema(template);

    expect(fields.map((f) => [f.key, f.required])).toEqual([
      ['crit1', true],
      ['crit2', false],
    ]);
  });

  it('marks a field optional again after required is cleared', () => {
    let template = createEmptyRubricTemplate();
    template = addCriterion(template, 'crit1', 'yes_no', 'Feasible');
    template = setCriterionRequired(template, 'crit1', true);
    template = setCriterionRequired(template, 'crit1', false);

    const [field] = compileRubricSchema(template);

    expect(field?.required).toBe(false);
  });
});
