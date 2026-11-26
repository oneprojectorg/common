import type { SchemaMapping } from '../../../schemaMapping';
import type { ProposalDataInput } from '../proposalDataSchema';

type DevelopPrefillOutcome =
  | 'filled'
  | 'partial'
  | 'refused'
  | 'failed'
  | 'document_failed'
  | 'source_unavailable'
  | 'invalid_mappings'
  | 'no_source_phase';

type DevelopPrefillPartialReason =
  | 'unmatched_mapping'
  | 'value_rejected'
  | 'no_value';

type DevelopPrefillSummaryFields = {
  /** Sorted, comma-joined target fields; `''` when there are none. */
  expectedFields: string;
  unfilledFields: string;
  rejectedFields: string;
  unmatchedMappingCount: number;
};

type DevelopPrefillSummary =
  | ({ outcome: 'filled' } & DevelopPrefillSummaryFields)
  | ({
      outcome: 'partial';
      reason: DevelopPrefillPartialReason;
    } & DevelopPrefillSummaryFields);

const DEVELOP_PREFILL_EVENT = 'develop_prefill';

const SYSTEM_FIELDS = ['title', 'category', 'budget', 'location'] as const;

/** The fixed attributes that every develop prefill log record carries. */
export function getDevelopPrefillLogAttributes(
  outcome: DevelopPrefillOutcome,
): { event: typeof DEVELOP_PREFILL_EVENT; outcome: DevelopPrefillOutcome } {
  return { event: DEVELOP_PREFILL_EVENT, outcome };
}

/** What one prefill run filled, and why any expected field stayed empty. */
export function getDevelopPrefillSummary({
  mappings,
  sourcePhaseId,
  developPhaseId,
  data,
  proposalData,
}: {
  mappings: SchemaMapping[];
  sourcePhaseId: string;
  developPhaseId: string;
  /** The mapped data, before the system field normalizers. */
  data: Record<string, unknown>;
  /** The system fields after the normalizers. */
  proposalData: ProposalDataInput;
}): DevelopPrefillSummary {
  const targetsDevelopPhase = (mapping: SchemaMapping) =>
    mapping.to.type === 'proposal' && mapping.to.phaseId === developPhaseId;

  const expected = new Set(
    mappings
      .filter(targetsDevelopPhase)
      .flatMap((mapping) => mapping.fields.map(({ to }) => to)),
  );
  const unfilled = [...expected].filter((field) => !Object.hasOwn(data, field));
  const rejected = SYSTEM_FIELDS.filter(
    (field) =>
      Object.hasOwn(data, field) && !Object.hasOwn(proposalData, field),
  );
  const unmatchedMappingCount = mappings.filter(
    (mapping) =>
      !targetsDevelopPhase(mapping) ||
      (mapping.from.type === 'proposal' &&
        mapping.from.phaseId !== sourcePhaseId),
  ).length;

  const fields = {
    expectedFields: toAttributeList([...expected]),
    unfilledFields: toAttributeList(unfilled),
    rejectedFields: toAttributeList(rejected),
    unmatchedMappingCount,
  };

  if (unmatchedMappingCount > 0) {
    return { outcome: 'partial', reason: 'unmatched_mapping', ...fields };
  }
  if (rejected.length > 0) {
    return { outcome: 'partial', reason: 'value_rejected', ...fields };
  }
  if (unfilled.length > 0) {
    return { outcome: 'partial', reason: 'no_value', ...fields };
  }
  return { outcome: 'filled', ...fields };
}

// The logger JSON-stringifies arrays; a plain string is easier to filter on.
function toAttributeList(fields: readonly string[]): string {
  return [...fields].sort().join(',');
}
