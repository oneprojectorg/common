import { getValueByPath } from '../expressionEvaluator';
import type {
  BlockExecutionResult,
  BlockExecutor,
  DebugBlock as DebugBlockType,
  ExecutionContext,
} from '../types';

// Used to add a logging step into the pipeline
export class DebugBlock implements BlockExecutor<DebugBlockType> {
  execute(
    block: DebugBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    console.log(`\n=== Debug Block: ${block.id} ===`);

    if (block.message) {
      console.log(`Message: ${block.message}`);
    }

    console.log(`Proposal count: ${context.proposals.length}`);

    if (block.logFields && block.logFields.length > 0) {
      console.log('\nSelected fields from all proposals:');
      const fields = block.logFields;
      context.proposals.forEach((proposal, index) => {
        console.log(`\n  Proposal ${index + 1} (${proposal.id}):`);
        for (const field of fields) {
          const value = getValueByPath(proposal, field);
          console.log(`    ${field}:`, value);
        }
      });
    }

    console.log(`Variables:`, context.variables);
    console.log(`Available outputs:`, Object.keys(context.outputs));
    console.log('===\n');

    return {
      proposals: context.proposals,
    };
  }
}
