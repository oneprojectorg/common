/**
 * Schema inspection utilities for analyzing RJSF schemas
 * and extracting transformation metadata
 */

import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { PhaseMapping, FieldMapping, TransformationConfig } from './transformationConfig';

export interface SchemaField {
  name: string;
  type: string;
  format?: string;
  title?: string;
  description?: string;
  required?: boolean;
  properties?: Record<string, SchemaField>;
}

export interface PhaseSchemaInfo {
  fieldName: string;
  title: string;
  description?: string;
  dateFields: {
    start?: { name: string; title: string };
    end?: { name: string; title: string };
  };
}

/**
 * Analyze RJSF schema to extract field information
 */
export const analyzeSchema = (schema: RJSFSchema): SchemaField => {
  const analyzeProperties = (props: any): Record<string, SchemaField> => {
    const result: Record<string, SchemaField> = {};
    
    if (props && typeof props === 'object') {
      Object.entries(props).forEach(([key, value]: [string, any]) => {
        result[key] = {
          name: key,
          type: Array.isArray(value.type) ? value.type[0] : (value.type || 'unknown'),
          format: value.format,
          title: value.title,
          description: value.description,
          properties: value.properties ? analyzeProperties(value.properties) : undefined
        };
      });
    }
    
    return result;
  };

  return {
    name: 'root',
    type: Array.isArray(schema.type) ? (schema.type[0] || 'object') : (schema.type || 'object'),
    title: schema.title,
    description: schema.description,
    properties: schema.properties ? analyzeProperties(schema.properties) : undefined
  };
};

/**
 * Extract phase information from schema
 */
export const extractPhaseInfo = (schemas: { schema: RJSFSchema; uiSchema: UiSchema }[]): PhaseSchemaInfo[] => {
  const phases: PhaseSchemaInfo[] = [];
  
  schemas.forEach(({ schema }) => {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([fieldName, fieldSchema]: [string, any]) => {
        // Identify phase objects by looking for objects with date children
        if (fieldSchema.type === 'object' && fieldSchema.properties) {
          const dateFields = Object.entries(fieldSchema.properties).filter(
            ([, prop]: [string, any]) => prop.format === 'date'
          );
          
          if (dateFields.length > 0) {
            const phaseInfo: PhaseSchemaInfo = {
              fieldName,
              title: fieldSchema.title || fieldName,
              description: fieldSchema.description,
              dateFields: {}
            };
            
            // Categorize date fields as start/end based on naming patterns
            dateFields.forEach(([dateName, dateSchema]: [string, any]) => {
              const lowerName = dateName.toLowerCase();
              if (lowerName.includes('open') || lowerName.includes('start')) {
                phaseInfo.dateFields.start = { name: dateName, title: dateSchema.title || dateName };
              } else if (lowerName.includes('close') || lowerName.includes('end')) {
                phaseInfo.dateFields.end = { name: dateName, title: dateSchema.title || dateName };
              } else if (lowerName.includes('date')) {
                // Single date field (like results date)
                phaseInfo.dateFields.start = { name: dateName, title: dateSchema.title || dateName };
              }
            });
            
            phases.push(phaseInfo);
          }
        }
      });
    }
  });
  
  return phases;
};

/**
 * Extract simple field mappings from schema
 */
export const extractFieldMappings = (schemas: { schema: RJSFSchema; uiSchema: UiSchema }[]): FieldMapping[] => {
  const fields: FieldMapping[] = [];
  
  schemas.forEach(({ schema }) => {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([fieldName, fieldSchema]: [string, any]) => {
        // Skip phase objects (they have their own handling)
        if (fieldSchema.type !== 'object') {
          // Determine database path based on field characteristics
          let dbPath: string[];
          let defaultValue: any;
          
          switch (fieldSchema.format) {
            case 'currency':
              dbPath = ['instanceData', 'budget'];
              defaultValue = 0;
              break;
            default:
              // Simple field mapping - needs customization per field
              if (fieldName === 'processName') {
                dbPath = ['name'];
                defaultValue = '';
              } else if (fieldName === 'description') {
                dbPath = ['description'];
                defaultValue = '';
              } else {
                // Default to fieldValues for unknown fields
                dbPath = ['instanceData', 'fieldValues', fieldName];
                defaultValue = fieldSchema.type === 'number' ? 0 : 
                              fieldSchema.type === 'boolean' ? false :
                              fieldSchema.type === 'array' ? [] : '';
              }
          }
          
          fields.push({
            formField: fieldName,
            dbPath,
            defaultValue
          });
        }
      });
    }
  });
  
  return fields;
};

/**
 * Generate phase mappings from schema analysis
 */
export const generatePhaseMappings = (
  phaseInfo: PhaseSchemaInfo[], 
  stateIdMappings?: Record<string, string>
): PhaseMapping[] => {
  return phaseInfo.map((phase, index) => {
    // Generate stateId from field name if not provided
    const stateId = stateIdMappings?.[phase.fieldName] || 
                   phase.fieldName.replace(/Phase$/, '').replace(/([A-Z])/g, (match, _, offset) => 
                     offset > 0 ? match.toLowerCase() : match.toLowerCase()
                   );
    
    const mapping: PhaseMapping = {
      formFieldName: phase.fieldName,
      stateId,
      displayName: phase.title,
      dateFields: {
        start: phase.dateFields.start?.name || '',
        ...(phase.dateFields.end && { end: phase.dateFields.end.name })
      },
      dbFields: {
        start: 'plannedStartDate',
        ...(phase.dateFields.end && { end: 'plannedEndDate' })
      },
      sortOrder: index + 1
    };
    
    return mapping;
  });
};

/**
 * Generate complete transformation configuration from schemas
 */
export const generateTransformationConfig = (
  schemas: { schema: RJSFSchema; uiSchema: UiSchema }[],
  stateIdMappings?: Record<string, string>
): TransformationConfig => {
  const phaseInfo = extractPhaseInfo(schemas);
  const phases = generatePhaseMappings(phaseInfo, stateIdMappings);
  const fields = extractFieldMappings(schemas);
  
  return {
    phases,
    fields
  };
};

/**
 * Merge generated config with defaults/overrides
 */
export const mergeTransformationConfigs = (
  base: TransformationConfig,
  override: Partial<TransformationConfig>
): TransformationConfig => {
  return {
    phases: override.phases || base.phases,
    fields: override.fields || base.fields
  };
};