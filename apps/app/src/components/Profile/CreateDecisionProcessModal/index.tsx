'use client';

import { Modal, ModalBody, ModalHeader, ModalStepper } from '@op/ui/Modal';
import Form from '@rjsf/core';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { RJSFValidationError } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useState } from 'react';

import ErrorBoundary from '../../ErrorBoundary';
import { CustomTemplates } from './CustomTemplates';
import { CustomWidgets } from './CustomWidgets';

const stepSchemas: { schema: RJSFSchema; uiSchema: UiSchema }[] = [
  {
    schema: {
      type: 'object',
      title: 'Basic Information',
      description: 'Define the key details for your decision process.',
      required: ['processName', 'totalBudget'],
      properties: {
        processName: {
          type: 'string',
          title: 'Process Name',
          minLength: 1,
        },
        description: {
          type: 'string',
          title: 'Description',
        },
        totalBudget: {
          type: 'number',
          title: 'Total Budget Available',
          description: 'The total amount available this funding round.',
        },
      },
    },
    uiSchema: {
      processName: {
        'ui:placeholder': 'e.g., 2025 Community Budget',
      },
      description: {
        'ui:widget': 'textarea',
        'ui:placeholder': 'Description for your decision-making process',
      },
      totalBudget: {
        'ui:widget': 'number',
        'ui:placeholder': '0',
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Set up your decision-making phases',
      description:
        'Members submit proposals and ideas for funding consideration.',
      required: [
        'proposalSubmissionPhase',
        'reviewShortlistingPhase',
        'votingPhase',
        'resultsAnnouncement',
      ],
      properties: {
        proposalSubmissionPhase: {
          type: 'object',
          title: 'Proposal Submission Phase',
          description:
            'Members submit proposals and ideas for funding consideration.',
          properties: {
            submissionsOpen: {
              type: 'string',
              format: 'date',
              title: 'Submissions Open',
            },
            submissionsClose: {
              type: 'string',
              format: 'date',
              title: 'Submissions Close',
            },
          },
          required: ['submissionsOpen', 'submissionsClose'],
        },
        reviewShortlistingPhase: {
          type: 'object',
          title: 'Review & Shortlisting Phase',
          description:
            'Reviewers create a shortlist of eligible proposals for voting.',
          properties: {
            reviewOpen: {
              type: 'string',
              format: 'date',
              title: 'Review Open',
            },
            reviewClose: {
              type: 'string',
              format: 'date',
              title: 'Review Close',
            },
          },
          required: ['reviewOpen', 'reviewClose'],
        },
        votingPhase: {
          type: 'object',
          title: 'Voting Phase',
          description:
            'All members vote on shortlisted proposals to decide which projects receive funding.',
          properties: {
            votingOpen: {
              type: 'string',
              format: 'date',
              title: 'Voting Open',
            },
            votingClose: {
              type: 'string',
              format: 'date',
              title: 'Voting Close',
            },
          },
          required: ['votingOpen', 'votingClose'],
        },
        resultsAnnouncement: {
          type: 'object',
          title: 'Results Announcement',
          properties: {
            resultsDate: {
              type: 'string',
              format: 'date',
              title: 'Results Announcement Date',
            },
          },
          required: ['resultsDate'],
        },
      },
    },
    uiSchema: {
      proposalSubmissionPhase: {
        submissionsOpen: {
          'ui:widget': 'date',
        },
        submissionsClose: {
          'ui:widget': 'date',
        },
      },
      reviewShortlistingPhase: {
        reviewOpen: {
          'ui:widget': 'date',
        },
        reviewClose: {
          'ui:widget': 'date',
        },
      },
      votingPhase: {
        votingOpen: {
          'ui:widget': 'date',
        },
        votingClose: {
          'ui:widget': 'date',
        },
      },
      resultsAnnouncement: {
        resultsDate: {
          'ui:widget': 'date',
        },
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Configure your voting settings',
      description: 'Set up how members will participate in the voting process.',
      required: ['maxVotesPerMember'],
      properties: {
        maxVotesPerMember: {
          type: 'number',
          title: 'Maximum Votes Per Member',
          minimum: 1,
          description: 'How many proposals can each member vote for?',
        },
      },
    },
    uiSchema: {
      maxVotesPerMember: {
        'ui:widget': 'number',
        'ui:placeholder': '5',
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Configure proposal categories',
      description:
        'Categories help organize proposals. You can add or remove categories as needed.',
      properties: {
        categories: {
          type: 'array',
          title: 'Categories',
          items: {
            type: 'string',
          },
          default: [],
          description:
            'Categories help organize proposals. You can add or remove categories as needed.',
        },
      },
    },
    uiSchema: {
      categories: {
        'ui:widget': 'CategoryList',
        'ui:options': {
          addable: true,
          removable: true,
        },
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Setup proposal template',
      description: 'Configure guidance and budget limits',
      required: ['budgetCapAmount', 'descriptionGuidance'],
      properties: {
        budgetCapAmount: {
          type: 'number',
          title: 'Budget cap amount',
          minimum: 0,
          description: 'Maximum budget amount participants can request',
        },
        descriptionGuidance: {
          type: 'string',
          title: 'Description guidance',
          description:
            'Placeholder text that appears in the proposal description area.',
        },
      },
    },
    uiSchema: {
      budgetCapAmount: {
        'ui:widget': 'number',
        'ui:placeholder': '0',
      },
      descriptionGuidance: {
        'ui:widget': 'textarea',
        'ui:placeholder':
          "e.g., Start with the problem you're addressing, explain your solution, and describe the expected impact on our community.",
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Review and launch',
      description: 'Confirm your settings before creating the process.',
      properties: {
        summary: {
          type: 'object',
          title: 'Summary',
          properties: {},
          description: 'Confirm your settings before creating the process.',
        },
      },
    },
    uiSchema: {
      summary: {
        'ui:widget': 'ReviewSummary',
      },
    },
  },
];

export const CreateDecisionProcessModal = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, unknown>>({
    processName: '',
    description: '',
    totalBudget: null,
    proposalSubmissionPhase: {
      submissionsOpen: '',
      submissionsClose: '',
    },
    reviewShortlistingPhase: {
      reviewOpen: '',
      reviewClose: '',
    },
    votingPhase: {
      votingOpen: '',
      votingClose: '',
    },
    resultsAnnouncement: {
      resultsDate: '',
    },
    maxVotesPerMember: null,
    categories: [],
    budgetCapAmount: null,
    descriptionGuidance: '',
    summary: {},
  });
  const [errors, setErrors] = useState<Record<number, any>>({});

  const totalSteps = stepSchemas.length;

  // Validate date ordering for step 2 (phases)
  const validatePhaseSequence = (): string[] => {
    const errors: string[] = [];

    if (currentStep !== 2) return errors;

    const phases = formData as any;
    const proposalPhase = phases.proposalSubmissionPhase || {};
    const reviewPhase = phases.reviewShortlistingPhase || {};
    const votingPhase = phases.votingPhase || {};
    const resultsPhase = phases.resultsAnnouncement || {};

    const submissionOpen = proposalPhase.submissionsOpen;
    const submissionClose = proposalPhase.submissionsClose;
    const reviewOpen = reviewPhase.reviewOpen;
    const reviewClose = reviewPhase.reviewClose;
    const votingOpen = votingPhase.votingOpen;
    const votingClose = votingPhase.votingClose;
    const resultsDate = resultsPhase.resultsDate;

    const dates = [
      {
        name: 'Submissions Open',
        value: submissionOpen,
        key: 'submissionsOpen',
      },
      {
        name: 'Submissions Close',
        value: submissionClose,
        key: 'submissionsClose',
      },
      { name: 'Review Open', value: reviewOpen, key: 'reviewOpen' },
      { name: 'Review Close', value: reviewClose, key: 'reviewClose' },
      { name: 'Voting Open', value: votingOpen, key: 'votingOpen' },
      { name: 'Voting Close', value: votingClose, key: 'votingClose' },
      { name: 'Results Date', value: resultsDate, key: 'resultsDate' },
    ].filter((d) => d.value); // Only validate dates that are set

    // Check chronological order
    for (let i = 0; i < dates.length - 1; i++) {
      const currentDate = dates[i];
      const nextDate = dates[i + 1];

      if (currentDate && nextDate) {
        const current = new Date(currentDate.value);
        const next = new Date(nextDate.value);

        if (current >= next) {
          errors.push(`${currentDate.name} must be before ${nextDate.name}`);
        }
      }
    }

    return errors;
  };

  // Extract validation logic to avoid duplication
  const validateCurrentStep = (): { isValid: boolean; errors: any } => {
    const currentSchema = stepSchemas[currentStep - 1];
    if (!currentSchema) return { isValid: false, errors: {} };

    const currentStepData = Object.keys(
      currentSchema.schema.properties || {},
    ).reduce<Record<string, unknown>>(
      (acc, key) => ({ ...acc, [key]: formData[key] }),
      {},
    );

    const result = validator.rawValidation(
      currentSchema.schema,
      currentStepData,
    );

    const fieldErrors: Record<string, string[]> = {};

    // Add JSON Schema validation errors
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((error) => {
        if (error.instancePath) {
          const fieldName = error.instancePath.substring(1);
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        } else if (error.property) {
          const fieldName = error.property.substring(9);
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        }
      });
    }

    // Add custom phase sequence validation for step 2
    const phaseErrors = validatePhaseSequence();
    if (phaseErrors.length > 0) {
      // Add phase sequence errors to the form-level errors
      fieldErrors['_phases'] = phaseErrors;
    }

    const hasErrors = Object.keys(fieldErrors).length > 0;
    return { isValid: !hasErrors, errors: fieldErrors };
  };

  const handleNext = (): boolean => {
    const validation = validateCurrentStep();

    if (!validation.isValid) {
      setErrors((prev) => ({ ...prev, [currentStep]: validation.errors }));
      return false;
    }

    // Clear errors and proceed to next step
    setErrors((prev) => ({ ...prev, [currentStep]: null }));
    setCurrentStep((prev) => prev + 1);
    return true;
  };

  const handlePrevious = (): void => {
    // Clear errors when going back
    setErrors((prev) => ({ ...prev, [currentStep]: null }));
    setCurrentStep((prev) => prev - 1);
  };

  const handleFinish = (): void => {
    const validation = validateCurrentStep();

    if (!validation.isValid) {
      setErrors((prev) => ({ ...prev, [currentStep]: validation.errors }));
      return;
    }

    // Submit form data
    console.log('Form submitted:', formData);
  };

  const handleChange = (data: any) => {
    if (data.formData) {
      setFormData({ ...formData, ...data.formData });
    }
    // Clear field-level errors when user starts making changes
    if (errors[currentStep]) {
      setErrors((prev) => ({ ...prev, [currentStep]: null }));
    }
  };

  const handleError = (errors: RJSFValidationError[]) => {
    // Handle live validation errors from RJSF
    if (errors.length > 0) {
      console.warn('Live validation errors:', errors);
    }
  };

  const renderStepContent = () => {
    // Convert 1-based to 0-based for array access
    const stepConfig = stepSchemas[currentStep - 1];
    if (!stepConfig) return null;

    return (
      <div className="flex flex-col gap-6">
        {stepConfig.schema.description && (
          <p className="text-base text-neutral-charcoal">
            {stepConfig.schema.description}
          </p>
        )}

        <ErrorBoundary
          fallback={
            <div className="border-functional-orange/20 bg-functional-orange/5 flex flex-col items-center gap-4 rounded-lg border p-6 text-center">
              <div className="flex flex-col gap-2">
                <h3 className="text-functional-orange text-lg font-medium">
                  Step {currentStep} Error
                </h3>
                <p className="text-sm text-neutral-charcoal">
                  Unable to render this form step. Please try going back and
                  forward again, or restart the form.
                </p>
              </div>
            </div>
          }
        >
          <Form
            schema={stepConfig.schema}
            uiSchema={stepConfig.uiSchema}
            formData={formData}
            onChange={handleChange}
            onError={handleError}
            validator={validator}
            widgets={CustomWidgets}
            templates={CustomTemplates}
            showErrorList={false}
            liveValidate={true}
            noHtml5Validate
            omitExtraData
            extraErrors={errors[currentStep] as any}
          >
            {/* Hide submit button - we'll use our own stepper */}
            <div style={{ display: 'none' }} />
          </Form>
        </ErrorBoundary>
      </div>
    );
  };

  const getCurrentStepTitle = () => {
    const stepConfig = stepSchemas[currentStep - 1];
    return stepConfig?.schema.title || 'Set up your decision-making process';
  };

  return (
    <Modal isDismissable>
      <div className="flex h-full max-h-[90vh] w-full max-w-lg flex-col">
        <ModalHeader>{getCurrentStepTitle()}</ModalHeader>

        <ModalBody className="flex-1 overflow-y-auto">
          {renderStepContent()}
        </ModalBody>

        <ModalStepper
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onFinish={handleFinish}
        />
      </div>
    </Modal>
  );
};
