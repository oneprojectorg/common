'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@op/ui/Skeleton';

import { useProfilesMapStore } from './stores/profilesMapStore';
import { ProfileCard } from './Shared/ProfileCard';
import { MapFilterBar } from './Shared/MapFilterBar';
import { MapDataFooter } from './Shared/MapDataFooter';

// Lazy load the map component
const GeospatialView = dynamic(
  () => import('./GeospatialView').then(mod => mod.GeospatialView),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />
  }
);

interface ProfilesMapProps {
  // Removed initialView prop as we only have geospatial view now
}

export function ProfilesMap({}: ProfilesMapProps) {
  const {
    isTransitioning,
    selectedProfile,
    filters,
    selectProfile,
    updateFilters
  } = useProfilesMapStore();

  const handleProfileSelect = (profileId: string | null) => {
    selectProfile(profileId);
  };

  return (
    <div className="flex h-screen w-full flex-col">
      {/* Filter Bar - Fixed at top with overflow visible for dropdowns */}
      <div className="relative z-30 bg-white shadow-sm" style={{ overflow: 'visible' }}>
        <MapFilterBar 
          filters={filters}
          onFiltersChange={updateFilters}
        />
      </div>

      {/* Main Content Area - Map + Profile Panel */}
      <div className="relative flex flex-1">
        {/* Map View Container */}
        <div className={`flex-1 ${selectedProfile ? 'mr-80' : ''} transition-all duration-300`}>
          {/* Map View */}
          <div className="h-full w-full">
            <GeospatialView
              onProfileSelect={handleProfileSelect}
              selectedProfileId={selectedProfile}
            />
          </div>

          {/* Loading/Transition Overlay */}
          {isTransitioning && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <div className="rounded-lg bg-white p-4 shadow-lg">
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          )}
        </div>

        {/* Profile Details Sidebar - on the right */}
        {selectedProfile && (
          <div className="w-80 bg-white shadow-lg border-l border-neutral-gray2 overflow-y-auto">
            <ProfileCard
              profileId={selectedProfile}
              onClose={() => selectProfile(null)}
            />
          </div>
        )}
      </div>

      {/* Data Footer */}
      <MapDataFooter />
    </div>
  );
}