import type { Block } from './types';

export function usesBudgetBlock(blocks: Block[]): boolean {
  return blocks.some((block) => {
    if (block.type === 'budget') {
      return true;
    }

    if (block.type === 'branch') {
      return (
        block.branches.some((branch) => usesBudgetBlock(branch.blocks)) ||
        (block.default !== undefined && usesBudgetBlock(block.default.blocks))
      );
    }

    return false;
  });
}
