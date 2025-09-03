'use client';

// TODO: This file is a prototype of a dynamic form for decision-making. There is lots to cleanup here in terms of structure and reusability.
// We'll continue to iterate on this but one can consider this part of the code as being in "beta"
//
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import {
  Modal,
  ModalBody,
  ModalContext,
  ModalHeader,
  ModalStepper,
} from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import Form from '@rjsf/core';
import type { RJSFValidationError } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useContext, useState } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';

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
    hideBudget: data.hideBudget as boolean,
    currentStateId: 'submission',
    fieldValues: {
      categories: data.categories,
      proposalInfoTitle: data.proposalInfoTitle,
      proposalInfoContent: data.proposalInfoContent,
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

type ValidationMode = 'none' | 'static' | 'live';

interface FieldError {
  __errors: string[];
}

interface ErrorSchema {
  [fieldName: string]: FieldError | ErrorSchema;
}

interface ValidationError {
  instancePath?: string;
  property?: string;
  schemaPath?: string;
  message?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ErrorSchema;
}

// Extract error processing logic for better testability and maintainability
const processValidationErrors = (errors: ValidationError[]): ErrorSchema => {
  const fieldErrors: ErrorSchema = {};

  errors.forEach((error) => {
    let fieldPath = '';

    if (error.instancePath) {
      // Remove leading slash and convert to nested path
      fieldPath = error.instancePath.substring(1);
    } else if (error.property) {
      fieldPath = error.property.substring(9);
    } else if (error.schemaPath) {
      // Handle required field errors that don't have instancePath
      // Extract nested field path from schema path like "/properties/proposalSubmissionPhase/properties/submissionsOpen"
      const pathMatches = error.schemaPath.match(
        /\/properties\/([^\/]+(?:\/properties\/[^\/]+)*)/,
      );
      if (pathMatches) {
        // Convert "/properties/parent/properties/child" to "parent/child"
        fieldPath = pathMatches[1]!.replace(/\/properties\//g, '/');
      }
    }

    if (fieldPath) {
      // Handle nested field paths like "proposalSubmissionPhase/submissionsOpen"
      const pathParts = fieldPath.split('/').filter(Boolean); // Remove empty parts
      let currentLevel: Record<string, any> = fieldErrors;

      // Navigate/create nested structure
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]!; // TypeScript assertion since we filtered empty parts
        if (i === pathParts.length - 1) {
          // Last part - add the error
          if (!currentLevel[part]) {
            currentLevel[part] = { __errors: [] };
          }
          currentLevel[part].__errors.push(error.message || 'Invalid value');
        } else {
          // Intermediate part - create nested structure
          if (!currentLevel[part]) {
            currentLevel[part] = {};
          }
          currentLevel = currentLevel[part];
        }
      }
    }
  });

  return fieldErrors;
};

// Custom hook for validation state management
const useStepValidation = () => {
  const [validationModes, setValidationModes] = useState<
    Record<number, ValidationMode>
  >({});
  const [stepErrors, setStepErrors] = useState<Record<number, ErrorSchema>>({});

  const setStepValidation = (
    step: number,
    mode: ValidationMode,
    errors?: ErrorSchema,
  ) => {
    setValidationModes((prev) => ({ ...prev, [step]: mode }));
    if (errors !== undefined) {
      setStepErrors((prev) => ({ ...prev, [step]: errors }));
    }
  };

  const clearStep = (step: number) => {
    setValidationModes((prev) => ({ ...prev, [step]: 'none' }));
    setStepErrors((prev) => ({ ...prev, [step]: {} }));
  };

  return {
    validationModes,
    stepErrors,
    setStepValidation,
    clearStep,
  };
};

export const CreateDecisionProcessModal = () => {
  const utils = trpc.useUtils();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] =
    useState<Record<string, unknown>>(schemaDefaults);
  const { validationModes, stepErrors, setStepValidation, clearStep } =
    useStepValidation();

  const isOnline = useConnectionStatus();

  // Get the dialog close function from React Aria Components context
  const overlayTriggerState = useContext(OverlayTriggerStateContext);
  const { onClose } = useContext(ModalContext);

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

      // Invalidate the instances list to refresh the UI
      utils.decision.listInstances.invalidate();

      // Close the modal after successful creation
      if (overlayTriggerState?.close) {
        overlayTriggerState.close();
      } else {
        onClose?.();
      }
    },
    onError: (error) => {
      handleCreateError(error, 'Failed to create decision process instance');
    },
  });

  const totalSteps = stepSchemas.length + 1; // +1 for review step

  const handleCreateError = (error: unknown, title: string) => {
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

  // Validate date ordering for phases
  const validatePhaseSequence = (): string[] => {
    const errors: string[] = [];

    if (currentStep !== 2 || currentStep === stepSchemas.length + 1) {
      return errors;
    }

    // Get phase schema from step 2 (index 1)
    const phaseSchema = stepSchemas[1];
    if (!phaseSchema?.schema.properties) {
      return errors;
    }

    const phases = formData as any;

    // We need to ensure dates follow the expected phase order
    const phaseOrder = Object.keys(phaseSchema.schema.properties);
    const datesByPhase = new Map<
      string,
      Array<{ name: string; value: string; key: string }>
    >();

    // Group dates by phase, preserving schema order
    Object.entries(phaseSchema.schema.properties).forEach(
      ([phaseKey, phaseConfig]: [string, any]) => {
        if (phaseConfig.type === 'object' && phaseConfig.properties) {
          const phaseData = phases[phaseKey] || {};
          const phaseDates: Array<{
            name: string;
            value: string;
            key: string;
          }> = [];

          // Iterate through date fields in schema order
          Object.entries(phaseConfig.properties).forEach(
            ([dateKey, dateConfig]: [string, any]) => {
              if (dateConfig.format === 'date' && phaseData[dateKey]) {
                phaseDates.push({
                  name: `${phaseConfig.title || phaseKey} - ${dateConfig.title || dateKey}`,
                  value: phaseData[dateKey],
                  key: `${phaseKey}.${dateKey}`,
                });
              }
            },
          );

          if (phaseDates.length > 0) {
            datesByPhase.set(phaseKey, phaseDates);
          }
        }
      },
    );

    // Validate within each phase (start dates before end dates)
    datesByPhase.forEach((dates) => {
      for (let i = 0; i < dates.length - 1; i++) {
        const currentDate = dates[i];
        const nextDate = dates[i + 1];

        if (currentDate && nextDate) {
          const current = new Date(currentDate.value);
          const next = new Date(nextDate.value);

          if (current >= next) {
            console.log(
              'ERROR',
              `${currentDate.name} must be before ${nextDate.name}`,
            );
            errors.push(`${currentDate.name} must be before ${nextDate.name}`);
          }
        }
      }
    });

    // Validate across phases (later phases should not start before earlier phases end)
    for (let i = 0; i < phaseOrder.length - 1; i++) {
      const currentPhaseKey = phaseOrder[i];
      const nextPhaseKey = phaseOrder[i + 1];

      if (!currentPhaseKey || !nextPhaseKey) continue;

      const currentPhaseDates = datesByPhase.get(currentPhaseKey) || [];
      const nextPhaseDates = datesByPhase.get(nextPhaseKey) || [];

      if (currentPhaseDates.length > 0 && nextPhaseDates.length > 0) {
        // Get the latest date from current phase
        const currentPhaseEnd = currentPhaseDates.reduce((latest, date) => {
          const dateValue = new Date(date.value);
          const latestValue = new Date(latest.value);
          return dateValue > latestValue ? date : latest;
        });

        // Get the earliest date from next phase
        const nextPhaseStart = nextPhaseDates.reduce((earliest, date) => {
          const dateValue = new Date(date.value);
          const earliestValue = new Date(earliest.value);
          return dateValue < earliestValue ? date : earliest;
        });

        if (new Date(currentPhaseEnd.value) >= new Date(nextPhaseStart.value)) {
          errors.push(
            `${nextPhaseStart.name} must be after ${currentPhaseEnd.name}`,
          );
        }
      }
    }

    return errors;
  };

  // Extract validation logic to avoid duplication
  const validateCurrentStep = (): ValidationResult => {
    // If we're on the final review step, always consider it valid
    if (currentStep === stepSchemas.length + 1) {
      return { isValid: true, errors: {} };
    }

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

    // Process JSON Schema validation errors using extracted function
    const fieldErrors = processValidationErrors(result.errors || []);

    // Add custom phase sequence validation for step 2
    const phaseErrors = validatePhaseSequence();
    if (phaseErrors.length > 0) {
      // Add phase sequence errors to the form-level errors
      fieldErrors['_phases'] = { __errors: phaseErrors };
    }

    const hasErrors = Object.keys(fieldErrors).length > 0;
    return { isValid: !hasErrors, errors: fieldErrors };
  };

  const validateStep = (step: number, showErrors = false): boolean => {
    const validation = validateCurrentStep();

    if (!validation.isValid) {
      console.log('Live validation errors', validation.errors);
      const errors = Object.values(validation.errors).reduce((accum, val) => {
        if (val && val.__errors) {
          return [...accum, ...(val.__errors as string[])];
        }
        return accum;
      }, [] as string[]);

      // Only show static errors if not already in live validation mode
      if (showErrors && validationModes[step] !== 'live') {
        setStepValidation(step, 'static', validation.errors);
        toast.error({
          message: errors.join(', '),
        });
      } else {
        console.log('Live validation errors', validation.errors);
        toast.error({
          message: errors.join(', '),
        });
      }
    }

    return validation.isValid;
  };

  const handleNext = (): boolean => {
    const isValid = validateStep(currentStep, true);

    if (isValid) {
      // Clear validation state when moving forward successfully
      clearStep(currentStep);
      setCurrentStep((prev) => prev + 1);
    }

    return isValid;
  };

  const handlePrevious = (): void => {
    // Clear validation state when going back
    clearStep(currentStep);
    setCurrentStep((prev) => prev - 1);
  };

  const handleFinish = (): void => {
    const isValid = validateStep(currentStep, true);

    if (!isValid) {
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

  const handleChange = (data: { formData?: Record<string, unknown> }) => {
    if (data.formData) {
      // Optimized performance: use functional update to avoid recreating entire object
      setFormData((prev) => ({ ...prev, ...data.formData }));
    }

    // Transition from static to live validation on first change after validation failure
    if (validationModes[currentStep] === 'static') {
      setStepValidation(currentStep, 'live', {});
    }
  };

  const handleError = (_errors: RJSFValidationError[]) => {
    // Handle live validation errors from RJSF
    // These are automatically displayed by RJSF when liveValidate is enabled
  };

  const renderStepContent = () => {
    // If we're on the final review step (step 6 when there are 5 schema steps)
    if (currentStep === stepSchemas.length + 1) {
      return (
        <div className="flex flex-col gap-6">
          <p className="text-base text-neutral-charcoal">
            Confirm your settings before creating the process.
          </p>
          <CustomWidgets.ReviewSummary
            id="review-summary"
            name="summary"
            label=""
            formData={formData}
            formContext={{ formData }}
            schema={{}}
            uiSchema={{}}
            value={{}}
            onChange={() => {}}
            onBlur={() => {}}
            onFocus={() => {}}
            options={{}}
            required={false}
            registry={{} as any}
          />
        </div>
      );
    }
    // Convert 1-based to 0-based for array access
    const stepConfig = stepSchemas[currentStep - 1];
    if (!stepConfig) return null;

    const validationMode = validationModes[currentStep] || 'none';
    const currentExtraErrors = stepErrors[currentStep] || {};
    const currentLiveValidate = validationMode === 'live';

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
            uiSchema={stepConfig.uiSchema as any}
            formData={formData}
            formContext={{ formData }}
            onChange={handleChange}
            onError={handleError}
            validator={validator as any}
            widgets={CustomWidgets}
            templates={CustomTemplates}
            showErrorList={false}
            liveValidate={currentLiveValidate}
            noHtml5Validate
            omitExtraData
            extraErrors={currentExtraErrors}
          >
            {/* Hide submit button - we'll use our own stepper */}
            <div style={{ display: 'none' }} />
          </Form>
        </ErrorBoundary>
      </div>
    );
  };

  const getCurrentStepTitle = () => {
    // If we're on the final review step (step 6 when there are 5 schema steps)
    if (currentStep === stepSchemas.length + 1) {
      return 'Review and launch';
    }

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
