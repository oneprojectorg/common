'use client';

// TODO: This file is a prototype of a dynamic form for decision-making. There is lots to cleanup here in terms of structure and reusability.
// We'll continue to iterate on this but one can consider this part of the code as being in "beta"
//
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import {
  type ProcessInstance,
  transformFormDataToInstanceData,
  transformInstanceDataToFormData,
  validatePhaseSequence,
} from '@/utils/decisionProcessTransforms';
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
import { useContext, useEffect, useState } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';

import ErrorBoundary from '../../ErrorBoundary';
import { CustomTemplates } from '../CreateDecisionProcessModal/CustomTemplates';
import { CustomWidgets } from '../CreateDecisionProcessModal/CustomWidgets';
import {
  type SchemaType,
  loadSchema,
} from '../CreateDecisionProcessModal/schemas/schemaLoader';

interface EditDecisionProcessModalProps {
  instance?: ProcessInstance;
  schema?: SchemaType;
}

interface FormValidationErrors {
  [field: string]: string[];
}

interface IChangeEvent {
  formData?: Record<string, unknown>;
}

export const EditDecisionProcessModal = ({
  instance,
  schema = 'simple',
}: EditDecisionProcessModalProps) => {
  const utils = trpc.useUtils();

  // Load the appropriate schema based on the prop
  const { stepSchemas, schemaDefaults, transformFormDataToProcessSchema } =
    loadSchema(schema);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, unknown>>(
    instance
      ? transformInstanceDataToFormData(instance, schemaDefaults)
      : schemaDefaults,
  );
  const [errors, setErrors] = useState<
    Record<number, FormValidationErrors | null>
  >({});

  const isOnline = useConnectionStatus();
  const isEditing = !!instance;

  // Get the dialog close function from React Aria Components context
  const overlayTriggerState = useContext(OverlayTriggerStateContext);
  const { onClose } = useContext(ModalContext);

  useEffect(() => {
    if (instance) {
      setFormData(transformInstanceDataToFormData(instance, schemaDefaults));
    }
  }, [instance, schemaDefaults]);

  // tRPC mutations for creating process and instance
  const createProcess = trpc.decision.createProcess.useMutation({
    onSuccess: (process) => {
      // After process is created, create an instance
      createInstance.mutate({
        processId: process.id,
        name: formData.processName as string,
        description: formData.description as string,
        instanceData: transformFormDataToInstanceData(formData, schema),
      });
    },
    onError: (error) => {
      handleCreateError(
        error,
        isEditing
          ? 'Failed to update decision process'
          : 'Failed to create decision process template',
      );
    },
  });

  const createInstance = trpc.decision.createInstance.useMutation({
    onSuccess: (instance) => {
      toast.success({
        title: isEditing
          ? 'Decision process updated successfully!'
          : 'Decision process created successfully!',
        message: `"${instance.name}" is now ready for proposals.`,
      });

      // Invalidate the lists to refresh the UI
      utils.decision.listProcesses.invalidate();
      utils.decision.listInstances.invalidate();

      // Close the modal after successful creation
      if (overlayTriggerState?.close) {
        overlayTriggerState.close();
      } else {
        onClose?.();
      }
    },
    onError: (error) => {
      handleCreateError(
        error,
        isEditing
          ? 'Failed to update decision process'
          : 'Failed to create decision process instance',
      );
    },
  });

  const updateInstance = trpc.decision.updateInstance.useMutation({
    onSuccess: (updatedInstance) => {
      toast.success({
        title: 'Decision process updated successfully!',
        message: `"${updatedInstance.name}" has been updated.`,
      });

      // Invalidate the lists to refresh the UI
      utils.decision.listInstances.invalidate();

      // Close the modal after successful update
      if (overlayTriggerState?.close) {
        overlayTriggerState.close();
      } else {
        onClose?.();
      }
    },
    onError: (error) => {
      handleCreateError(error, 'Failed to update decision process');
    },
  });

  const totalSteps = stepSchemas.length;

  const handleCreateError = (error: unknown, title: string) => {
    console.error(title + ':', error);

    const errorInfo = analyzeError(error);

    if (errorInfo.isConnectionError) {
      toast.error({
        title: 'Connection issue',
        message: errorInfo.message + ' Please try again.',
      });
    } else {
      toast.error({
        title,
        message: errorInfo.message,
      });
    }
  };

  // Validate date ordering for step 2 (phases)
  const validatePhaseSequenceForStep = (): string[] => {
    if (currentStep !== 2) {
      return [];
    }
    return validatePhaseSequence(formData);
  };

  // Extract validation logic to avoid duplication
  const validateCurrentStep = (): {
    isValid: boolean;
    errors: FormValidationErrors;
  } => {
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

    const fieldErrors: FormValidationErrors = {};

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
    const phaseErrors = validatePhaseSequenceForStep();
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
    if (
      createProcess.isPending ||
      createInstance.isPending ||
      updateInstance.isPending
    ) {
      return;
    }

    if (isEditing && instance) {
      // Update existing instance
      updateInstance.mutate({
        instanceId: instance.id,
        name: formData.processName as string,
        description: formData.description as string,
        instanceData: transformFormDataToInstanceData(formData, schema),
      });
    } else {
      // Transform and submit form data for new process
      const processSchema = transformFormDataToProcessSchema(formData);

      createProcess.mutate({
        name: formData.processName as string,
        description: formData.description as string,
        processSchema,
      });
    }
  };

  const handleChange = (data: IChangeEvent) => {
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
      <div className="gap-6 flex flex-col">
        {stepConfig.schema.description && (
          <p className="text-base text-neutral-charcoal">
            {stepConfig.schema.description}
          </p>
        )}

        <ErrorBoundary
          fallback={
            <div className="border-functional-orange/20 bg-functional-orange/5 gap-4 p-6 flex flex-col items-center rounded-lg border border-functional-orange/20 text-center">
              <div className="gap-2 flex flex-col">
                <h3 className="text-functional-orange font-medium text-lg">
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
            schema={stepConfig.schema as any}
            uiSchema={stepConfig.uiSchema as any}
            formData={formData}
            onChange={handleChange}
            onError={handleError}
            validator={validator as any}
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
    return (
      stepConfig?.schema.title ||
      (isEditing
        ? 'Edit your decision-making process'
        : 'Set up your decision-making process')
    );
  };

  return (
    <Modal isDismissable>
      <div className="max-w-lg flex h-full max-h-[90vh] w-full flex-col">
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
