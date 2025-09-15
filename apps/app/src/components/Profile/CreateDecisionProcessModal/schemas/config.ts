import { RJSFSchema, UiSchema } from '@rjsf/utils';

import * as horizonSchema from './horizon';
import * as simpleSchema from './simple';

export type SchemaType = 'horizon' | 'simple';

export interface SchemaConfig {
  stepSchemas: { schema: RJSFSchema; uiSchema: UiSchema }[];
  schemaDefaults: Record<string, unknown>;
  transformFormDataToProcessSchema: (data: Record<string, unknown>) => any;
}

const schemaConfigs: Record<SchemaType, SchemaConfig> = {
  horizon: {
    stepSchemas: horizonSchema.stepSchemas,
    schemaDefaults: horizonSchema.schemaDefaults,
    transformFormDataToProcessSchema:
      horizonSchema.transformFormDataToProcessSchema,
  },
  simple: {
    stepSchemas: simpleSchema.stepSchemas,
    schemaDefaults: simpleSchema.schemaDefaults,
    transformFormDataToProcessSchema:
      simpleSchema.transformFormDataToProcessSchema,
  },
};

export function getSchemaConfig(
  schemaType: SchemaType = 'horizon',
): SchemaConfig {
  return schemaConfigs[schemaType];
}

export function getAvailableSchemaTypes(): SchemaType[] {
  return Object.keys(schemaConfigs) as SchemaType[];
}
