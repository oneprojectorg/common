import type { SelectionPipeline } from './types';

/**
 * Default selection pipeline - selects all shortlisted proposals
 *
 * This is used when no custom selection pipeline is defined in the process schema.
 * It simply filters for proposals with status 'shortlisted' and returns them all.
 */
export const defaultSelectionPipeline: SelectionPipeline = {
  version: '1.0.0',
  blocks: [
    {
      id: 'filter-shortlisted',
      type: 'filter',
      name: 'Select all shortlisted proposals',
      description: 'Default behavior: select all proposals with shortlisted status',
      condition: {
        operator: 'equals',
        left: { field: 'status' },
        right: { value: 'shortlisted' },
      },
    },
  ],
};
