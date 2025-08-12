'use client';

import { Modal, ModalBody, ModalHeader, ModalStepper } from '@op/ui/Modal';
import Form from '@rjsf/core';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useState } from 'react';

import { CustomTemplates } from './CustomTemplates';
import { CustomWidgets } from './CustomWidgets';

// Define schemas for each step
const stepSchemas: Record<number, { schema: RJSFSchema; uiSchema: UiSchema }> =
  {
    1: {
      schema: {
        type: 'object',
        title: 'Basic Information',
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
    2: {
      schema: {
        type: 'object',
        title: 'Timeline',
        required: ['startDate', 'endDate', 'votingPeriod'],
        properties: {
          startDate: {
            type: 'string',
            format: 'date',
            title: 'Start Date',
          },
          endDate: {
            type: 'string',
            format: 'date',
            title: 'End Date',
          },
          votingPeriod: {
            type: 'string',
            title: 'Voting Period',
            description: 'How long will the voting period last?',
          },
        },
      },
      uiSchema: {
        startDate: {
          'ui:widget': 'date',
        },
        endDate: {
          'ui:widget': 'date',
        },
        votingPeriod: {
          'ui:placeholder': 'e.g., 7 days',
        },
      },
    },
    3: {
      schema: {
        type: 'object',
        title: 'Eligibility',
        required: ['eligibilityCriteria'],
        properties: {
          eligibilityCriteria: {
            type: 'string',
            title: 'Eligibility Criteria',
          },
          maxRequestAmount: {
            type: 'string',
            title: 'Maximum Request Amount',
            description: 'Leave blank for no limit',
          },
          requiresProposal: {
            type: 'boolean',
            title: 'Requires proposal submission',
            default: false,
          },
        },
      },
      uiSchema: {
        eligibilityCriteria: {
          'ui:widget': 'textarea',
          'ui:placeholder': 'Who can participate in this process?',
        },
        maxRequestAmount: {
          'ui:placeholder': '$0.00',
        },
      },
    },
    4: {
      schema: {
        type: 'object',
        title: 'Review Settings',
        required: ['reviewers', 'approvalThreshold'],
        properties: {
          reviewers: {
            type: 'array',
            title: 'Reviewers',
            minItems: 1,
            items: {
              type: 'string',
              format: 'email',
            },
            description: 'Who will review and approve submissions?',
          },
          approvalThreshold: {
            type: 'string',
            title: 'Approval Threshold',
            description: 'Minimum percentage of votes needed for approval',
          },
          allowComments: {
            type: 'boolean',
            title: 'Allow reviewers to leave comments',
            default: true,
          },
        },
      },
      uiSchema: {
        reviewers: {
          'ui:options': {
            addable: true,
            removable: true,
          },
        },
        approvalThreshold: {
          'ui:placeholder': 'e.g., 51%',
        },
      },
    },
    5: {
      schema: {
        type: 'object',
        title: 'Notifications & Visibility',
        required: ['visibility'],
        properties: {
          notificationSettings: {
            type: 'object',
            title: 'Notifications',
            properties: {
              emailNotifications: {
                type: 'boolean',
                title: 'Send email notifications',
                default: true,
              },
              slackNotifications: {
                type: 'boolean',
                title: 'Send Slack notifications',
                default: false,
              },
            },
          },
          visibility: {
            type: 'string',
            title: 'Visibility',
            enum: ['public', 'private', 'invited'],
            enumNames: [
              'Public - Anyone can view this process',
              'Private - Only reviewers can view',
              'Invited - Only invited participants can view',
            ],
            default: 'public',
          },
        },
      },
      uiSchema: {
        visibility: {
          'ui:widget': 'radio',
        },
      },
    },
  };

export const CreateProcessModal = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, any>>({
    processName: '',
    description: '',
    totalBudget: '',
    startDate: '',
    endDate: '',
    votingPeriod: '',
    eligibilityCriteria: '',
    maxRequestAmount: '',
    requiresProposal: false,
    reviewers: [],
    approvalThreshold: '',
    allowComments: true,
    notificationSettings: {
      emailNotifications: true,
      slackNotifications: false,
    },
    visibility: 'public',
  });
  const [errors, setErrors] = useState<Record<number, any>>({});

  const totalSteps = 5;

  const handleNext = (step: number) => {
    // Validate current step before proceeding
    const currentSchema = stepSchemas[currentStep];
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
    // Validate the last step
    const currentSchema = stepSchemas[currentStep];
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
    const stepConfig = stepSchemas[currentStep];
    if (!stepConfig) return null;

    const description =
      currentStep === 1
        ? 'Define the key details for your decision process.'
        : currentStep === 2
          ? 'Set the timeline for your decision process.'
          : currentStep === 3
            ? 'Define eligibility and requirements.'
            : currentStep === 4
              ? 'Configure review and approval settings.'
              : 'Configure notifications and visibility.';

    return (
      <div className="flex flex-col gap-6">
        <p className="text-base text-neutral-charcoal">{description}</p>

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

  return (
    <Modal isDismissable>
      <div className="flex h-full max-h-[90vh] w-full max-w-lg flex-col">
        <ModalHeader>Set up your decision-making process</ModalHeader>

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
