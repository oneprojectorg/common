/**
 * Runtime schema processing for voting configuration.
 *
 * This extracts voting config from process instance data at runtime.
 * For RJSF form schemas, see ./voting-schemas/
 */

import type {
  DecisionProcessSchema,
  ProposalConfig,
  SchemaType,
  SchemaValidationResult,
  VotingConfig,
} from './schemaTypes';
import {
  extractProposalConfig,
  extractVotingConfig,
  isValidDecisionProcessSchema,
  validateSchemaWithZod,
} from './schemaValidators';

export interface SchemaHandler<
  T extends DecisionProcessSchema = DecisionProcessSchema,
> {
  schemaType: SchemaType;
  validate: (data: unknown) => data is T;
  extractVotingConfig: (data: T) => VotingConfig;
  extractProposalConfig: (data: T) => ProposalConfig;
  validateSchema: (data: unknown) => SchemaValidationResult;
}

/**
 * Process schema data and extract voting configuration.
 */
export function processDecisionProcessSchema(data: unknown): {
  schemaType: string;
  isValid: boolean;
  votingConfig?: VotingConfig;
  proposalConfig?: ProposalConfig;
  validationResult: SchemaValidationResult;
} {
  if (!isValidSchemaData(data)) {
    return {
      schemaType: 'invalid',
      isValid: false,
      validationResult: {
        isValid: false,
        schemaType: 'invalid',
        errors: ['Invalid schema data'],
        supportedProperties: [],
      },
    };
  }

  const schemaType = data.schemaType || 'simple';

  return {
    schemaType,
    isValid: true,
    votingConfig: {
      allowProposals: data.allowProposals,
      allowDecisions: data.allowDecisions,
      maxVotesPerElector: data.instanceData.maxVotesPerElector,
      schemaType,
    },
    proposalConfig: {
      requiredFields: ['title', 'description'],
      optionalFields: ['amount', 'category'],
      fieldConstraints: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', minLength: 1, maxLength: 5000 },
        amount: { type: 'number', min: 0 },
      },
      schemaType,
      allowProposals: data.allowProposals,
    },
    validationResult: {
      isValid: true,
      schemaType,
      errors: [],
      supportedProperties: ['allowProposals', 'allowDecisions', 'instanceData'],
    },
  };
}

/**
 * @deprecated Use VotingSchemaRegistry from './voting-schemas' instead
 */
export class SchemaRegistry {
  private handlers = new Map<string, SchemaHandler>();
  private defaultHandler: SchemaHandler;

  constructor() {
    this.defaultHandler = this.createDefaultHandler();
    this.registerHandler(this.defaultHandler);
  }

  registerHandler<T extends DecisionProcessSchema>(
    handler: SchemaHandler<T>,
  ): void {
    this.handlers.set(handler.schemaType, handler as unknown as SchemaHandler);
  }

  getHandler(schemaType: string): SchemaHandler | null {
    return this.handlers.get(schemaType) || null;
  }

  getHandlerOrDefault(schemaType: string): SchemaHandler {
    return this.handlers.get(schemaType) || this.defaultHandler;
  }

  getAllSchemaTypes(): string[] {
    return votingSchemaRegistry.getAllSchemaTypes();
  }

  detectSchemaType(data: unknown): string {
    return votingSchemaRegistry.detectSchemaType(data);
  }

  processSchema(data: unknown): {
    schemaType: string;
    isValid: boolean;
    votingConfig?: VotingConfig;
    proposalConfig?: ProposalConfig;
    validationResult: SchemaValidationResult;
  } {
    return toOldFormat(processVotingSchema(data));
  }

  /**
   * @deprecated Use registerVotingSchema() with a VotingSchemaDefinition instead
   */
  registerHandler<T extends DecisionProcessSchema>(
    _handler: SchemaHandler<T>,
  ): void {
    console.warn(
      'SchemaRegistry.registerHandler() is deprecated. Use registerVotingSchema() with a JSON schema definition instead.',
    );
  }

  /**
   * @deprecated
   */
  getHandler(_schemaType: string): SchemaHandler | null {
    console.warn(
      'SchemaRegistry.getHandler() is deprecated. Use votingSchemaRegistry.getSchema() instead.',
    );
    return null;
  }

  /**
   * @deprecated
   */
  getHandlerOrDefault(_schemaType: string): SchemaHandler {
    console.warn(
      'SchemaRegistry.getHandlerOrDefault() is deprecated. Use votingSchemaRegistry.getSchemaOrDefault() instead.',
    );
    // Return a minimal handler that won't break existing code
    return {
      schemaType: 'default',
      validate: isValidDecisionProcessSchema,
      extractVotingConfig: (data: DecisionProcessSchema) =>
        extractVotingConfig(data, 'default'),
      extractProposalConfig: (data: DecisionProcessSchema) =>
        extractProposalConfig(data, 'default'),
      validateSchema: validateSchemaWithZod,
    };
  }
}

export const simpleSchemaHandler: SchemaHandler = {
  schemaType: 'simple',
  validate: (data: unknown): data is DecisionProcessSchema => {
    if (!isValidDecisionProcessSchema(data)) {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return typeof obj.schemaType === 'string' && obj.schemaType === 'simple';
  },
  extractVotingConfig: (data: DecisionProcessSchema) =>
    extractVotingConfig(data, 'simple'),
  extractProposalConfig: (data: DecisionProcessSchema) =>
    extractProposalConfig(data, 'simple'),
  validateSchema: validateSchemaWithZod,
};

export const advancedSchemaHandler: SchemaHandler = {
  schemaType: 'advanced',
  validate: (data: unknown): data is DecisionProcessSchema => {
    if (!isValidDecisionProcessSchema(data)) {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return typeof obj.schemaType === 'string' && obj.schemaType === 'advanced';
  },
  extractVotingConfig: (data: DecisionProcessSchema) => {
    const baseConfig = extractVotingConfig(data, 'advanced');

    if (
      data.advancedVotingConfig &&
      typeof data.advancedVotingConfig === 'object'
    ) {
      const advancedConfig = data.advancedVotingConfig as Record<
        string,
        unknown
      >;
      baseConfig.additionalConfig = {
        ...baseConfig.additionalConfig,
        ...advancedConfig,
      };
    }

    return baseConfig;
  },
  extractProposalConfig: (data: DecisionProcessSchema) => {
    const baseConfig = extractProposalConfig(data, 'advanced');

    if (
      data.advancedProposalConfig &&
      typeof data.advancedProposalConfig === 'object'
    ) {
      const advancedConfig = data.advancedProposalConfig as any;

      if (Array.isArray(advancedConfig.requiredFields)) {
        baseConfig.requiredFields = [
          ...new Set([
            ...baseConfig.requiredFields,
            ...advancedConfig.requiredFields,
          ]),
        ];
      }

      if (Array.isArray(advancedConfig.optionalFields)) {
        baseConfig.optionalFields = [
          ...new Set([
            ...baseConfig.optionalFields,
            ...advancedConfig.optionalFields,
          ]),
        ];
      }

      if (typeof advancedConfig.fieldConstraints === 'object') {
        baseConfig.fieldConstraints = {
          ...baseConfig.fieldConstraints,
          ...advancedConfig.fieldConstraints,
        };
      }
    }

    return baseConfig;
  },
  validateSchema: validateSchemaWithZod,
};

export const globalSchemaRegistry = new SchemaRegistry();

/**
 * @deprecated Use votingSchemaRegistry from './voting-schemas' instead
 */
export function getSchemaRegistry(): SchemaRegistry {
  return globalSchemaRegistry;
}

export function registerCustomSchema<T extends DecisionProcessSchema>(
  handler: SchemaHandler<T>,
): void {
  globalSchemaRegistry.registerHandler(handler);
}

/**
 * Process a decision process schema.
 * This is the main entry point - delegates to the JSON-based system.
 */
export function processDecisionProcessSchema(data: unknown) {
  return globalSchemaRegistry.processSchema(data);
}
