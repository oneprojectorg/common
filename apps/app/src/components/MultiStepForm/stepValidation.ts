import { ZodSchema } from 'zod';

/**
 * Finds the first invalid step before the target step
 * @param currentValues - Array of step values to validate
 * @param targetStep - The step the user is trying to access
 * @param schemas - Array of Zod schemas for validation
 * @returns Index of first invalid step, or -1 if all previous steps are valid
 */
export function findFirstInvalidStepBefore(
  currentValues: any[],
  targetStep: number,
  schemas: ZodSchema<any>[]
): number {
  // Only validate steps before the target step
  for (let i = 0; i < Math.min(targetStep, schemas.length); i++) {
    const schema = schemas[i];
    const value = currentValues[i];

    if (!schema) {
      continue;
    }

    // Check if value exists and validate it
    if (value !== undefined && value !== null) {
      const result = schema.safeParse(value);

      if (!result.success) {
        return i;
      }
    } else {
      // No value exists - this step hasn't been completed yet
      // This is only invalid if the user is trying to skip to a later step
      return i;
    }
  }
  return -1; // All previous steps are valid
}

/**
 * Validates if a user can access a specific step based on previous step completion
 * @param currentValues - Array of step values to validate
 * @param targetStep - The step the user is trying to access
 * @param schemas - Array of Zod schemas for validation
 * @returns Object with isValid boolean and firstInvalidStep number
 */
export function validateStepAccess(
  currentValues: any[],
  targetStep: number,
  schemas: ZodSchema<any>[]
): { isValid: boolean; firstInvalidStep: number } {
  const firstInvalidStep = findFirstInvalidStepBefore(currentValues, targetStep, schemas);
  
  return {
    isValid: firstInvalidStep === -1,
    firstInvalidStep: firstInvalidStep === -1 ? targetStep : firstInvalidStep,
  };
}