import { type AmountUnit, getUnitLabel, toFixedPointUnits } from './budgetUnit';
import {
  DecisionProcessSchema,
  DecisionProcessSchemaBase,
  ProposalConfig,
  SchemaValidationResult,
  VotingConfig,
} from './schemaTypes';
import { type ProposalCosts, sumSelectedCost } from './voteBudget';

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

/**
 * Checks a ballot against the phase's per-voter budget (ADR 0006).
 *
 * Independent of `validateVoteSelection`'s count cap — either may apply, both
 * may apply, and the caller reports whatever both produced. `totalCost` comes
 * back either way so the submission can snapshot what was enforced.
 */
export function validateVoteBudget(
  selectedProposalIds: string[],
  voterBudget: number | undefined,
  costs: ProposalCosts,
  unit: AmountUnit,
): {
  isValid: boolean;
  errors: string[];
  totalCost: number;
} {
  const totalCost = sumSelectedCost(selectedProposalIds, costs, unit);

  if (voterBudget === undefined) {
    return { isValid: true, errors: [], totalCost };
  }

  // Fixed point on both sides: a ballot that exactly meets its budget must
  // pass, and float addition alone does not guarantee that.
  if (toFixedPointUnits(totalCost) <= toFixedPointUnits(voterBudget)) {
    return { isValid: true, errors: [], totalCost };
  }

  const unitLabel = getUnitLabel(unit);

  return {
    isValid: false,
    errors: [
      `Selected proposals total ${totalCost} ${unitLabel}, exceeding the voter budget of ${voterBudget} ${unitLabel}.`,
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
