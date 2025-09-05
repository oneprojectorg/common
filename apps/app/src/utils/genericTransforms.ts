/**
 * Generic transformation utilities for mapping between different data structures
 * using configuration-driven approach
 */

import type { InstanceData } from '@op/common';
import { 
  TransformationConfig, 
  PhaseMapping, 
  FieldMapping,
  DEFAULT_TRANSFORMATION_CONFIG,
  getValidationSequence
} from './transformationConfig';
import { ProcessInstance, PhaseConfiguration } from './decisionProcessTransforms';

/**
 * Get nested value from object using path array with safety checks
 */
export const getNestedValue = (obj: any, path: string[]): any => {
  if (!obj || !path || path.length === 0) return undefined;
  
  return path.reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    
    // Prevent prototype pollution access
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    
    return current[key];
  }, obj);
};

/**
 * Set nested value in object using path array with prototype pollution protection
 */
export const setNestedValue = (obj: any, path: string[], value: any): void => {
  if (!obj || !path || path.length === 0) return;
  
  // Validate all path segments for prototype pollution
  for (const key of path) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(`Unsafe property access attempted: ${key}`);
    }
  }
  
  const lastKey = path[path.length - 1];
  const parentPath = path.slice(0, -1);
  
  let current = obj;
  for (const key of parentPath) {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  if (lastKey) {
    current[lastKey] = value;
  }
};

/**
 * Transform simple fields using field mappings with comprehensive validation
 */
export const transformSimpleFields = (
  source: any,
  target: Record<string, unknown>,
  fieldMappings: FieldMapping[],
  direction: 'toForm' | 'fromForm'
): void => {
  if (!source || !target || !fieldMappings || !Array.isArray(fieldMappings)) {
    return;
  }

  fieldMappings.forEach(mapping => {
    if (!mapping || !mapping.formField || !mapping.dbPath) {
      return;
    }

    try {
      if (direction === 'toForm') {
        // Database to form
        const value = getNestedValue(source, mapping.dbPath);
        let transformedValue = value;
        
        if (mapping.reverseTransformer && typeof mapping.reverseTransformer === 'function') {
          transformedValue = mapping.reverseTransformer(value);
        }
        
        target[mapping.formField] = transformedValue ?? mapping.defaultValue;
      } else {
        // Form to database
        const value = source[mapping.formField];
        let transformedValue = value;
        
        if (mapping.transformer && typeof mapping.transformer === 'function') {
          transformedValue = mapping.transformer(value);
        }
        
        setNestedValue(target, mapping.dbPath, transformedValue);
      }
    } catch (error) {
      // Log error but don't fail entire transformation
      console.error(`Field transformation failed for ${mapping.formField}:`, error);
    }
  });
};

/**
 * Extract phase data from database instance with comprehensive validation
 */
export const extractPhasesFromInstance = (
  instance: ProcessInstance,
  phaseMappings: PhaseMapping[]
): Record<string, any> => {
  const phaseData: Record<string, any> = {};
  
  if (!instance || !phaseMappings || !Array.isArray(phaseMappings)) {
    return phaseData;
  }
  
  if (instance.instanceData?.phases && Array.isArray(instance.instanceData.phases)) {
    const phases = instance.instanceData.phases;
    
    phaseMappings.forEach(phaseMapping => {
      if (!phaseMapping || !phaseMapping.stateId || !phaseMapping.formFieldName) {
        return;
      }

      try {
        const phase = phases.find(
          (p: PhaseConfiguration) => p && p.stateId === phaseMapping.stateId
        );
        
        if (phase) {
          const phaseObj: any = {};
          
          // Map start date with validation
          if (phaseMapping.dateFields.start && phaseMapping.dbFields.start) {
            const startDate = phase[phaseMapping.dbFields.start];
            if (startDate && typeof startDate === 'string' && startDate.trim() !== '') {
              phaseObj[phaseMapping.dateFields.start] = startDate;
            }
          }
          
          // Map end date if it exists with validation
          if (phaseMapping.dateFields.end && phaseMapping.dbFields.end) {
            const endDate = phase[phaseMapping.dbFields.end];
            if (endDate && typeof endDate === 'string' && endDate.trim() !== '') {
              phaseObj[phaseMapping.dateFields.end] = endDate;
            }
          }
          
          // Only add phase data if it has at least one date
          if (Object.keys(phaseObj).length > 0) {
            phaseData[phaseMapping.formFieldName] = phaseObj;
          }
        }
      } catch (error) {
        console.error(`Phase extraction failed for ${phaseMapping.stateId}:`, error);
      }
    });
  }
  
  return phaseData;
};

/**
 * Build phase configuration array from form data with safe type handling
 */
export const buildPhasesFromFormData = (
  formData: Record<string, unknown>,
  phaseMappings: PhaseMapping[]
): PhaseConfiguration[] => {
  if (!formData || !phaseMappings || !Array.isArray(phaseMappings)) {
    return [];
  }

  const phases = phaseMappings.map(phaseMapping => {
    if (!phaseMapping || !phaseMapping.stateId || !phaseMapping.formFieldName) {
      return null;
    }

    try {
      const formPhaseData = formData[phaseMapping.formFieldName];
      
      // Safe type checking instead of unsafe casting
      if (!formPhaseData || typeof formPhaseData !== 'object' || Array.isArray(formPhaseData)) {
        return null;
      }

      const phaseData = formPhaseData as Record<string, unknown>;
      
      const phase: PhaseConfiguration = {
        stateId: phaseMapping.stateId
      };
      
      // Map start date with validation
      if (phaseMapping.dateFields.start && phaseMapping.dbFields.start) {
        const startDate = phaseData[phaseMapping.dateFields.start];
        if (typeof startDate === 'string' && startDate.trim() !== '') {
          (phase as any)[phaseMapping.dbFields.start] = startDate;
        }
      }
      
      // Map end date if it exists with validation
      if (phaseMapping.dateFields.end && phaseMapping.dbFields.end) {
        const endDate = phaseData[phaseMapping.dateFields.end];
        if (typeof endDate === 'string' && endDate.trim() !== '') {
          (phase as any)[phaseMapping.dbFields.end] = endDate;
        }
      }
      
      return phase;
    } catch (error) {
      console.error(`Failed to build phase for ${phaseMapping.stateId}:`, error);
      return null;
    }
  }).filter((phase): phase is PhaseConfiguration => {
    // Safe filtering with type predicate
    if (!phase) return false;
    
    // Only include phases that have at least one date set
    return Boolean(
      phase.plannedStartDate || 
      phase.actualStartDate || 
      phase.plannedEndDate || 
      phase.actualEndDate
    );
  });

  return phases;
};

/**
 * Generic transformation from database instance to form data
 */
export const transformInstanceToForm = (
  instance: ProcessInstance,
  config: TransformationConfig = DEFAULT_TRANSFORMATION_CONFIG,
  defaults: Record<string, unknown> = {}
): Record<string, unknown> => {
  const formData: Record<string, unknown> = { ...defaults };
  
  // Transform simple fields
  transformSimpleFields(instance, formData, config.fields, 'toForm');
  
  // Extract and transform phases
  const phaseData = extractPhasesFromInstance(instance, config.phases);
  Object.assign(formData, phaseData);
  
  return formData;
};

/**
 * Generic transformation from form data to database instance data
 */
export const transformFormToInstance = (
  formData: Record<string, unknown>,
  config: TransformationConfig = DEFAULT_TRANSFORMATION_CONFIG
): InstanceData => {
  const instanceData: any = {};
  
  // Transform simple fields
  transformSimpleFields(formData, instanceData, config.fields, 'fromForm');
  
  // Build phases array
  const phases = buildPhasesFromFormData(formData, config.phases);
  instanceData.phases = phases;
  
  // Set default current state to first phase if not specified
  if (!instanceData.currentStateId && config.phases.length > 0) {
    const sortedPhases = config.phases.sort((a, b) => a.sortOrder - b.sortOrder);
    const firstPhase = sortedPhases[0];
    if (firstPhase) {
      instanceData.currentStateId = firstPhase.stateId;
    }
  }
  
  return instanceData as InstanceData;
};

/**
 * Validate that a date string represents a valid date in YYYY-MM-DD format
 */
const isValidDateString = (dateString: string): boolean => {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  const trimmed = dateString.trim();
  if (trimmed === '') {
    return false;
  }
  
  // Check basic YYYY-MM-DD format with regex
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(trimmed)) {
    return false;
  }
  
  // Validate the date is actually valid (not 2023-13-40 etc)
  try {
    const date = new Date(trimmed + 'T00:00:00.000Z'); // Parse as UTC to avoid timezone issues
    if (isNaN(date.getTime())) {
      return false;
    }
    
    // Verify it formats back to the same string
    const formatted = date.toISOString().slice(0, 10);
    return formatted === trimmed;
  } catch {
    return false;
  }
};

/**
 * Generic date validation using configuration with comprehensive error handling
 */
export const validateDateSequence = (
  formData: Record<string, unknown>,
  config: TransformationConfig = DEFAULT_TRANSFORMATION_CONFIG
): string[] => {
  const errors: string[] = [];
  
  if (!formData || !config) {
    return errors;
  }

  try {
    const validationSequence = getValidationSequence(config);
    
    if (!validationSequence || !Array.isArray(validationSequence)) {
      return errors;
    }
    
    // Extract all dates with their metadata and validate each one
    const dates = validationSequence.map(item => {
      if (!item || !item.phase || !item.key || !item.name) {
        return null;
      }

      const formPhaseData = formData[item.phase];
      
      // Safe type checking
      if (!formPhaseData || typeof formPhaseData !== 'object' || Array.isArray(formPhaseData)) {
        return null;
      }

      const phaseData = formPhaseData as Record<string, unknown>;
      const dateValue = phaseData[item.key];
      
      if (typeof dateValue !== 'string' || !dateValue.trim()) {
        return null;
      }

      return {
        name: item.name,
        value: dateValue.trim(),
        key: item.key
      };
    }).filter((dateItem): dateItem is { name: string; value: string; key: string } => {
      return dateItem !== null;
    });
    
    // Validate each date format first
    dates.forEach(dateItem => {
      if (!isValidDateString(dateItem.value)) {
        errors.push(`${dateItem.name} has an invalid date format`);
      }
    });
    
    // Only check chronological order if all dates are valid
    if (errors.length === 0) {
      for (let i = 0; i < dates.length - 1; i++) {
        const currentDate = dates[i];
        const nextDate = dates[i + 1];
        
        if (currentDate?.value && nextDate?.value) {
          const current = new Date(currentDate.value);
          const next = new Date(nextDate.value);
          
          if (current >= next) {
            errors.push(`${currentDate.name} must be before ${nextDate.name}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Date validation error:', error);
    errors.push('An error occurred while validating dates');
  }
  
  return errors;
};

/**
 * Create a customized transformation configuration
 */
export const createCustomTransformConfig = (
  baseConfig: TransformationConfig,
  overrides: {
    phaseStateIdMappings?: Record<string, string>;
    additionalFields?: FieldMapping[];
    phaseDbFieldOverrides?: Record<string, { start?: string; end?: string }>;
  }
): TransformationConfig => {
  let phases = baseConfig.phases;
  
  // Apply state ID mappings
  if (overrides.phaseStateIdMappings) {
    phases = phases.map(phase => ({
      ...phase,
      stateId: overrides.phaseStateIdMappings![phase.formFieldName] || phase.stateId
    }));
  }
  
  // Apply phase field overrides
  if (overrides.phaseDbFieldOverrides) {
    phases = phases.map(phase => {
      const override = overrides.phaseDbFieldOverrides![phase.stateId];
      if (override) {
        return {
          ...phase,
          dbFields: {
            start: (override.start as any) || phase.dbFields.start,
            ...(override.end && { end: (override.end as any) || phase.dbFields.end })
          }
        };
      }
      return phase;
    });
  }
  
  // Add additional fields
  const fields = overrides.additionalFields ? 
                 [...baseConfig.fields, ...overrides.additionalFields] :
                 baseConfig.fields;
  
  return {
    phases,
    fields
  };
};