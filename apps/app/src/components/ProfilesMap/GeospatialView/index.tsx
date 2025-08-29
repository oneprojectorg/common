'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import './map-styles.css';

import { Skeleton } from '@op/ui/Skeleton';
import { createCustomMarker } from '@op/ui/CustomMarker';
import { createClusterCustomIcon } from '@op/ui/ClusterIcon';
import { MapViewSync } from '@op/ui/MapViewSync';
import { ProfilePopup, type ProfileData } from '@op/ui/ProfilePopup';
import { trpc } from '@op/api/client';

import { useProfilesMapStore } from '../stores/profilesMapStore';

interface GeospatialViewProps {
  onProfileSelect: (profileId: string | null) => void;
  selectedProfileId: string | null;
}


interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function GeospatialView({ onProfileSelect, selectedProfileId: _selectedProfileId }: GeospatialViewProps) {
  const { mapViewState, filters, setMapViewState } = useProfilesMapStore();
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [debouncedBounds, setDebouncedBounds] = useState<MapBounds | null>(null);
  const boundsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transform app profile data to ProfilePopup format
  const transformToProfileData = (profileData: any): ProfileData | null => {
    const { profile, location } = profileData;
    
    // Skip if location is null or missing coordinates
    if (!location || !location.latitude || !location.longitude) {
      return null;
    }
    
    return {
      id: profile.id,
      name: profile.name,
      type: profile.type as 'individual' | 'organization',
      latitude: location.latitude,
      longitude: location.longitude,
      description: profile.bio || 'No description available',
      location: location.address || undefined,
      avatar: profile.avatarImage?.url || undefined,
      website: profile.website || undefined,
      email: profile.email || undefined,
    };
  };

  const handleContactClick = (profileData: ProfileData) => {
    if (profileData.email) {
      window.open(`mailto:${profileData.email}`, '_blank');
    }
  };

  const handleViewProfileClick = (profileData: ProfileData) => {
    onProfileSelect(profileData.id);
  };

  // Debounce bounds changes to prevent excessive API calls
  useEffect(() => {
    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
    }
    
    if (mapBounds) {
      boundsTimeoutRef.current = setTimeout(() => {
        setDebouncedBounds(mapBounds);
      }, 800); // Increased debounce time for smoother experience
    }
    
    return () => {
      if (boundsTimeoutRef.current) {
        clearTimeout(boundsTimeoutRef.current);
      }
    };
  }, [mapBounds]);

  // Real API call for profiles data - uses debounced bounds
  const { data: profiles, isLoading, error, isFetching } = trpc.map.getProfilesForMap.useQuery(
    {
      bounds: debouncedBounds || undefined,
      filters: {
        focusAreas: filters.focusAreas.length > 0 ? filters.focusAreas : undefined,
        // profileTypes filter is not currently supported in UI
      },
      limit: 500,
    },
    {
      enabled: !!debouncedBounds, // Only run query when debounced bounds are available
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    }
  );

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  // Show loading state only for initial load, not for background refetches
  if (isLoading && !profiles) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Skeleton className="h-32 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-neutral-gray4 mb-2">Unable to load map data</p>
          <p className="text-xs text-neutral-gray3">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Subtle loading indicator for background refetches */}
      {isFetching && (
        <div className="absolute top-4 right-4 z-50 rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm transition-opacity duration-300">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        </div>
      )}
      
      <MapContainer
        center={[mapViewState.latitude, mapViewState.longitude]}
        zoom={mapViewState.zoom}
        className="h-full w-full"
        zoomControl={false}
      >
      {/* Use Carto Positron for minimal, stroke-based design */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
        
        <MapViewSync 
          onBoundsChange={handleBoundsChange}
          mapViewState={mapViewState}
          setMapViewState={setMapViewState}
        />
        
        {/* Profile markers with clustering */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={true}
          zoomToBoundsOnClick={true}
          iconCreateFunction={createClusterCustomIcon}
          spiderLegPolylineOptions={{ weight: 1.5, color: '#14B8A6', opacity: 0.5 }}
        >
          {profiles?.map((profileData) => {
            const { profile, location } = profileData;
            
            // Skip profiles without location data
            if (!location?.latitude || !location?.longitude) {
              return null;
            }

            const customIcon = createCustomMarker({ profileType: profile.type as 'individual' | 'organization' });
            const transformedProfile = transformToProfileData(profileData);

            // Skip if transformation failed (null location or coordinates)
            if (!transformedProfile) {
              return null;
            }

            return (
              <Marker
                key={profile.id}
                position={[location.latitude, location.longitude]}
                icon={customIcon}
              >
                <Popup>
                  <ProfilePopup
                    profile={transformedProfile}
                    showCoordinates={false}
                    compact={false}
                    onContactClick={handleContactClick}
                    onViewProfileClick={handleViewProfileClick}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}