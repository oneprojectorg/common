import type { InstanceData, ProcessSchema } from '@op/common';

import { schemaDefaults } from '../components/Profile/CreateDecisionProcessModal/schemas/simple';
import { 
  transformInstanceToForm, 
  transformFormToInstance, 
  validateDateSequence 
} from './genericTransforms';
import { DEFAULT_TRANSFORMATION_CONFIG } from './transformationConfig';

// Type definitions for data transformation
export interface ProcessInstance {
  id: string;
  name: string;
  description?: string | null;
  instanceData?: InstanceData;
  process?: {
    id: string;
    name: string;
    description?: string | null;
    processSchema: ProcessSchema;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PhaseConfiguration {
  stateId: string;
  actualStartDate?: string;
  actualEndDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

// Legacy interfaces - kept for backward compatibility
// New code should use the configuration-driven approach

/**
 * Transforms process instance data from the API into form data structure
 * that can be used in the multi-step form
 */
export const transformInstanceDataToFormData = (
  instance: ProcessInstance,
): Record<string, unknown> => {
  return transformInstanceToForm(instance, DEFAULT_TRANSFORMATION_CONFIG, schemaDefaults);
};

/**
 * Transforms form data back into the instance data structure
 * that can be saved to the database
 */
export const transformFormDataToInstanceData = (
  data: Record<string, unknown>,
): InstanceData => {
  return transformFormToInstance(data, DEFAULT_TRANSFORMATION_CONFIG);
};

/**
 * Validates that phase dates are in chronological order
 */
export const validatePhaseSequence = (
  formData: Record<string, unknown>,
): string[] => {
  return validateDateSequence(formData, DEFAULT_TRANSFORMATION_CONFIG);
};
