'use client';

import { Modal, ModalBody, ModalHeader, ModalStepper } from '@op/ui/Modal';
import Form from '@rjsf/core';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useState } from 'react';

import { CustomTemplates } from './CustomTemplates';
import { CustomWidgets } from './CustomWidgets';

// Define schemas for each step
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
          type: 'string',
          title: 'Total Budget Available',
          minLength: 1,
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
        'ui:placeholder': '$0.00',
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
        resultsDate: {
          type: 'string',
          format: 'date',
          title: 'Results Announcement Date',
        },
      },
    },
    uiSchema: {
      submissionsOpen: {
        'ui:widget': 'date',
      },
      submissionsClose: {
        'ui:widget': 'date',
      },
      reviewOpen: {
        'ui:widget': 'date',
      },
      reviewClose: {
        'ui:widget': 'date',
      },
      votingOpen: {
        'ui:widget': 'date',
      },
      votingClose: {
        'ui:widget': 'date',
      },
      resultsDate: {
        'ui:widget': 'date',
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
          type: 'string',
          title: 'Maximum Votes Per Member',
          minLength: 1,
          description: 'How many proposals can each member vote for?',
        },
      },
    },
    uiSchema: {
      maxVotesPerMember: {
        'ui:placeholder': 'e.g., 5',
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
          type: 'string',
          title: 'Budget cap amount',
          minLength: 1,
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
        'ui:placeholder': '$0.00 USD',
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
    totalBudget: '',
    submissionsOpen: '',
    submissionsClose: '',
    reviewOpen: '',
    reviewClose: '',
    votingOpen: '',
    votingClose: '',
    resultsDate: '',
    maxVotesPerMember: '',
    categories: [],
    budgetCapAmount: '',
    descriptionGuidance: '',
    summary: {},
  });
  const [errors, setErrors] = useState<Record<number, any>>({});

  const totalSteps = stepSchemas.length;

  const handleNext = (step: number) => {
    // Validate current step before proceeding (convert 1-based to 0-based for array access)
    const currentSchema = stepSchemas[currentStep - 1];
    if (!currentSchema) {
      return;
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
      setErrors({ ...errors, [currentStep]: result.errors });
      return;
    }

    setErrors({ ...errors, [currentStep]: null });
    setCurrentStep(step);
  };

  const handlePrevious = (step: number) => {
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
      setErrors({ ...errors, [currentStep]: result.errors });
      return;
    }

    // Submit form data
    console.log('Form submitted:', formData);
  };

  const handleChange = (data: any) => {
    setFormData({ ...formData, ...data.formData });
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

        <Form
          schema={stepConfig.schema}
          uiSchema={stepConfig.uiSchema}
          formData={formData}
          onChange={handleChange}
          validator={validator}
          widgets={CustomWidgets}
          templates={CustomTemplates}
          showErrorList={false}
          liveValidate={false}
          noHtml5Validate
          omitExtraData
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
