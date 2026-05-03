import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildInstanceData } from './buildInstanceData';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { XFormatPropertySchema } from './types';

const ALL_INCLUDED = {
  processSettings: true,
  phases: true,
  proposalCategories: true,
  proposalTemplate: true,
  reviewSettings: true,
  reviewRubric: true,
  roles: true,
};

function createSourceWithRubric(): DecisionInstanceData {
  return {
    templateId: 'tmpl-1',
    templateVersion: '1.0',
    templateName: 'Test Template',
    templateDescription: 'A template',
    config: {
      categories: [{ id: 'cat1', label: 'Cat 1', description: 'Cat desc' }],
      requireCategorySelection: true,
    },
    phases: [
      {
        phaseId: 'submission',
        name: 'Submission Phase',
        description: 'Submit proposals',
        headline: 'Submit your proposals',
        rules: {
          proposals: { submit: true, edit: true, review: false },
        },
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-02-01T00:00:00Z',
      },
      {
        phaseId: 'review',
        name: 'Review Phase',
        description: 'Review proposals',
        headline: 'Review submitted proposals',
        rules: {
          proposals: { submit: false, edit: false, review: true },
        },
        startDate: '2025-02-01T00:00:00Z',
        endDate: '2025-03-01T00:00:00Z',
      },
      {
        phaseId: 'final',
        name: 'Final Phase',
        description: 'Final selection',
        headline: 'Make final selections',
        rules: {
          proposals: { submit: false, edit: false, review: false },
        },
        startDate: '2025-03-01T00:00:00Z',
        endDate: '2025-04-01T00:00:00Z',
      },
    ],
    proposalTemplate: {
      type: 'object',
      properties: {
        title: { type: 'string', title: 'Title' },
        description: { type: 'string', title: 'Description' },
      },
      'x-field-order': ['title', 'description'],
      required: ['title'],
    },
    rubricTemplate: {
      type: 'object',
      properties: {
        quality: {
          type: 'integer',
          title: 'Quality',
          'x-format': 'dropdown',
          minimum: 1,
          maximum: 5,
          oneOf: [
            { const: 1, title: 'Poor' },
            { const: 2, title: 'Fair' },
            { const: 3, title: 'Good' },
            { const: 4, title: 'Very Good' },
            { const: 5, title: 'Excellent' },
          ],
        },
        feedback: {
          type: 'string',
          title: 'Feedback',
          'x-format': 'long-text',
        },
      },
      'x-field-order': ['quality', 'feedback'],
      required: ['quality'],
    },
  };
}

describe('buildInstanceData', () => {
  describe('rubric template duplication', () => {
    it('copies rubric template when reviewRubric is true', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      expect(result.rubricTemplate).toBeDefined();
      expect(result.rubricTemplate).toEqual(source.rubricTemplate);
    });

    it('preserves rubric properties with all fields', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      const quality = result.rubricTemplate?.properties?.['quality'];
      expect(quality).toBeDefined();
      expect(quality?.title).toBe('Quality');
      expect(quality?.type).toBe('integer');
      expect(quality?.['x-format']).toBe('dropdown');
      expect(quality?.maximum).toBe(5);
      expect(quality?.minimum).toBe(1);
      expect(quality?.oneOf).toHaveLength(5);
    });

    it('preserves x-field-order', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      expect(result.rubricTemplate?.['x-field-order']).toEqual([
        'quality',
        'feedback',
      ]);
    });

    it('preserves required array', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      expect(result.rubricTemplate?.required).toEqual(['quality']);
    });

    it('does not copy rubric when reviewRubric is false', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, {
        ...ALL_INCLUDED,
        reviewRubric: false,
      });

      expect(result.rubricTemplate).toBeUndefined();
    });
  });

  describe('review settings duplication', () => {
    it('copies phase rules when reviewSettings is true', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      const reviewPhase = result.phases.find((p) => p.phaseId === 'review');
      expect(reviewPhase?.rules?.proposals?.review).toBe(true);
    });

    it('strips dates from duplicated phases', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      for (const phase of result.phases) {
        expect(phase.startDate).toBeUndefined();
        expect(phase.endDate).toBeUndefined();
      }
    });

    it('does not copy phase rules when reviewSettings is false', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, {
        ...ALL_INCLUDED,
        reviewSettings: false,
      });

      const reviewPhase = result.phases.find((p) => p.phaseId === 'review');
      expect(reviewPhase?.rules).toBeUndefined();
    });
  });

  describe('rubric and review settings together', () => {
    it('duplicated data has both review enabled and valid rubric criteria', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, ALL_INCLUDED);

      // Review is enabled on the review phase
      const hasReview = result.phases.some(
        (p) => p.rules?.proposals?.review === true,
      );
      expect(hasReview).toBe(true);

      // Rubric template has criteria
      const fieldOrder = result.rubricTemplate?.['x-field-order'];
      expect(Array.isArray(fieldOrder)).toBe(true);
      expect(fieldOrder!.length).toBeGreaterThan(0);

      // All criteria have non-empty titles (labels)
      for (const id of fieldOrder!) {
        const prop = result.rubricTemplate?.properties?.[id];
        expect(prop?.title).toBeTruthy();
      }
    });

    it('review enabled without rubric means no rubric criteria', () => {
      const source = createSourceWithRubric();
      const result = buildInstanceData(source, {
        ...ALL_INCLUDED,
        reviewRubric: false,
      });

      const hasReview = result.phases.some(
        (p) => p.rules?.proposals?.review === true,
      );
      expect(hasReview).toBe(true);
      expect(result.rubricTemplate).toBeUndefined();
    });
  });

  describe('encoder round-trip preserves rubric data', () => {
    const phaseRulesEncoder = z.object({
      proposals: z
        .object({
          submit: z.boolean().optional(),
          edit: z.boolean().optional(),
          review: z.boolean().optional(),
        })
        .optional(),
      voting: z
        .object({
          submit: z.boolean().optional(),
          edit: z.boolean().optional(),
        })
        .optional(),
      advancement: z
        .object({
          method: z.enum(['date', 'manual']),
          endDate: z.string().optional(),
        })
        .optional(),
    });

    const rubricTemplateEncoder = z
      .object({
        type: z.literal('object'),
        properties: z
          .record(
            z.string(),
            z
              .object({
                type: z.string().optional(),
                title: z.string().optional(),
                description: z.string().optional(),
                minimum: z.number().optional(),
                maximum: z.number().optional(),
                oneOf: z
                  .array(
                    z.object({
                      const: z.union([z.number(), z.string()]),
                      title: z.string(),
                    }),
                  )
                  .optional(),
                'x-format': z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
        required: z.array(z.string()).optional(),
        'x-field-order': z.array(z.string()).optional(),
      })
      .passthrough();

    const instancePhaseDataEncoder = z.object({
      phaseId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      headline: z.string().optional(),
      additionalInfo: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      rules: phaseRulesEncoder.optional(),
      selectionPipeline: z
        .object({
          version: z.string(),
          blocks: z.array(z.unknown()),
        })
        .optional(),
      settingsSchema: z.record(z.string(), z.unknown()).optional(),
      settings: z.record(z.string(), z.unknown()).optional(),
    });

    const instanceDataEncoder = z.object({
      config: z.record(z.string(), z.unknown()).optional(),
      fieldValues: z.record(z.string(), z.unknown()).optional(),
      templateId: z.string().optional(),
      templateVersion: z.string().optional(),
      templateName: z.string().optional(),
      templateDescription: z.string().optional(),
      phases: z.array(instancePhaseDataEncoder).optional(),
      proposalTemplate: z.record(z.string(), z.unknown()).optional(),
      rubricTemplate: rubricTemplateEncoder.optional(),
    });

    it('preserves rubric template through encoder parse', () => {
      const source = createSourceWithRubric();
      const duplicated = buildInstanceData(source, ALL_INCLUDED);

      const encoded = instanceDataEncoder.parse(duplicated);

      expect(encoded.rubricTemplate).toBeDefined();
      expect(encoded.rubricTemplate?.['x-field-order']).toEqual([
        'quality',
        'feedback',
      ]);
      expect(encoded.rubricTemplate?.properties?.['quality']?.title).toBe(
        'Quality',
      );
      expect(encoded.rubricTemplate?.properties?.['quality']?.maximum).toBe(5);
      expect(
        encoded.rubricTemplate?.properties?.['quality']?.['x-format'],
      ).toBe('dropdown');
      expect(
        encoded.rubricTemplate?.properties?.['feedback']?.['x-format'],
      ).toBe('long-text');
    });

    it('preserves phase review rules through encoder parse', () => {
      const source = createSourceWithRubric();
      const duplicated = buildInstanceData(source, ALL_INCLUDED);

      const encoded = instanceDataEncoder.parse(duplicated);

      const reviewPhase = encoded.phases?.find(
        (p) => p.phaseId === 'review',
      );
      expect(reviewPhase?.rules?.proposals?.review).toBe(true);
    });

    it('double parse (simulating getDecisionBySlug) preserves data', () => {
      const source = createSourceWithRubric();
      const duplicated = buildInstanceData(source, ALL_INCLUDED);

      const firstParse = instanceDataEncoder.parse(duplicated);
      const secondParse = instanceDataEncoder.parse(firstParse);

      expect(secondParse.rubricTemplate?.['x-field-order']).toEqual([
        'quality',
        'feedback',
      ]);
      expect(secondParse.rubricTemplate?.properties?.['quality']?.title).toBe(
        'Quality',
      );

      const reviewPhase = secondParse.phases?.find(
        (p) => p.phaseId === 'review',
      );
      expect(reviewPhase?.rules?.proposals?.review).toBe(true);
    });
  });

  describe('validation simulation for duplicated data', () => {
    function hasReviewPhase(data: {
      phases?: { rules?: { proposals?: { review?: boolean } } }[];
    }): boolean {
      return (data.phases ?? []).some(
        (p) => p.rules?.proposals?.review === true,
      );
    }

    function hasRubricCriteria(data: {
      rubricTemplate?: { 'x-field-order'?: string[] };
    }): boolean {
      const order = data.rubricTemplate?.['x-field-order'];
      return Array.isArray(order) && order.length > 0;
    }

    function inferCriterionType(
      schema: XFormatPropertySchema,
    ): string | undefined {
      const xFormat = schema['x-format'];
      if (xFormat === 'long-text') {
        return 'long_text';
      }
      if (xFormat === 'dropdown') {
        if (schema.type === 'integer' && schema.maximum != null) {
          return 'scored';
        }
        if (schema.type === 'string') {
          const values = (schema.oneOf ?? []).map((e) => e.const);
          if (
            values.length === 2 &&
            values.includes('yes') &&
            values.includes('no')
          ) {
            return 'yes_no';
          }
        }
      }
      return undefined;
    }

    function allRubricCriteriaValid(data: DecisionInstanceData): boolean {
      if (!data.rubricTemplate) {
        return true;
      }
      const order = data.rubricTemplate['x-field-order'] ?? [];
      for (const id of order) {
        const prop = data.rubricTemplate.properties?.[id];
        if (!prop) {
          return false;
        }
        const criterionType = inferCriterionType(prop);
        if (!criterionType) {
          continue;
        }
        const label = prop.title ?? '';
        if (!label.trim()) {
          return false;
        }
      }
      return true;
    }

    it('duplicated data with rubric passes rubric validation checks', () => {
      const source = createSourceWithRubric();
      const duplicated = buildInstanceData(source, ALL_INCLUDED);

      expect(hasReviewPhase(duplicated)).toBe(true);
      expect(hasRubricCriteria(duplicated)).toBe(true);
      expect(allRubricCriteriaValid(duplicated)).toBe(true);
    });

    it('rubric checks pass: !hasReviewPhase || (hasCriteria && allValid)', () => {
      const source = createSourceWithRubric();
      const duplicated = buildInstanceData(source, ALL_INCLUDED);

      const rubricCriteriaValid =
        !hasReviewPhase(duplicated) || hasRubricCriteria(duplicated);
      const rubricErrorsValid =
        !hasReviewPhase(duplicated) || allRubricCriteriaValid(duplicated);

      expect(rubricCriteriaValid).toBe(true);
      expect(rubricErrorsValid).toBe(true);
    });

    it('review enabled without rubric fails rubric criteria check', () => {
      const source = createSourceWithRubric();
      const duplicated = buildInstanceData(source, {
        ...ALL_INCLUDED,
        reviewRubric: false,
      });

      expect(hasReviewPhase(duplicated)).toBe(true);
      expect(hasRubricCriteria(duplicated)).toBe(false);

      const rubricCriteriaValid =
        !hasReviewPhase(duplicated) || hasRubricCriteria(duplicated);
      expect(rubricCriteriaValid).toBe(false);
    });
  });
});
