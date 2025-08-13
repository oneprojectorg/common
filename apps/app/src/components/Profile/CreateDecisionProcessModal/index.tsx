'use client';

// TODO: This file is a prototype of a dynamic form for decision-making. There is lots to cleanup here in terms of structure and reusability.
// We'll continue to iterate on this but one can consider this part of the code as being in "beta"
//
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { Modal, ModalBody, ModalHeader, ModalStepper } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import Form from '@rjsf/core';
import type { RJSFValidationError } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useState } from 'react';

import ErrorBoundary from '../../ErrorBoundary';
import { CustomTemplates } from './CustomTemplates';
import { CustomWidgets } from './CustomWidgets';
import {
  schemaDefaults,
  stepSchemas,
  transformFormDataToProcessSchema,
} from './schemas/simple';

const transformFormDataToInstanceData = (data: Record<string, unknown>) => {
  return {
    budget: data.totalBudget as number,
    currentStateId: 'submission',
    fieldValues: {
      categories: data.categories,
      budgetCapAmount: data.budgetCapAmount,
      descriptionGuidance: data.descriptionGuidance,
      maxVotesPerMember: data.maxVotesPerMember,
    },
    phases: [
      {
        stateId: 'submission',
        plannedStartDate: (data.proposalSubmissionPhase as any)
          ?.submissionsOpen,
        plannedEndDate: (data.proposalSubmissionPhase as any)?.submissionsClose,
      },
      {
        stateId: 'review',
        plannedStartDate: (data.reviewShortlistingPhase as any)?.reviewOpen,
        plannedEndDate: (data.reviewShortlistingPhase as any)?.reviewClose,
      },
      {
        stateId: 'voting',
        plannedStartDate: (data.votingPhase as any)?.votingOpen,
        plannedEndDate: (data.votingPhase as any)?.votingClose,
      },
      {
        stateId: 'results',
        plannedStartDate: (data.resultsAnnouncement as any)?.resultsDate,
      },
    ],
  };
};

export const CreateDecisionProcessModal = () => {
  const utils = trpc.useUtils();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] =
    useState<Record<string, unknown>>(schemaDefaults);
  const [errors, setErrors] = useState<Record<number, any>>({});

  const isOnline = useConnectionStatus();

  // tRPC mutations for creating process and instance
  const createProcess = trpc.decision.createProcess.useMutation({
    onSuccess: (process) => {
      // After process is created, create an instance
      createInstance.mutate({
        processId: process.id,
        name: formData.processName as string,
        description: formData.description as string,
        instanceData: transformFormDataToInstanceData(formData),
      });
    },
    onError: (error) => {
      handleCreateError(error, 'Failed to create decision process template');
    },
  });

  const createInstance = trpc.decision.createInstance.useMutation({
    onSuccess: (instance) => {
      toast.success({
        title: 'Decision process created successfully!',
        message: `"${instance.name}" is now ready for proposals.`,
      });

      // Invalidate the processes list to refresh the UI
      utils.decision.listProcesses.invalidate();

      // TODO: Close modal and optionally redirect to the new process
      console.log('Process instance created:', instance);
    },
    onError: (error) => {
      handleCreateError(error, 'Failed to create decision process instance');
    },
  });

  const totalSteps = stepSchemas.length;

  const handleCreateError = (error: unknown, title: string) => {
    console.error(title + ':', error);

    const errorInfo = analyzeError(error);

    if (errorInfo.isConnectionError) {
      toast.error({
        title: 'Connection issue',
        message: errorInfo.message + ' Please try creating the process again.',
      });
    } else {
      toast.error({
        title,
        message: errorInfo.message,
      });
    }
  };

  // Validate date ordering for step 2 (phases)
  const validatePhaseSequence = (): string[] => {
    const errors: string[] = [];

    if (currentStep !== 2) {
      return errors;
    }

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

    if (!isOnline) {
      toast.error({
        title: 'No connection',
        message: 'Please check your internet connection and try again.',
      });
      return;
    }

    // Prevent multiple submissions
    if (createProcess.isPending || createInstance.isPending) {
      return;
    }

    // Transform and submit form data
    const processSchema = transformFormDataToProcessSchema(formData);

    createProcess.mutate({
      name: formData.processName as string,
      description: formData.description as string,
      processSchema,
    });
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
