import type { RJSFSchema, UiSchema } from '@rjsf/utils';

import * as horizonSchema from './horizon';
import * as simpleSchema from './simple';

export type SchemaType = 'simple' | 'horizon';

export interface SchemaExports {
  stepSchemas: { schema: RJSFSchema; uiSchema: UiSchema }[];
  schemaDefaults: Record<string, unknown>;
  transformFormDataToProcessSchema: (data: Record<string, unknown>) => any;
}

export const loadSchema = (schemaType: SchemaType): SchemaExports => {
  if (schemaType === 'horizon') {
    return {
      stepSchemas: horizonSchema.stepSchemas,
      schemaDefaults: horizonSchema.schemaDefaults,
      transformFormDataToProcessSchema: horizonSchema.transformFormDataToProcessSchema,
    };
  }

  return {
    stepSchemas: simpleSchema.stepSchemas,
    schemaDefaults: simpleSchema.schemaDefaults,
    transformFormDataToProcessSchema: simpleSchema.transformFormDataToProcessSchema,
  };
};