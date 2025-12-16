import { z } from 'zod';

export interface DecisionProcessSchema {
  allowProposals: boolean;
  allowDecisions: boolean;
  instanceData: {
    maxVotesPerElector: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const DecisionProcessSchemaBase = z
  .object({
    allowProposals: z.boolean(),
    allowDecisions: z.boolean(),
    instanceData: z
      .object({
        maxVotesPerElector: z.int().min(0),
      })
      .and(z.record(z.string(), z.unknown())),
  })
  .and(z.record(z.string(), z.unknown()));

export interface VotingConfig {
  allowProposals: boolean;
  allowDecisions: boolean;
  maxVotesPerElector: number;
  schemaType: string;
  additionalConfig?: Record<string, unknown>;
}

export interface ProposalConfig {
  requiredFields: string[];
  optionalFields: string[];
  fieldConstraints: Record<
    string,
    {
      type: string;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      enum?: string[];
    }
  >;
  schemaType: string;
  allowProposals: boolean;
}

export interface SchemaValidationResult {
  isValid: boolean;
  schemaType: string;
  errors: string[];
  supportedProperties: string[];
}

export interface VoteSubmissionData {
  id: string;
  decisionProcessId: string;
  userId: string;
  selectedProposalIds: string[];
  createdAt: Date;
  signature: string;
  schemaVersion: string;
  schemaType: string;
}

export interface VotingProposalData {
  id: string;
  decisionProcessId: string;
  title: string;
  description: string;
  submitterId: string;
  submitterName: string;
  amount?: number;
  category?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  schemaSpecificData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  schemaType: string;
  isVotable: boolean;
}

export type SchemaType = 'simple' | 'advanced' | string;
