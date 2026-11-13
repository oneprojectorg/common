import { describe, expect, it } from 'vitest';

import { checkMappingRules } from './checkMappingRules';
import type {
  MappingExpression,
  MappingRule,
  SchemaEntry,
  SchemaRef,
} from './types';

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
  targetPointer,
  value,
}: {
  sourceSchema?: SchemaRef;
  targetSchema?: SchemaRef;
  targetPointer: string;
  value: MappingExpression;
}): MappingRule => ({ sourceSchema, targetSchema, targetPointer, value });

const costSum: MappingExpression = {
  function: 'sum',
  arguments: [
    { pointer: '/cost_design/amount' },
    { pointer: '/cost_construction/amount' },
    { pointer: '/cost_contingency/amount' },
  ],
};

const ballotRules: MappingRule[] = [
  createRule({ targetPointer: '/title', value: { pointer: '/title' } }),
  createRule({ targetPointer: '/description', value: { pointer: '/summary' } }),
  createRule({ targetPointer: '/location', value: { pointer: '/location' } }),
  createRule({ targetPointer: '/category', value: { pointer: '/category' } }),
  createRule({
    sourceSchema: feasibilityRef,
    targetPointer: '/budget/amount',
    value: costSum,
  }),
  createRule({
    sourceSchema: feasibilityRef,
    targetPointer: '/budget/currency',
    value: { pointer: '/cost_design/currency' },
  }),
  createRule({
    sourceSchema: feasibilityRef,
    targetPointer: '/departments',
    value: { pointer: '/department' },
  }),
  createRule({
    sourceSchema: equityRef,
    targetPointer: '/equity_score',
    value: {
      function: 'sum',
      arguments: [{ pointer: '/score_need' }, { pointer: '/score_reach' }],
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
      targetPointer: '/budget/amount',
      value: costSum,
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([]);
  });

  it('reports a source and a target schema that no entry describes', () => {
    const missingRef: SchemaRef = { type: 'review', phaseId: 'missing' };
    const rule = createRule({
      sourceSchema: missingRef,
      targetSchema: missingRef,
      targetPointer: '/title',
      value: { pointer: '/title' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      { code: 'unknownSourceSchema', ruleIndex: 0, schema: missingRef },
      { code: 'unknownTargetSchema', ruleIndex: 0, schema: missingRef },
    ]);
  });

  it('reports a source pointer and a target pointer that name no field', () => {
    const rule = createRule({
      targetPointer: '/budget/total',
      value: { pointer: '/subtitle' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([
      { code: 'sourcePointerNotFound', ruleIndex: 0, pointer: '/subtitle' },
      { code: 'targetPointerNotFound', ruleIndex: 0, pointer: '/budget/total' },
    ]);
  });

  it('resolves an array index through items', () => {
    const rule = createRule({
      targetPointer: '/title',
      value: { pointer: '/attachments/0' },
    });

    expect(checkMappingRules({ rules: [rule], schemas })).toEqual([]);
  });

  it('reports an arithmetic operand and a round argument that are not numbers', () => {
    const rules = [
      createRule({
        targetPointer: '/budget/amount',
        value: {
          operator: 'multiply',
          operands: [{ pointer: '/title' }, { value: 2 }],
        },
      }),
      createRule({
        targetPointer: '/equity_rank',
        value: { function: 'round', arguments: [{ pointer: '/location' }] },
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
      targetPointer: '/description',
      value: {
        function: 'concat',
        arguments: [
          { pointer: '/summary' },
          { value: 3 },
          { pointer: '/location' },
          { pointer: '/attachments' },
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
      targetPointer: '/budget',
      value: { pointer: '/title' },
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
        targetPointer: '/location',
        value: { pointer: '/location' },
      }),
      createRule({
        sourceSchema: feasibilityRef,
        targetPointer: '/location',
        value: { pointer: '/cost_design' },
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
    const division: MappingExpression = {
      operator: 'divide',
      operands: [{ pointer: '/score_need' }, { value: 2 }],
    };
    const rules = [
      createRule({
        sourceSchema: equityRef,
        targetPointer: '/equity_rank',
        value: division,
      }),
      createRule({
        sourceSchema: equityRef,
        targetPointer: '/equity_rank',
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
      createRule({ targetPointer: '/budget/amount', value: { value: 4 } }),
      createRule({ targetPointer: '/equity_rank', value: { value: 4.5 } }),
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
      createRule({ targetPointer: '/category', value: { value: null } }),
      createRule({ targetPointer: '/title', value: { value: null } }),
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
      targetPointer: '/is_featured',
      value: { pointer: '/category' },
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
        targetPointer: '/is_featured',
        value: {
          function: 'coalesce',
          arguments: [{ pointer: '/category' }, { value: 'none' }],
        },
      }),
      createRule({
        targetPointer: '/is_featured',
        value: {
          function: 'coalesce',
          arguments: [{ pointer: '/title' }, { value: false }],
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
      createRule({ targetPointer: '/budget', value: { pointer: '/shared' } }),
      createRule({
        targetPointer: '/budget',
        value: { pointer: '/shared/amount' },
      }),
      createRule({
        targetPointer: '/is_featured',
        value: { pointer: '/notes' },
      }),
      createRule({
        targetPointer: '/is_featured',
        value: {
          operator: 'add',
          operands: [{ pointer: '/notes' }, { value: 1 }],
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
      targetPointer: '/budget',
      value: { pointer: '/score' },
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
      createRule({ targetPointer: '/budget', value: { pointer: '/title' } }),
      createRule({
        sourceSchema: feasibilityRef,
        targetPointer: '/headline',
        value: {
          function: 'concat',
          arguments: [{ pointer: '/department' }, { pointer: '/missing' }],
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
      { code: 'sourcePointerNotFound', ruleIndex: 9, pointer: '/missing' },
      { code: 'operandNotText', ruleIndex: 9, operandType: { type: 'array' } },
      { code: 'targetPointerNotFound', ruleIndex: 9, pointer: '/headline' },
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
