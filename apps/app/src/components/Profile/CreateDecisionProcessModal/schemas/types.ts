import { RJSFSchema } from '@rjsf/utils';

// Extend RJSFSchema to support ajv-errors errorMessage property
// This type allows errorMessage on the schema and all nested properties
export type SchemaWithErrorMessage = RJSFSchema & {
  errorMessage?: {
    [key: string]: string;
  };
  properties?: {
    [key: string]: RJSFSchema & {
      errorMessage?: {
        [key: string]: string;
      };
    };
  };
};
