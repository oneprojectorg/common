import { parseAsInteger, parseAsStringLiteral } from 'nuqs';

export const proposalEditorAsideValues = ['versions'] as const;

export type ProposalEditorAside = (typeof proposalEditorAsideValues)[number];

export const proposalEditorAsideParser = parseAsStringLiteral(
  proposalEditorAsideValues,
);

export const proposalEditorVersionIdParser = parseAsInteger;
