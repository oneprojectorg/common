import { describe, expect, it } from 'vitest';

import type { Expression } from '../services/decision/selectionPipeline/types';
import { checkMappingRules } from './checkMappingRules';
import type { MappingRule, SchemaEntry, SchemaRef } from './types';

const proposalRef: SchemaRef = { type: 'proposal', phaseId: 'submission' };
const feasibilityRef: SchemaRef = { type: 'review', phaseId: 'feasibility' };
const equityRef: SchemaRef = { type: 'review', phaseId: 'equity' };
const ballotRef: SchemaRef = { type: 'proposal', phaseId: 'ballot' };

const locationSchema = {
  type: 'object',
  'x-format': 'location',
  properties: { lat: { type: 'number' }, lng: { type: 'number' } },
};

const moneySchema = {
  type: 'object',
  'x-format': 'money',
  properties: { amount: { type: 'number' }, currency: { type: 'string' } },
};

const proposalSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    location: locationSchema,
    category: { type: ['string', 'null'] },
    f0a8a062: { type: 'string' },
    attachments: { type: 'array', items: { type: 'string' } },
    shared: { $ref: '#/definitions/shared' },
    notes: {},
  },
};

const feasibilitySchema = {
  type: 'object',
  properties: {
    cost_design: moneySchema,
    cost_construction: moneySchema,
    cost_contingency: moneySchema,
    department: { type: 'array', items: { type: 'string' } },
    __overall_recommendation: { type: 'string' },
  },
};

const equitySchema = {
  type: 'object',
  properties: {
    score_need: { type: 'integer' },
    score_reach: { type: 'integer' },
  },
};

const ballotSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 90 },
    location: locationSchema,
    budget: moneySchema,
    description: { type: 'string' },
    category: { type: ['string', 'null'] },
    departments: { type: 'array', items: { type: 'string' } },
    equity_score: { type: 'number' },
    equity_rank: { type: 'integer' },
    is_featured: { type: 'boolean' },
  },
};

const schemas: SchemaEntry[] = [
  { ref: proposalRef, schema: proposalSchema },
  { ref: feasibilityRef, schema: feasibilitySchema },
  { ref: equityRef, schema: equitySchema },
  { ref: ballotRef, schema: ballotSchema },
];

const createRule = ({
  sourceSchema = proposalRef,
  targetSchema = ballotRef,
  targetField,
  value,
}: {
  sourceSchema?: SchemaRef;
  targetSchema?: SchemaRef;
  targetField: string;
  value: Expression;
}): MappingRule => ({ sourceSchema, targetSchema, targetField, value });

const costSum: Expression = {
  function: 'sum',
  arguments: [
    { field: 'cost_design.amount' },
    { field: 'cost_construction.amount' },
    { field: 'cost_contingency.amount' },
  ],
};

const ballotRules: MappingRule[] = [
  createRule({ targetField: 'title', value: { field: 'title' } }),
  createRule({ targetField: 'description', value: { field: 'summary' } }),
  createRule({ targetField: 'location', value: { field: 'location' } }),
  createRule({ targetField: 'category', value: { field: 'category' } }),
  createRule({
    sourceSchema: feasibilityRef,
    targetField: 'budget.amount',
    value: costSum,
  }),
  createRule({
    sourceSchema: feasibilityRef,
    targetField: 'budget.currency',
    value: { field: 'cost_design.currency' },
  }),
  createRule({
    sourceSchema: feasibilityRef,
    targetField: 'departments',
    value: { field: 'department' },
  }),
  createRule({
    sourceSchema: equityRef,
    targetField: 'equity_score',
    value: {
      function: 'sum',
      arguments: [{ field: 'score_need' }, { field: 'score_reach' }],
    },
  }),
];

describe('checkMappingRules', () => {
  it('reports no problems for a rule set that fits its schemas', () => {
    expect(checkMappingRules({ rules: ballotRules, schemas })).toEqual([]);
  });

  it('accepts the sum of three cost amounts into the budget amount', () => {
    const rule = createRule({
      sourceSchema: feasibilityRef,
      targetField: 'budget.amount',
      value: costSum,
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([]);
  });

  it('reports a source and a target schema that no entry describes', () => {
    const missingRef: SchemaRef = { type: 'review', phaseId: 'missing' };
    const rule = createRule({
      sourceSchema: missingRef,
      targetSchema: missingRef,
      targetField: 'title',
      value: { field: 'title' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      { code: 'unknownSourceSchema', ruleIndex: 0, schema: missingRef },
      { code: 'unknownTargetSchema', ruleIndex: 0, schema: missingRef },
    ]);
  });

  it('reports a source field and a target field that the schemas do not have', () => {
    const rule = createRule({
      targetField: 'budget.total',
      value: { field: 'subtitle' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      { code: 'sourceFieldNotFound', ruleIndex: 0, field: 'subtitle' },
      { code: 'targetFieldNotFound', ruleIndex: 0, field: 'budget.total' },
    ]);
  });

  it('resolves an array index through items', () => {
    const rule = createRule({
      targetField: 'title',
      value: { field: 'attachments.0' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([]);
  });

  it('reports an arithmetic operand and a round argument that are not numbers', () => {
    const rules = [
      createRule({
        targetField: 'budget.amount',
        value: {
          operator: 'multiply',
          operands: [{ field: 'title' }, { value: 2 }],
        },
      }),
      createRule({
        targetField: 'equity_rank',
        value: { function: 'round', arguments: [{ field: 'location' }] },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'operandNotNumber',
        ruleIndex: 0,
        operation: 'multiply',
        operandType: { type: 'string' },
      },
      {
        code: 'operandNotNumber',
        ruleIndex: 1,
        operation: 'round',
        operandType: { type: 'object', format: 'location' },
      },
    ]);
  });

  it('reports concat arguments that are objects, arrays or booleans', () => {
    const rule = createRule({
      targetField: 'description',
      value: {
        function: 'concat',
        arguments: [
          { field: 'summary' },
          { value: 3 },
          { field: 'location' },
          { field: 'attachments' },
          { value: true },
        ],
      },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      {
        code: 'operandNotText',
        ruleIndex: 0,
        operandType: { type: 'object', format: 'location' },
      },
      { code: 'operandNotText', ruleIndex: 0, operandType: { type: 'array' } },
      {
        code: 'operandNotText',
        ruleIndex: 0,
        operandType: { type: 'boolean' },
      },
    ]);
  });

  it('reports a string mapped into a money object', () => {
    const rule = createRule({
      targetField: 'budget',
      value: { field: 'title' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 0,
        sourceType: { type: 'string' },
        targetType: { type: 'object', format: 'money' },
      },
    ]);
  });

  it('accepts a location into a location and rejects money into a location', () => {
    const rules = [
      createRule({
        targetField: 'location',
        value: { field: 'location' },
      }),
      createRule({
        sourceSchema: feasibilityRef,
        targetField: 'location',
        value: { field: 'cost_design' },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 1,
        sourceType: { type: 'object', format: 'money' },
        targetType: { type: 'object', format: 'location' },
      },
    ]);
  });

  it('rejects a number into an integer unless the rule rounds it', () => {
    const division: Expression = {
      operator: 'divide',
      operands: [{ field: 'score_need' }, { value: 2 }],
    };
    const rules = [
      createRule({
        sourceSchema: equityRef,
        targetField: 'equity_rank',
        value: division,
      }),
      createRule({
        sourceSchema: equityRef,
        targetField: 'equity_rank',
        value: { function: 'round', arguments: [division] },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 0,
        sourceType: { type: 'number' },
        targetType: { type: 'integer' },
      },
    ]);
  });

  it('accepts an integer literal into a number and a fractional literal only into a number', () => {
    const rules = [
      createRule({ targetField: 'budget.amount', value: { value: 4 } }),
      createRule({ targetField: 'equity_rank', value: { value: 4.5 } }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 1,
        sourceType: { type: 'number' },
        targetType: { type: 'integer' },
      },
    ]);
  });

  it('accepts a null literal only into a field whose type allows null', () => {
    const rules = [
      createRule({ targetField: 'category', value: { value: null } }),
      createRule({ targetField: 'title', value: { value: null } }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 1,
        sourceType: { type: 'null' },
        targetType: { type: 'string' },
      },
    ]);
  });

  it('reads the non-null member of a nullable type', () => {
    const rule = createRule({
      targetField: 'is_featured',
      value: { field: 'category' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 0,
        sourceType: { type: 'string' },
        targetType: { type: 'boolean' },
      },
    ]);
  });

  it('gives coalesce the common type of its arguments, or an unknown type', () => {
    const rules = [
      createRule({
        targetField: 'is_featured',
        value: {
          function: 'coalesce',
          arguments: [{ field: 'category' }, { value: 'none' }],
        },
      }),
      createRule({
        targetField: 'is_featured',
        value: {
          function: 'coalesce',
          arguments: [{ field: 'title' }, { value: false }],
        },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 0,
        sourceType: { type: 'string' },
        targetType: { type: 'boolean' },
      },
    ]);
  });

  it('reports no problem for a type it cannot prove', () => {
    const rules = [
      createRule({ targetField: 'budget', value: { field: 'shared' } }),
      createRule({
        targetField: 'budget',
        value: { field: 'shared.amount' },
      }),
      createRule({
        targetField: 'is_featured',
        value: { field: 'notes' },
      }),
      createRule({
        targetField: 'is_featured',
        value: {
          operator: 'add',
          operands: [{ field: 'notes' }, { value: 1 }],
        },
      }),
    ];
    const typeless: SchemaEntry = {
      ref: { type: 'review', phaseId: 'typeless' },
      schema: {
        type: 'object',
        properties: { score: { type: ['string', 'number'] } },
      },
    };
    const typelessRule = createRule({
      sourceSchema: typeless.ref,
      targetField: 'budget',
      value: { field: 'score' },
    });

    expect(
      checkMappingRules({
        rules: [...rules.slice(0, 3), typelessRule],
        schemas: [...schemas, typeless],
      }),
    ).toEqual([]);
    expect(checkMappingRules({ rules: rules.slice(3), schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 0,
        sourceType: { type: 'number' },
        targetType: { type: 'boolean' },
      },
    ]);
  });

  it('reports every problem of every rule with its rule index', () => {
    const rules = [
      ...ballotRules,
      createRule({ targetField: 'budget', value: { field: 'title' } }),
      createRule({
        sourceSchema: feasibilityRef,
        targetField: 'headline',
        value: {
          function: 'concat',
          arguments: [{ field: 'department' }, { field: 'missing' }],
        },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 8,
        sourceType: { type: 'string' },
        targetType: { type: 'object', format: 'money' },
      },
      { code: 'sourceFieldNotFound', ruleIndex: 9, field: 'missing' },
      { code: 'operandNotText', ruleIndex: 9, operandType: { type: 'array' } },
      { code: 'targetFieldNotFound', ruleIndex: 9, field: 'headline' },
    ]);
  });

  it('types comparison and logical nodes as booleans and checks the fields they read', () => {
    const isLarge: Expression = {
      operator: 'greaterThan',
      left: { field: 'score_need' },
      right: { value: 3 },
    };
    const rules = [
      createRule({
        sourceSchema: equityRef,
        targetField: 'is_featured',
        value: { and: [isLarge, { not: { field: 'score_reach' } }] },
      }),
      createRule({
        sourceSchema: equityRef,
        targetField: 'equity_score',
        value: isLarge,
      }),
      createRule({
        sourceSchema: equityRef,
        targetField: 'is_featured',
        value: {
          operator: 'equals',
          left: { field: 'score_other' },
          right: { value: 1 },
        },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 1,
        sourceType: { type: 'boolean' },
        targetType: { type: 'number' },
      },
      { code: 'sourceFieldNotFound', ruleIndex: 2, field: 'score_other' },
    ]);
  });

  it('gives if the common type of its two branches, or an unknown type', () => {
    const condition: Expression = {
      operator: 'equals',
      left: { field: 'category' },
      right: { value: 'parks' },
    };
    const rules = [
      createRule({
        targetField: 'is_featured',
        value: {
          function: 'if',
          arguments: [condition, { field: 'title' }, { field: 'summary' }],
        },
      }),
      createRule({
        targetField: 'is_featured',
        value: {
          function: 'if',
          arguments: [condition, { field: 'title' }, { value: 1 }],
        },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'typeMismatch',
        ruleIndex: 0,
        sourceType: { type: 'string' },
        targetType: { type: 'boolean' },
      },
    ]);
  });

  it('checks the operands of the other evaluator functions', () => {
    const rules = [
      createRule({
        targetField: 'equity_score',
        value: {
          function: 'min',
          arguments: [{ field: 'title' }, { value: 2 }],
        },
      }),
      createRule({
        targetField: 'description',
        value: { function: 'trim', arguments: [{ value: 3 }] },
      }),
      createRule({
        targetField: 'equity_rank',
        value: { function: 'count', arguments: [{ field: 'attachments' }] },
      }),
      createRule({
        sourceSchema: equityRef,
        targetField: 'equity_rank',
        value: { function: 'abs', arguments: [{ field: 'score_need' }] },
      }),
    ];

    expect(checkMappingRules({ rules, schemas })).toEqual([
      {
        code: 'operandNotNumber',
        ruleIndex: 0,
        operation: 'min',
        operandType: { type: 'string' },
      },
      {
        code: 'operandNotText',
        ruleIndex: 1,
        operandType: { type: 'integer' },
      },
    ]);
  });

  it('does not change its arguments', () => {
    const rules = structuredClone(ballotRules);
    const schemaEntries = structuredClone(schemas);

    checkMappingRules({ rules, schemas: schemaEntries });

    expect(rules).toEqual(ballotRules);
    expect(schemaEntries).toEqual(schemas);
  });
});
