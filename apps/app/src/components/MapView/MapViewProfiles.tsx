'use client';

import { MapGeospatial, type MapBounds } from '@op/ui/MapGeospatial';
import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { trpc } from '@op/api/client';


export function MapViewProfiles() {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: apiProfiles = [], isLoading } = trpc.profile.searchByBounds.useQuery(
    { bounds: bounds! },
    { enabled: !!bounds, refetchOnWindowFocus: false }
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Transform API data to match MapGeospatial expected format
  const profiles = useMemo(() => {
    return apiProfiles.map(profile => {
      // Extract location from organization.whereWeWork[0].location if available
      const location = profile.organization?.whereWeWork?.[0]?.location;
      
      return {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        latitude: location?.y || 0, // y coordinate from location
        longitude: location?.x || 0, // x coordinate from location
        description: profile.bio || '', // Use bio as description
        avatar: profile.avatarImage?.url, // Use avatarImage URL
        location: location?.name || '', // Use location name
        website: profile.website,
        email: profile.email,
        // Include the original data for reference
        original: profile
      };
    });
  }, [apiProfiles]);

  // This callback will be passed to the map component.
  // It gets triggered whenever the map's viewport changes.
  const handleBoundsChange = useCallback((newBounds: MapBounds) => {
    // Clear any existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Set a new timeout to update bounds after 500ms of inactivity
    debounceRef.current = setTimeout(() => {
      setBounds(newBounds);
    }, 500);
  }, []);

  return (
    // This container provides the necessary height for the map to render
    // and acts as a positioning context for the loading indicator.
    // The height is calculated to fill the viewport minus an assumed header height (4rem or 64px).
    <div className="relative h-[calc(100vh-4rem)] w-full">
      {isLoading && (
        <div className="absolute top-4 right-4 z-10 rounded bg-white p-2 shadow-lg animate-pulse">
          Loading...
        </div>
      )}

      <MapGeospatial profiles={profiles} onBoundsChange={handleBoundsChange} />
    </div>
  );
}