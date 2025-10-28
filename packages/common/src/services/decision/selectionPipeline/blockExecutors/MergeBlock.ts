import type { Proposal } from '@op/db/schema';

import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  MergeBlock as MergeBlockType,
} from '../types';

export class MergeBlock implements BlockExecutor<MergeBlockType> {
  execute(block: MergeBlockType, context: ExecutionContext): BlockExecutionResult {
    const inputArrays: Proposal[][] = block.inputs.map((inputName) => {
      const value = context.outputs[inputName];
      return Array.isArray(value) ? value : [];
    });

    let mergedProposals: Proposal[];

    switch (block.strategy) {
      case 'union':
        // Remove duplicates by ID
        mergedProposals = this.union(inputArrays);
        break;

      case 'intersection':
        // Only proposals present in all inputs
        mergedProposals = this.intersection(inputArrays);
        break;

      case 'concat':
        // Simple concatenation, may include duplicates
        mergedProposals = inputArrays.flat();
        break;

      case 'custom':
        // Custom merge strategy is not yet implemented
        // When implemented, this will allow users to define custom merge logic
        // using expressions to determine which proposals to include
        throw new Error(
          'Custom merge strategy not yet implemented. Use union, intersection, or concat instead.',
        );

      default:
        throw new Error(`Unknown merge strategy: ${block.strategy}`);
    }

    return {
      proposals: mergedProposals,
    };
  }

  private union(arrays: Proposal[][]): Proposal[] {
    const seen = new Set<string>();
    const result: Proposal[] = [];

    for (const arr of arrays) {
      for (const proposal of arr) {
        if (!seen.has(proposal.id)) {
          seen.add(proposal.id);
          result.push(proposal);
        }
      }
    }

    return result;
  }

  private intersection(arrays: Proposal[][]): Proposal[] {
    if (arrays.length === 0) {
      return [];
    }

    if (arrays.length === 1) {
      return arrays[0] ?? [];
    }

    // Count occurrences of each proposal ID
    const counts = new Map<string, number>();
    const proposalMap = new Map<string, Proposal>();

    for (const arr of arrays) {
      const seen = new Set<string>();
      for (const proposal of arr) {
        if (!seen.has(proposal.id)) {
          seen.add(proposal.id);
          counts.set(proposal.id, (counts.get(proposal.id) || 0) + 1);
          proposalMap.set(proposal.id, proposal);
        }
      }
    }

    // Return proposals that appear in all arrays
    const result: Proposal[] = [];
    for (const [id, count] of counts.entries()) {
      if (count === arrays.length) {
        const proposal = proposalMap.get(id);
        if (proposal) {
          result.push(proposal);
        }
      }
    }

    return result;
  }
}
