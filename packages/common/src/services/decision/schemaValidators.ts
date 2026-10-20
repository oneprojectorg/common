import {
  type AmountUnit,
  formatUnitAmount,
  isAtMost,
  sumAmounts,
} from './fieldUnit';
import type { ProposalCosts } from './getProposalCosts';
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

  if (typeof obj.allowProposals !== 'boolean') {
    return false;
  }
  if (typeof obj.allowDecisions !== 'boolean') {
    return false;
  }
  if (typeof obj.instanceData !== 'object' || obj.instanceData === null) {
    return false;
  }

  const max = (obj.instanceData as Record<string, unknown>).maxVotesPerMember;
  if (max === undefined) {
    return true;
  }
  return typeof max === 'number' && Number.isInteger(max) && max > 0;
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
    maxVotesPerMember: schema.instanceData.maxVotesPerMember,
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

// Missing or unpriceable costs charge nothing so the proposal stays votable.
export function validateVoteBudget(
  selectedProposalIds: string[],
  cap:
    | { voterBudget: number; costs: ProposalCosts; unit: AmountUnit }
    | undefined,
): {
  isValid: boolean;
  errors: string[];
  totalCost: number;
} {
  if (cap === undefined) {
    return { isValid: true, errors: [], totalCost: 0 };
  }

  const totalCost = sumAmounts(
    selectedProposalIds.map((id) => cap.costs.get(id) ?? 0),
  );

  if (isAtMost({ amount: totalCost, limit: cap.voterBudget })) {
    return { isValid: true, errors: [], totalCost };
  }

  const total = formatUnitAmount({ amount: totalCost, unit: cap.unit });
  const budget = formatUnitAmount({ amount: cap.voterBudget, unit: cap.unit });

  return {
    isValid: false,
    errors: [
      `Selected proposals total ${total}, exceeding the voter budget of ${budget}.`,
    ],
    totalCost,
  };
}

export function validateVoteSelection(
  selectedProposalIds: string[],
  maxVotesPerMember: number | undefined,
  availableProposalIds: string[],
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (selectedProposalIds.length === 0) {
    errors.push('At least one proposal must be selected');
  }

  if (
    maxVotesPerMember !== undefined &&
    selectedProposalIds.length > maxVotesPerMember
  ) {
    errors.push(`Cannot select more than ${maxVotesPerMember} proposals`);
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
