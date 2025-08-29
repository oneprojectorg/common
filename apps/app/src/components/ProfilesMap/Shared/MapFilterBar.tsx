'use client';

import type { Option } from '@op/ui/MultiSelectComboBox';
import { TermsMultiSelect } from '@/components/TermsMultiSelect';

export interface MapFilterBarProps {
  filters: {
    focusAreas: string[];
    relationshipTypes: string[];
    // Note: searchQuery can be implemented later with global profile search
  };
  onFiltersChange: (updates: Partial<MapFilterBarProps['filters']>) => void;
}


export function MapFilterBar({ filters, onFiltersChange }: MapFilterBarProps) {
  const handleFocusAreasChange = (selectedOptions: Array<Option>) => {
    onFiltersChange({ 
      focusAreas: selectedOptions.map(option => option.id) 
    });
  };

  const handleRelationshipTypesChange = (selectedOptions: Array<Option>) => {
    onFiltersChange({ 
      relationshipTypes: selectedOptions.map(option => option.id) 
    });
  };

  // Convert string IDs back to Option objects for the components
  const selectedFocusAreas: Option[] = filters.focusAreas.map(id => ({ id, label: id }));
  
  const selectedRelationshipTypes: Option[] = filters.relationshipTypes.map(id => ({ id, label: id }));

  return (
    <div className="flex flex-wrap items-start gap-3 p-4 bg-white border-b border-neutral-gray2 shadow-sm relative">
      {/* Focus Areas Filter - Uses taxonomy API */}
      <div className="min-w-48 max-w-64 flex-shrink-0 relative z-50">
        <TermsMultiSelect
          label="Focus Areas"
          placeholder="Filter by focus areas..."
          taxonomy="focus-areas"
          value={selectedFocusAreas}
          onChange={handleFocusAreasChange}
        />
      </div>

      {/* Relationship Types Filter - Uses taxonomy API */}
      <div className="min-w-48 max-w-64 flex-shrink-0 relative z-50">
        <TermsMultiSelect
          label="Relationship Types"
          placeholder="Filter by relationships..."
          taxonomy="relationship-types"
          value={selectedRelationshipTypes}
          onChange={handleRelationshipTypesChange}
        />
      </div>

      {/* Clear Filters Button */}
      <button
        onClick={() => onFiltersChange({
          focusAreas: [],
          relationshipTypes: []
        })}
        className="flex-shrink-0 px-3 py-2 text-sm text-neutral-gray4 hover:text-neutral-charcoal transition-colors whitespace-nowrap self-center"
      >
        Clear All
      </button>
    </div>
  );
}