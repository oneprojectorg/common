'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createCustomMarker } from '../src/components/CustomMarker';
import { createClusterCustomIcon } from '../src/components/ClusterIcon';
import { MapViewSync } from '../src/components/MapViewSync';
import { ProfilePopup, type ProfileData } from '../src/components/ProfilePopup';

// Dynamically import leaflet components
const LeafletMapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-cluster').then((mod) => mod.default),
  { ssr: false }
);

export interface Profile extends ProfileData {
  // Extending ProfileData for compatibility
}

interface InteractiveMapDemoProps {
  profiles: Profile[];
}

function MapDisplay({ profiles }: { profiles: Profile[] }) {
  const [mapViewState, setMapViewState] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
    zoom: 13
  });

  const handleBoundsChange = (bounds: any) => {
    console.log('Map bounds changed:', bounds);
  };

  const handleContactClick = (profile: ProfileData) => {
    console.log('Contact clicked for:', profile.name);
    // In a real app, this would open a contact modal or navigate to contact page
  };

  const handleViewProfileClick = (profile: ProfileData) => {
    console.log('View profile clicked for:', profile.name);
    // In a real app, this would navigate to the profile page
  };

  return (
    <div className="h-full w-full">
      <LeafletMapContainer
        center={[mapViewState.latitude, mapViewState.longitude]}
        zoom={mapViewState.zoom}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={40}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={true}
          zoomToBoundsOnClick={true}
        >
          {profiles.map((profile) => (
            <Marker
              key={profile.id}
              position={[profile.latitude, profile.longitude]}
              icon={createCustomMarker({ profileType: profile.type })}
            >
              <Popup>
                <ProfilePopup 
                  profile={profile}
                  showCoordinates={true}
                  compact={false}
                  onContactClick={handleContactClick}
                  onViewProfileClick={handleViewProfileClick}
                />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        <MapViewSync
          onBoundsChange={handleBoundsChange}
          mapViewState={mapViewState}
          setMapViewState={setMapViewState}
        />
      </LeafletMapContainer>
    </div>
  );
}

export function InteractiveMapDemo({ profiles }: InteractiveMapDemoProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Ensure leaflet CSS is loaded
    if (typeof window !== 'undefined') {
      const existingLink = document.querySelector('link[href*="leaflet.css"]');
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
    }
  }, []);

  if (!isClient) {
    return (
      <div className="h-full w-full bg-neutral-100 flex items-center justify-center">
        <div className="text-neutral-500">Loading map components...</div>
      </div>
    );
  }

  return <MapDisplay profiles={profiles} />;
}

export default InteractiveMapDemo;