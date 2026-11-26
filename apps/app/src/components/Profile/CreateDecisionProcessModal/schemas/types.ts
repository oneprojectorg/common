import type { JSONSchema7 } from 'json-schema';

// Extend JSONSchema7 to support ajv-errors errorMessage property
// This type allows errorMessage on the schema and all nested properties
export type SchemaWithErrorMessage = JSONSchema7 & {
  errorMessage?: {
    [key: string]: string;
  };
  properties?: {
    [key: string]: JSONSchema7 & {
      errorMessage?: {
        [key: string]: string;
      };
    };
  };
};
