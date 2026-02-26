import { defineExtendedPermissions } from 'access-zones';

export const decisionPermissions = defineExtendedPermissions({
  INVITE_MEMBERS: { label: 'Invite Members' },
  REVIEW: { label: 'Review' },
  SUBMIT_PROPOSALS: { label: 'Submit Proposals' },
  VOTE: { label: 'Vote' },
});

// Backward-compat re-exports
export const decisionPermission = decisionPermissions.masks;
export type DecisionRolePermissions = ReturnType<typeof decisionPermissions.fromBitField>;
export const toDecisionBitField = decisionPermissions.toBitField;
export const fromDecisionBitField = decisionPermissions.fromBitField;
export const DECISION_PERMISSION_LABELS: Record<keyof DecisionRolePermissions, string> = {
  ...decisionPermissions.labels,
  admin: 'Manage Process',
};
export const CRUD_BITS_MASK = decisionPermissions.crudBitsMask;
