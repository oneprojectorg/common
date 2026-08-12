import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils';
import { SchemaValidator } from './schemaValidator';
import {
  assertContiguousTemplateSections,
  getFieldSectionId,
  getOrderedFieldKeys,
  getTemplateSections,
  groupFieldsBySection,
} from './templateSections';
import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

/** Compiled-field stand-in: what the app's schema compilers produce. */
function field(key: string, schema: XFormatPropertySchema = {}) {
  return { key, schema };
}

const sections = [
  { id: 's1', title: 'Total Estimated Cost', description: 'All-in cost' },
  { id: 's2', title: 'Community Impact', showTotal: true },
];

describe('getTemplateSections', () => {
  it('returns declared sections in declaration order', () => {
    expect(getTemplateSections({ 'x-sections': sections })).toEqual([
      { id: 's1', title: 'Total Estimated Cost', description: 'All-in cost' },
      { id: 's2', title: 'Community Impact', showTotal: true },
    ]);
  });

  it('returns an empty list when the key is missing or not an array', () => {
    expect(getTemplateSections({})).toEqual([]);
    expect(getTemplateSections({ 'x-sections': 'nope' })).toEqual([]);
  });

  it('drops malformed and duplicate entries instead of throwing', () => {
    const result = getTemplateSections({
      'x-sections': [
        null,
        'string',
        { title: 'No id' },
        { id: '   ', title: 'Blank id' },
        { id: 'ok', title: 'Kept' },
        { id: 'ok', title: 'Duplicate' },
        // A section with no usable title would render as a blank heading, so
        // it is dropped and its members degrade to ungrouped.
        { id: 'untitled' },
        { id: 'blank-title', title: '   ' },
        { id: 'numeric-title', title: 7 },
      ],
    });

    expect(result).toEqual([{ id: 'ok', title: 'Kept' }]);
  });

  it('degrades members of a title-less section to ungrouped', () => {
    const orphan = field('orphan', { 'x-section': 'untitled' });

    expect(
      groupFieldsBySection({ 'x-sections': [{ id: 'untitled' }] }, [orphan]),
    ).toEqual([{ kind: 'field', field: orphan }]);
  });

  it('only honours showTotal when it is literally true', () => {
    expect(
      getTemplateSections({
        'x-sections': [{ id: 'a', title: 'A', showTotal: 'yes' }],
      })[0]?.showTotal,
    ).toBeUndefined();
  });
});

describe('getFieldSectionId', () => {
  it('reads the declared section id', () => {
    expect(getFieldSectionId({ 'x-section': 's1' })).toBe('s1');
  });

  it('ignores absent and blank values', () => {
    expect(getFieldSectionId({})).toBeUndefined();
    expect(getFieldSectionId({ 'x-section': '  ' })).toBeUndefined();
  });
});

describe('groupFieldsBySection', () => {
  it('leaves every field ungrouped when no sections are declared', () => {
    const fields = [field('a'), field('b')];

    expect(groupFieldsBySection({}, fields)).toEqual([
      { kind: 'field', field: fields[0] },
      { kind: 'field', field: fields[1] },
    ]);
  });

  it('places a section block at the position of its first member', () => {
    const before = field('before');
    const m1 = field('m1', { 'x-section': 's1' });
    const m2 = field('m2', { 'x-section': 's1' });
    const after = field('after');

    const blocks = groupFieldsBySection({ 'x-sections': sections }, [
      before,
      m1,
      m2,
      after,
    ]);

    expect(blocks).toEqual([
      { kind: 'field', field: before },
      { kind: 'section', section: sections[0], fields: [m1, m2] },
      { kind: 'field', field: after },
    ]);
  });

  it('never moves a field past another when members are non-contiguous', () => {
    // Non-contiguous membership is rejected at the persistence boundary (see
    // assertContiguousTemplateSections). Should one reach the renderer from a
    // template persisted before that guard, field order must still win: each
    // run becomes its own block rather than the section swallowing `middle`.
    const m1 = field('m1', { 'x-section': 's1' });
    const middle = field('middle');
    const m2 = field('m2', { 'x-section': 's1' });

    const blocks = groupFieldsBySection({ 'x-sections': sections }, [
      m1,
      middle,
      m2,
    ]);

    expect(blocks).toEqual([
      { kind: 'section', section: sections[0], fields: [m1] },
      { kind: 'field', field: middle },
      { kind: 'section', section: sections[0], fields: [m2] },
    ]);
  });

  it('keeps member order from the incoming (x-field-order) field list', () => {
    const m2 = field('m2', { 'x-section': 's1' });
    const m1 = field('m1', { 'x-section': 's1' });

    const blocks = groupFieldsBySection({ 'x-sections': sections }, [m2, m1]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind === 'section' && blocks[0].fields).toEqual([m2, m1]);
  });

  it('renders a dangling x-section ungrouped rather than hiding it', () => {
    const orphan = field('orphan', { 'x-section': 'does-not-exist' });

    expect(groupFieldsBySection({ 'x-sections': sections }, [orphan])).toEqual([
      { kind: 'field', field: orphan },
    ]);
  });

  it('emits no block for a section with no members', () => {
    const blocks = groupFieldsBySection({ 'x-sections': sections }, [
      field('a'),
    ]);

    expect(blocks.every((block) => block.kind === 'field')).toBe(true);
  });
});

describe('AJV registration of the section vendor keys', () => {
  it('compiles a template using x-sections and x-section', () => {
    const validator = new SchemaValidator();
    const template: RubricTemplateSchema = {
      type: 'object',
      'x-sections': [{ id: 's1', title: 'Total Estimated Cost' }],
      'x-field-order': ['crit'],
      properties: {
        crit: { type: 'string', 'x-format': 'long-text', 'x-section': 's1' },
      },
    };

    expect(() => validator.validateJsonSchema(template)).not.toThrow();
    expect(validator.validate(template, { crit: 'hello' }).valid).toBe(true);
  });
});

describe('getOrderedFieldKeys', () => {
  it('follows x-field-order and appends properties it forgot', () => {
    expect(
      getOrderedFieldKeys({
        'x-field-order': ['b', 'a', 'gone'],
        properties: { a: {}, b: {}, c: {} },
      }),
    ).toEqual(['b', 'a', 'c']);
  });
});

describe('assertContiguousTemplateSections', () => {
  const cost = { 'x-sections': [{ id: 'cost', title: 'Cost' }] };

  it('accepts a contiguous section', () => {
    expect(() =>
      assertContiguousTemplateSections({
        ...cost,
        'x-field-order': ['before', 'm1', 'm2', 'after'],
        properties: {
          before: {},
          m1: { 'x-section': 'cost' },
          m2: { 'x-section': 'cost' },
          after: {},
        },
      }),
    ).not.toThrow();
  });

  it('rejects a section split by another criterion', () => {
    expect(() =>
      assertContiguousTemplateSections({
        ...cost,
        'x-field-order': ['m1', 'middle', 'm2'],
        properties: {
          m1: { 'x-section': 'cost' },
          middle: {},
          m2: { 'x-section': 'cost' },
        },
      }),
    ).toThrow(ValidationError);
  });

  it('rejects a section split by a member of another section', () => {
    expect(() =>
      assertContiguousTemplateSections({
        'x-sections': [
          { id: 'cost', title: 'Cost' },
          { id: 'impact', title: 'Impact' },
        ],
        'x-field-order': ['m1', 'other', 'm2'],
        properties: {
          m1: { 'x-section': 'cost' },
          other: { 'x-section': 'impact' },
          m2: { 'x-section': 'cost' },
        },
      }),
    ).toThrow(ValidationError);
  });

  it('is a no-op when no sections are declared', () => {
    expect(() =>
      assertContiguousTemplateSections({
        'x-field-order': ['a', 'b'],
        properties: { a: { 'x-section': 'ghost' }, b: {} },
      }),
    ).not.toThrow();
  });

  it('treats a dangling section id as ungrouped, so it splits a real run', () => {
    expect(() =>
      assertContiguousTemplateSections({
        ...cost,
        'x-field-order': ['m1', 'ghost', 'm2'],
        properties: {
          m1: { 'x-section': 'cost' },
          ghost: { 'x-section': 'not-declared' },
          m2: { 'x-section': 'cost' },
        },
      }),
    ).toThrow(ValidationError);
  });
});
