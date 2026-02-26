'use client';

import type { RubricTemplateSchema } from '@op/common/client';
import { Suspense } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { RubricParticipantPreview } from './RubricParticipantPreview';

/**
 * Dummy rubric template schema used while the rubric builder is under
 * development. Exercises every supported field type so the participant
 * preview is fully representative.
 */
const DUMMY_RUBRIC_TEMPLATE: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': [
    'innovation',
    'feasibility',
    'meetsEligibility',
    'focusArea',
    'strengthsSummary',
    'overallComments',
  ],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      description: 'Rate the innovation level of the proposal.',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Poor' },
        { const: 2, title: 'Below Average' },
        { const: 3, title: 'Average' },
        { const: 4, title: 'Good' },
        { const: 5, title: 'Excellent' },
      ],
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      description: 'Rate the feasibility of the proposal.',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Poor' },
        { const: 2, title: 'Below Average' },
        { const: 3, title: 'Average' },
        { const: 4, title: 'Good' },
        { const: 5, title: 'Excellent' },
      ],
    },
    meetsEligibility: {
      type: 'string',
      title: 'Meets Eligibility',
      description: 'Does the proposal meet eligibility requirements?',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
    focusArea: {
      type: 'string',
      title: 'Focus Area',
      description: 'Primary focus area of the proposal.',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'education', title: 'Education' },
        { const: 'health', title: 'Health' },
        { const: 'environment', title: 'Environment' },
        { const: 'infrastructure', title: 'Infrastructure' },
      ],
    },
    strengthsSummary: {
      type: 'string',
      title: 'Key Strengths',
      description: 'Summarize the key strengths briefly.',
      'x-format': 'short-text',
    },
    overallComments: {
      type: 'string',
      title: 'Overall Comments',
      description: 'Provide detailed feedback for the proposer.',
      'x-format': 'long-text',
    },
  },
  required: ['innovation', 'feasibility', 'meetsEligibility'],
};

function CriteriaSectionContent(_props: SectionProps) {
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Left panel — blank placeholder for the future rubric builder */}
      <main className="flex-1 basis-1/2 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8" />

      <RubricParticipantPreview template={DUMMY_RUBRIC_TEMPLATE} />
    </div>
  );
}

export default function CriteriaSection(props: SectionProps) {
  return (
    <Suspense>
      <CriteriaSectionContent {...props} />
    </Suspense>
  );
}
