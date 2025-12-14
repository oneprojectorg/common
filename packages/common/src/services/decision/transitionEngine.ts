import { db, eq } from '@op/db/client';
import {
  decisions,
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertProcessInstanceWithProcess, assertUser } from '../assert';
import type {
  InstanceData,
  ProcessSchema,
  TransitionCondition,
  TransitionDefinition,
} from './types';

export interface TransitionCheckResult {
  canTransition: boolean;
  availableTransitions: Array<{
    toStateId: string;
    transitionName: string;
    canExecute: boolean;
    failedRules: Array<{
      ruleId: string;
      errorMessage: string;
    }>;
  }>;
}

export interface ExecuteTransitionInput {
  instanceId: string;
  toStateId: string;
  transitionData?: Record<string, unknown>;
}

export class TransitionEngine {
  /**
   * Check which transitions are available for a process instance
   */
  static async checkAvailableTransitions({
    instanceId,
    toStateId,
    user,
  }: {
    instanceId: string;
    toStateId?: string;
    user: User;
  }): Promise<TransitionCheckResult> {
    if (!user) {
      throw new UnauthorizedError('User must be authenticated');
    }

    try {
      // Get the process instance with related data
      const instance = await assertProcessInstanceWithProcess({
        id: instanceId,
      });

      const process = instance.process;
      const processSchema = process.processSchema as ProcessSchema;
      const instanceData = instance.instanceData as InstanceData;
      console.log(
        'TRANSITION',
        instanceData.currentStateId,
        instance.currentStateId,
        instanceData,
      );
      const currentStateId =
        instanceData.currentStateId || instance.currentStateId || '';

      // Find applicable transitions
      const applicableTransitions = processSchema.transitions.filter(
        (transition) => {
          // Check if transition applies from current state
          if (Array.isArray(transition.from)) {
            return transition.from.includes(currentStateId);
          }
          return transition.from === currentStateId;
        },
      );

      // If specific toStateId requested, filter to that transition
      const transitionsToCheck = toStateId
        ? applicableTransitions.filter((t) => t.to === toStateId)
        : applicableTransitions;

      const results = await Promise.all(
        transitionsToCheck.map(async (transition) => {
          const ruleCheck = await this.evaluateTransitionRules({
            instanceId,
            transition,
            processSchema,
            instanceData,
            user,
          });

          return {
            toStateId: transition.to,
            transitionName: transition.name,
            canExecute: ruleCheck.canExecute,
            failedRules: ruleCheck.failedRules,
          };
        }),
      );

      return {
        canTransition: results.some((r) => r.canExecute),
        availableTransitions: results,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      console.error('Error checking transitions:', error);
      throw new CommonError('Failed to check transitions');
    }
  }

  /**
   * Execute a state transition
   */
  static async executeTransition({
    data,
    user,
  }: {
    data: ExecuteTransitionInput;
    user: User;
  }) {
    if (!user) {
      throw new UnauthorizedError('User must be authenticated');
    }

    try {
      const dbUser = await assertUser({ authUserId: user.id });

      if (!dbUser.currentProfileId) {
        throw new UnauthorizedError('User must have an active profile');
      }

      // Check if transition is valid
      const transitionCheck = await this.checkAvailableTransitions({
        instanceId: data.instanceId,
        toStateId: data.toStateId,
        user,
      });

      const targetTransition = transitionCheck.availableTransitions.find(
        (t) => t.toStateId === data.toStateId,
      );

      if (!targetTransition || !targetTransition.canExecute) {
        const failedRules = targetTransition?.failedRules || [];
        throw new ValidationError(
          `Cannot execute transition: ${failedRules.map((r) => r.errorMessage).join(', ')}`,
        );
      }

      // Get the instance again for updating
      const instance = await assertProcessInstanceWithProcess({
        id: data.instanceId,
      });

      const process = instance.process;
      const processSchema = process.processSchema as ProcessSchema;
      const instanceData = instance.instanceData as InstanceData;
      const currentStateId =
        instanceData.currentStateId || instance.currentStateId || '';

      // Find the transition definition
      const transition = processSchema.transitions.find(
        (t) =>
          t.to === data.toStateId &&
          (Array.isArray(t.from)
            ? t.from.includes(currentStateId)
            : t.from === currentStateId),
      );

      if (!transition) {
        throw new ValidationError('Invalid transition');
      }

      // Update instance data with new state
      const updatedInstanceData: InstanceData = {
        ...instanceData,
        currentStateId: data.toStateId,
        stateData: {
          ...instanceData.stateData,
          [data.toStateId]: {
            enteredAt: new Date().toISOString(),
            metadata: data.transitionData || {},
          },
        },
      };

      // Execute transition actions if defined
      if (transition.actions) {
        await this.executeTransitionActions({
          actions: transition.actions,
          instanceId: data.instanceId,
          instanceData: updatedInstanceData,
          user,
        });
      }

      // Update the instance in a transaction
      await db.transaction(async (trx) => {
        // Update process instance
        await trx
          .update(processInstances)
          .set({
            currentStateId: data.toStateId,
            instanceData: updatedInstanceData,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(processInstances.id, data.instanceId));

        // Record transition history
        await trx.insert(stateTransitionHistory).values({
          processInstanceId: data.instanceId,
          fromStateId: currentStateId,
          toStateId: data.toStateId,
          transitionData: data.transitionData || {},
          triggeredByProfileId: dbUser.currentProfileId,
        });
      });

      // Return updated instance
      const updatedInstance = await db.query.processInstances.findFirst({
        where: eq(processInstances.id, data.instanceId),
        with: {
          process: true,
          owner: true,
        },
      });

      return updatedInstance;
    } catch (error) {
      if (
        error instanceof UnauthorizedError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError
      ) {
        throw error;
      }
      console.error('Error executing transition:', error);
      throw new CommonError('Failed to execute transition');
    }
  }

  /**
   * Evaluate transition rules to determine if transition can execute
   */
  private static async evaluateTransitionRules({
    instanceId,
    transition,
    processSchema,
    instanceData,
    user,
  }: {
    instanceId: string;
    transition: TransitionDefinition;
    processSchema: ProcessSchema;
    instanceData: InstanceData;
    user: User;
  }): Promise<{
    canExecute: boolean;
    failedRules: Array<{ ruleId: string; errorMessage: string }>;
  }> {
    const failedRules: Array<{ ruleId: string; errorMessage: string }> = [];

    // If no rules defined, transition is allowed
    if (!transition.rules || !transition.rules.conditions) {
      return { canExecute: true, failedRules: [] };
    }

    const { conditions, requireAll = true } = transition.rules;
    const results = await Promise.all(
      conditions.map(async (condition, index) => {
        const ruleId = `rule_${index}`;
        try {
          const passes = await this.evaluateCondition({
            condition,
            instanceId,
            instanceData,
            processSchema,
            user,
          });

          if (!passes) {
            failedRules.push({
              ruleId,
              errorMessage: this.getConditionErrorMessage(condition),
            });
          }

          return passes;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          failedRules.push({
            ruleId,
            errorMessage: `Error evaluating condition: ${errorMessage}`,
          });
          return false;
        }
      }),
    );

    const canExecute = requireAll
      ? results.every((r) => r)
      : results.some((r) => r);

    return { canExecute, failedRules };
  }

  /**
   * Evaluate a single transition condition
   */
  private static async evaluateCondition({
    condition,
    instanceId,
    instanceData,
    processSchema,
    user,
  }: {
    condition: TransitionCondition;
    instanceId: string;
    instanceData: InstanceData;
    processSchema: ProcessSchema;
    user: User;
  }): Promise<boolean> {
    // Suppress unused parameter warnings for extensibility
    void processSchema;
    void user;
    switch (condition.type) {
      case 'time':
        return this.evaluateTimeCondition(condition, instanceData);

      case 'proposalCount':
        return this.evaluateProposalCountCondition(condition, instanceId);

      case 'participationCount':
        return this.evaluateParticipationCountCondition(condition, instanceId);

      case 'approvalRate':
        return this.evaluateApprovalRateCondition(condition, instanceId);

      case 'customField':
        return this.evaluateCustomFieldCondition(condition, instanceData);

      default:
        throw new Error(`Unknown condition type: ${condition.type}`);
    }
  }

  private static evaluateTimeCondition(
    condition: TransitionCondition,
    instanceData: InstanceData,
  ): boolean {
    const now = new Date();
    const currentState = instanceData.stateData?.[instanceData.currentStateId];

    if (!currentState?.enteredAt) {
      return false;
    }

    const enteredAt = new Date(currentState.enteredAt);
    const timeDiff = now.getTime() - enteredAt.getTime();
    const value = Number(condition.value); // Expected in milliseconds

    switch (condition.operator) {
      case 'greaterThan':
        return timeDiff > value;
      case 'lessThan':
        return timeDiff < value;
      case 'equals':
        return Math.abs(timeDiff - value) < 60000; // Within 1 minute
      default:
        return false;
    }
  }

  private static async evaluateProposalCountCondition(
    condition: TransitionCondition,
    instanceId: string,
  ): Promise<boolean> {
    const proposalCount = await db.$count(
      proposals,
      eq(proposals.processInstanceId, instanceId),
    );

    const value = Number(condition.value);

    switch (condition.operator) {
      case 'equals':
        return proposalCount === value;
      case 'greaterThan':
        return proposalCount > value;
      case 'lessThan':
        return proposalCount < value;
      default:
        return false;
    }
  }

  private static async evaluateParticipationCountCondition(
    condition: TransitionCondition,
    instanceId: string,
  ): Promise<boolean> {
    // Count unique participants who have submitted decisions
    const participantCount = await db
      .selectDistinctOn([decisions.decidedByProfileId])
      .from(decisions)
      .innerJoin(proposals, eq(proposals.id, decisions.proposalId))
      .where(eq(proposals.processInstanceId, instanceId))
      .then((results) => results.length);

    const value = Number(condition.value);

    switch (condition.operator) {
      case 'equals':
        return participantCount === value;
      case 'greaterThan':
        return participantCount > value;
      case 'lessThan':
        return participantCount < value;
      default:
        return false;
    }
  }

  private static async evaluateApprovalRateCondition(
    condition: TransitionCondition,
    instanceId: string,
  ): Promise<boolean> {
    // This is a simplified approval rate calculation
    // In practice, you'd need to define what constitutes "approval" in your decision schema
    const allDecisions = await db
      .select()
      .from(decisions)
      .innerJoin(proposals, eq(proposals.id, decisions.proposalId))
      .where(eq(proposals.processInstanceId, instanceId));

    if (allDecisions.length === 0) {
      return false;
    }

    // Simplified: assume decisions with decisionData.approved = true are approvals
    const approvalCount = allDecisions.filter((d) => {
      const decisionData = d.decision_instances.decisionData as Record<
        string,
        unknown
      >;
      return decisionData.approved === true;
    }).length;

    const approvalRate = approvalCount / allDecisions.length;
    const value = Number(condition.value);

    switch (condition.operator) {
      case 'equals':
        return Math.abs(approvalRate - value) < 0.01; // Within 1%
      case 'greaterThan':
        return approvalRate > value;
      case 'lessThan':
        return approvalRate < value;
      default:
        return false;
    }
  }

  private static evaluateCustomFieldCondition(
    condition: TransitionCondition,
    instanceData: InstanceData,
  ): boolean {
    if (!condition.field) {
      return false;
    }

    const fieldValue = instanceData.fieldValues?.[condition.field];
    const expectedValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'greaterThan':
        return (
          typeof fieldValue === 'number' &&
          typeof expectedValue === 'number' &&
          fieldValue > expectedValue
        );
      case 'lessThan':
        return (
          typeof fieldValue === 'number' &&
          typeof expectedValue === 'number' &&
          fieldValue < expectedValue
        );
      default:
        return false;
    }
  }

  private static getConditionErrorMessage(
    condition: TransitionCondition,
  ): string {
    switch (condition.type) {
      case 'time':
        return `Time condition not met: ${condition.operator} ${condition.value}ms`;
      case 'proposalCount':
        return `Proposal count condition not met: ${condition.operator} ${condition.value}`;
      case 'participationCount':
        return `Participation count condition not met: ${condition.operator} ${condition.value}`;
      case 'approvalRate':
        return `Approval rate condition not met: ${condition.operator} ${Number(condition.value) * 100}%`;
      case 'customField':
        return `Custom field condition not met: ${condition.field} ${condition.operator} ${condition.value}`;
      default:
        return 'Unknown condition failed';
    }
  }

  /**
   * Execute transition actions (notifications, field updates, etc.)
   */
  private static async executeTransitionActions({
    actions,
    instanceId,
    instanceData,
    user,
  }: {
    actions: Array<{ type: string; config: Record<string, unknown> }>;
    instanceId: string;
    instanceData: InstanceData;
    user: User;
  }): Promise<void> {
    // These parameters are for future extensibility
    void instanceId;
    void user;
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'notify':
            // Implement notification logic
            console.log('Notification action:', action.config);
            break;
          case 'updateField':
            // Update instance field values
            if (action.config.field && action.config.value !== undefined) {
              instanceData.fieldValues = {
                ...instanceData.fieldValues,
                [action.config.field as string]: action.config.value,
              };
            }
            break;
          case 'createRecord':
            // Create related records if needed
            console.log('Create record action:', action.config);
            break;
          default:
            console.warn(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        // Continue with other actions even if one fails
      }
    }
  }
}
