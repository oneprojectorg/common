'use client';

import { Search } from 'lucide-react';

import { SearchField } from '@op/ui/SearchField';
import { useProfilesMapStore } from '../../stores/profilesMapStore';

export function SearchBar() {
  const { filters, updateFilters } = useProfilesMapStore();

  const handleSearchChange = (value: string) => {
    updateFilters({ searchQuery: value });
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <SearchField
        value={filters.searchQuery}
        onChange={handleSearchChange}
        className="w-64"
      />
    </div>
  );
}