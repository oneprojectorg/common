import type { Proposal } from '@op/db/schema';

import { evaluateExpression } from '../expressionEvaluator';
import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  GroupBlock as GroupBlockType,
} from '../types';

interface Group {
  key: any;
  proposals: Proposal[];
  aggregations?: Record<string, any>;
}

export class GroupBlock implements BlockExecutor<GroupBlockType> {
  execute(
    block: GroupBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    // Group proposals by the specified field
    const groupMap = new Map<string, Proposal[]>();

    for (const proposal of context.proposals) {
      const proposalContext = { ...context, proposal };

      const groupKey =
        typeof block.groupBy === 'string'
          ? evaluateExpression({ field: block.groupBy }, proposalContext)
          : evaluateExpression(block.groupBy, proposalContext);

      const keyString = JSON.stringify(groupKey);

      if (!groupMap.has(keyString)) {
        groupMap.set(keyString, []);
      }
      groupMap.get(keyString)?.push(proposal);
    }

    // Create group objects with aggregations
    const groups: Group[] = [];

    for (const [keyString, proposals] of groupMap.entries()) {
      const key = JSON.parse(keyString);
      const group: Group = {
        key,
        proposals,
      };

      // Calculate aggregations if specified
      if (block.aggregations) {
        group.aggregations = {};

        for (const [aggName, aggConfig] of Object.entries(block.aggregations)) {
          group.aggregations[aggName] = this.calculateAggregation(
            proposals,
            aggConfig,
            context,
          );
        }
      }

      groups.push(group);
    }

    return {
      proposals: context.proposals, // Pass through original proposals
      output: groups, // Store groups in output
    };
  }

  private calculateAggregation(
    proposals: Proposal[],
    config: {
      operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
      field?: string;
    },
    baseContext: ExecutionContext,
  ): any {
    switch (config.operation) {
      case 'count':
        return proposals.length;

      case 'sum': {
        if (!config.field) {
          return 0;
        }
        let sum = 0;
        for (const proposal of proposals) {
          const ctx = { ...baseContext, proposal };
          const value = evaluateExpression({ field: config.field }, ctx);
          sum += typeof value === 'number' ? value : 0;
        }
        return sum;
      }

      case 'avg': {
        if (!config.field || proposals.length === 0) {
          return 0;
        }
        let sum = 0;
        for (const proposal of proposals) {
          const ctx = { ...baseContext, proposal };
          const value = evaluateExpression({ field: config.field }, ctx);
          sum += typeof value === 'number' ? value : 0;
        }
        return sum / proposals.length;
      }

      case 'min': {
        if (!config.field || proposals.length === 0) {
          return null;
        }
        const values = proposals.map((proposal) => {
          const ctx = { ...baseContext, proposal };
          return evaluateExpression({ field: config.field! }, ctx);
        });
        const numericValues = values.filter((v) => typeof v === 'number');
        if (numericValues.length === 0) {
          return null;
        }
        return Math.min(...numericValues);
      }

      case 'max': {
        if (!config.field || proposals.length === 0) {
          return null;
        }
        const values = proposals.map((proposal) => {
          const ctx = { ...baseContext, proposal };
          return evaluateExpression({ field: config.field! }, ctx);
        });
        const numericValues = values.filter((v) => typeof v === 'number');
        if (numericValues.length === 0) {
          return null;
        }
        return Math.max(...numericValues);
      }

      default:
        throw new Error(`Unknown aggregation operation: ${config.operation}`);
    }
  }
}
