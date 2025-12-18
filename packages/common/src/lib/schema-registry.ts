import {
  DecisionProcessSchema,
  ProposalConfig,
  SchemaType,
  SchemaValidationResult,
  VotingConfig,
} from '../types/schema';
import {
  extractProposalConfig,
  extractVotingConfig,
  isValidDecisionProcessSchema,
  validateSchemaWithZod,
} from './schema-validators';

export interface SchemaHandler<
  T extends DecisionProcessSchema = DecisionProcessSchema,
> {
  schemaType: SchemaType;
  validate: (data: unknown) => data is T;
  extractVotingConfig: (data: T) => VotingConfig;
  extractProposalConfig: (data: T) => ProposalConfig;
  validateSchema: (data: unknown) => SchemaValidationResult;
}

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
    return Array.from(this.handlers.keys());
  }

  detectSchemaType(data: unknown): string {
    if (typeof data === 'object' && data !== null && 'schemaType' in data) {
      return String((data as any).schemaType);
    }

    for (const [schemaType, handler] of this.handlers) {
      if (handler.validate(data)) {
        return schemaType;
      }
    }

    return 'unknown';
  }

  processSchema(data: unknown): {
    schemaType: string;
    isValid: boolean;
    votingConfig?: VotingConfig;
    proposalConfig?: ProposalConfig;
    validationResult: SchemaValidationResult;
  } {
    const schemaType = this.detectSchemaType(data);
    const handler = this.getHandlerOrDefault(schemaType);

    const validationResult = handler.validateSchema(data);

    if (!validationResult.isValid || !handler.validate(data)) {
      return {
        schemaType,
        isValid: false,
        validationResult,
      };
    }

    const typedData = data as DecisionProcessSchema;

    return {
      schemaType,
      isValid: true,
      votingConfig: handler.extractVotingConfig(typedData),
      proposalConfig: handler.extractProposalConfig(typedData),
      validationResult,
    };
  }

  private createDefaultHandler(): SchemaHandler {
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

globalSchemaRegistry.registerHandler(simpleSchemaHandler);
globalSchemaRegistry.registerHandler(advancedSchemaHandler);

export function getSchemaRegistry(): SchemaRegistry {
  return globalSchemaRegistry;
}

export function registerCustomSchema<T extends DecisionProcessSchema>(
  handler: SchemaHandler<T>,
): void {
  globalSchemaRegistry.registerHandler(handler);
}

export function processDecisionProcessSchema(data: unknown) {
  return globalSchemaRegistry.processSchema(data);
}
