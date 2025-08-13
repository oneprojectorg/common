'use client';

import { Modal, ModalBody, ModalHeader, ModalStepper } from '@op/ui/Modal';
import Form from '@rjsf/core';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useState } from 'react';

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
        'submissionsOpen',
        'submissionsClose',
        'reviewOpen',
        'reviewClose',
        'votingOpen',
        'votingClose',
        'resultsDate',
      ],
      properties: {
        proposalSubmissionPhase: {
          type: 'object',
          title: 'Proposal Submission Phase',
          description: 'Members submit proposals and ideas for funding consideration.',
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
          description: 'Reviewers create a shortlist of eligible proposals for voting.',
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
          description: 'All members vote on shortlisted proposals to decide which projects receive funding.',
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

export const CreateProcessModal = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, any>>({
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

  const handleNext = (step: number) => {
    // Validate current step before proceeding (convert 1-based to 0-based for array access)
    const currentSchema = stepSchemas[currentStep - 1];
    if (!currentSchema) {
      return false;
    }

    const currentStepData = Object.keys(
      currentSchema.schema.properties || {},
    ).reduce((acc, key) => ({ ...acc, [key]: formData[key] }), {});

    // Use the validator to check the current step data
    const result = validator.rawValidation(
      currentSchema.schema,
      currentStepData,
    );

    if (result.errors && result.errors.length > 0) {
      // Convert validation errors to field-level errors for RJSF
      const fieldErrors: Record<string, any> = {};
      result.errors.forEach((error: any) => {
        if (error.instancePath) {
          // Remove leading slash and convert to field name
          const fieldName = error.instancePath.substring(1);
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        } else if (error.property) {
          // Handle property-based errors
          const fieldName = error.property.substring(9); // Remove 'instance.' prefix if present
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        }
      });

      setErrors({ ...errors, [currentStep]: fieldErrors });
      return false;
    }

    // Clear errors and proceed to next step
    setErrors({ ...errors, [currentStep]: null });
    setCurrentStep(step);
  };

  const handlePrevious = (step: number) => {
    // Clear errors when going back
    setErrors({ ...errors, [step]: null });
    setCurrentStep(step);
  };

  const handleFinish = () => {
    // Validate the last step (convert 1-based to 0-based for array access)
    const currentSchema = stepSchemas[currentStep - 1];
    if (!currentSchema) return;

    const currentStepData = Object.keys(
      currentSchema.schema.properties || {},
    ).reduce((acc, key) => ({ ...acc, [key]: formData[key] }), {});

    const result = validator.rawValidation(
      currentSchema.schema,
      currentStepData,
    );

    if (result.errors && result.errors.length > 0) {
      // Convert validation errors to field-level errors for RJSF
      const fieldErrors: Record<string, any> = {};
      result.errors.forEach((error: any) => {
        if (error.instancePath) {
          // Remove leading slash and convert to field name
          const fieldName = error.instancePath.substring(1);
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        } else if (error.property) {
          // Handle property-based errors
          const fieldName = error.property.substring(9); // Remove 'instance.' prefix if present
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        }
      });

      setErrors({ ...errors, [currentStep]: fieldErrors });
      return;
    }

    // Submit form data
    console.log('Form submitted:', formData);
  };

  const handleChange = (data: any) => {
    setFormData({ ...formData, ...data.formData });
    // Clear field-level errors when user starts making changes
    if (errors[currentStep]) {
      setErrors({ ...errors, [currentStep]: null });
    }
  };

  const handleError = (errors: any) => {
    // This gets called when live validation finds errors
    // We can use this to update our error state in real-time
    console.log('Validation errors:', errors);
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

        <pre>{JSON.stringify(stepConfig.uiSchema, null, 2)}</pre>
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
          extraErrors={errors[currentStep]}
        >
          {/* Hide submit button - we'll use our own stepper */}
          <div style={{ display: 'none' }} />
        </Form>
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
          initialStep={1}
          totalSteps={totalSteps}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onFinish={handleFinish}
        />
      </div>
    </Modal>
  );
};
