import type { Block, BlockExecutor } from '../types';
import { BranchBlock } from './BranchBlock';
import { ComputeBlock } from './ComputeBlock';
import { DebugBlock } from './DebugBlock';
import { FilterBlock } from './FilterBlock';
import { GroupBlock } from './GroupBlock';
import { LimitBlock } from './LimitBlock';
import { MergeBlock } from './MergeBlock';
import { ScoreBlock } from './ScoreBlock';
import { SortBlock } from './SortBlock';
import { TransformBlock } from './TransformBlock';

/**
 * Registry of block executors
 */
const executorRegistry = new Map<string, BlockExecutor<any>>();

// Register all executors
executorRegistry.set('filter', new FilterBlock());
executorRegistry.set('transform', new TransformBlock());
executorRegistry.set('compute', new ComputeBlock());
executorRegistry.set('branch', new BranchBlock());
executorRegistry.set('merge', new MergeBlock());
executorRegistry.set('group', new GroupBlock());
executorRegistry.set('limit', new LimitBlock());
executorRegistry.set('sort', new SortBlock());
executorRegistry.set('score', new ScoreBlock());
executorRegistry.set('debug', new DebugBlock());

/**
 * Get the executor for a given block type
 */
export function getBlockExecutor(block: Block): BlockExecutor {
  const executor = executorRegistry.get(block.type);

  if (!executor) {
    throw new Error(`No executor found for block type: ${block.type}`);
  }

  return executor;
}

// Export all executors for testing
export {
  BranchBlock,
  ComputeBlock,
  DebugBlock,
  FilterBlock,
  GroupBlock,
  LimitBlock,
  MergeBlock,
  ScoreBlock,
  SortBlock,
  TransformBlock,
};
