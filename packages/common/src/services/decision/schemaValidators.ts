import {
  DecisionProcessSchema,
  DecisionProcessSchemaBase,
  ProposalConfig,
  SchemaValidationResult,
  VotingConfig,
} from './schemaTypes';

export function isValidDecisionProcessSchema(
  data: unknown,
): data is DecisionProcessSchema {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'allowProposals' in obj &&
    typeof obj.allowProposals === 'boolean' &&
    'allowDecisions' in obj &&
    typeof obj.allowDecisions === 'boolean' &&
    'instanceData' in obj &&
    typeof obj.instanceData === 'object' &&
    obj.instanceData !== null &&
    typeof (obj.instanceData as Record<string, unknown>).maxVotesPerMember ===
      'number' &&
    Number.isInteger(
      (obj.instanceData as Record<string, unknown>).maxVotesPerMember,
    ) &&
    ((obj.instanceData as Record<string, unknown>)
      .maxVotesPerMember as number) >= 0
  );
}

export function validateSchemaWithZod(data: unknown): SchemaValidationResult {
  try {
    const result = DecisionProcessSchemaBase.parse(data);

    return {
      isValid: true,
      schemaType:
        typeof data === 'object' && data !== null && 'schemaType' in data
          ? String((data as any).schemaType)
          : 'unknown',
      errors: [],
      supportedProperties: extractSupportedProperties(result),
    };
  } catch (error) {
    return {
      isValid: false,
      schemaType: 'invalid',
      errors: [
        error instanceof Error ? error.message : 'Unknown validation error',
      ],
      supportedProperties: [],
    };
  }
}

export function extractVotingConfig(
  schema: DecisionProcessSchema,
  schemaType: string = 'unknown',
): VotingConfig {
  const baseConfig: VotingConfig = {
    allowProposals: schema.allowProposals,
    allowDecisions: schema.allowDecisions,
    maxVotesPerElector: schema.instanceData.maxVotesPerElector,
    schemaType,
  };

  const additionalConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!['allowProposals', 'allowDecisions', 'instanceData'].includes(key)) {
      additionalConfig[key] = value;
    }
  }

  if (Object.keys(additionalConfig).length > 0) {
    baseConfig.additionalConfig = additionalConfig;
  }

  return baseConfig;
}

export function extractProposalConfig(
  schema: DecisionProcessSchema,
  schemaType: string = 'unknown',
): ProposalConfig {
  const baseConfig: ProposalConfig = {
    requiredFields: ['title', 'description'],
    optionalFields: ['amount', 'category', 'schemaSpecificData'],
    fieldConstraints: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
      },
      description: {
        type: 'string',
        minLength: 1,
        maxLength: 5000,
      },
      amount: {
        type: 'number',
        min: 0,
      },
      category: {
        type: 'string',
      },
    },
    schemaType,
    allowProposals: schema.allowProposals,
  };

  if (schema.proposalConfig && typeof schema.proposalConfig === 'object') {
    const proposalConfig = schema.proposalConfig as any;

    if (Array.isArray(proposalConfig.requiredFields)) {
      baseConfig.requiredFields = [
        ...baseConfig.requiredFields,
        ...proposalConfig.requiredFields,
      ];
    }

    if (Array.isArray(proposalConfig.optionalFields)) {
      baseConfig.optionalFields = [
        ...baseConfig.optionalFields,
        ...proposalConfig.optionalFields,
      ];
    }

    if (typeof proposalConfig.fieldConstraints === 'object') {
      baseConfig.fieldConstraints = {
        ...baseConfig.fieldConstraints,
        ...proposalConfig.fieldConstraints,
      };
    }
  }

  return baseConfig;
}

export function extractSupportedProperties(
  schema: DecisionProcessSchema,
): string[] {
  const baseProperties = ['allowProposals', 'allowDecisions', 'instanceData'];
  const additionalProperties = Object.keys(schema).filter(
    (key) => !baseProperties.includes(key),
  );

  return [...baseProperties, ...additionalProperties];
}

export function validateVoteSelection(
  selectedProposalIds: string[],
  maxVotesPerMember: number,
  availableProposalIds: string[],
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (selectedProposalIds.length === 0) {
    errors.push('At least one proposal must be selected');
  }

  if (selectedProposalIds.length > maxVotesPerElector) {
    errors.push(`Cannot select more than ${maxVotesPerElector} proposals`);
  }

  const invalidProposals = selectedProposalIds.filter(
    (id) => !availableProposalIds.includes(id),
  );
  if (invalidProposals.length > 0) {
    errors.push(`Invalid proposal IDs: ${invalidProposals.join(', ')}`);
  }

  const duplicates = selectedProposalIds.filter(
    (id, index) => selectedProposalIds.indexOf(id) !== index,
  );
  if (duplicates.length > 0) {
    errors.push(`Duplicate proposal IDs: ${duplicates.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function createSchemaSignature(schema: DecisionProcessSchema): string {
  const normalizedSchema = {
    allowProposals: schema.allowProposals,
    allowDecisions: schema.allowDecisions,
    maxVotesPerElector: schema.instanceData.maxVotesPerElector,
  };

  return Buffer.from(JSON.stringify(normalizedSchema)).toString('base64');
}

export function validateSchemaCompatibility(
  currentSchema: DecisionProcessSchema,
  requiredProperties: string[],
): {
  isCompatible: boolean;
  missingProperties: string[];
} {
  const schemaKeys = Object.keys(currentSchema);
  const missingProperties = requiredProperties.filter(
    (prop) => !schemaKeys.includes(prop),
  );

  return {
    isCompatible: missingProperties.length === 0,
    missingProperties,
  };
}
