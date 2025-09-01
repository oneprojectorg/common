'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactMap, {
  Marker,
  Popup,
  NavigationControl,
  MapRef,
  ViewState,
  ViewStateChangeEvent
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { ProfilePopup, type ProfilePopupData } from './ProfilePopup';
import { MapProfileIcon } from './MapProfileIcon';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface MapGeospatialProps {
  /** Array of profile data to display on the map */
  profiles: ProfilePopupData[];
  /** Initial view state of the map */
  initialViewState?: MapViewState;
  /** Callback when map bounds change */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Callback when view state changes */
  onViewStateChange?: (viewState: MapViewState) => void;
  /** Callback when a profile is clicked for contact */
  onContactClick?: (profile: ProfilePopupData) => void;
  /** Callback when a profile is clicked to view details */
  onViewProfileClick?: (profile: ProfilePopupData) => void;
  /** Whether to show map controls */
  showControls?: boolean;
  /** Map container class name */
  className?: string;
  /** Map style URL */
  mapStyle?: string;
}

const DEFAULT_VIEW_STATE: MapViewState = {
  latitude: 40.7128, // New York City
  longitude: -74.0060,
  zoom: 10,
};

const DEFAULT_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// TODO: Decide how and where to adjust the marker positions if they would otherwise overlap.
export function MapGeospatial({
  profiles,
  initialViewState = DEFAULT_VIEW_STATE,
  onBoundsChange,
  onViewStateChange,
  onContactClick,
  onViewProfileClick,
  showControls = true,
  className = 'h-full w-full',
  mapStyle = DEFAULT_MAP_STYLE,
}: MapGeospatialProps) {
  const [viewState, setViewState] = useState<ViewState>({
    latitude: initialViewState.latitude,
    longitude: initialViewState.longitude,
    zoom: initialViewState.zoom,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const [selectedProfile, setSelectedProfile] = useState<ProfilePopupData | null>(null);
  const mapRef = React.useRef<MapRef>(null);

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
    
    if (onViewStateChange) {
      onViewStateChange({
        latitude: evt.viewState.latitude,
        longitude: evt.viewState.longitude,
        zoom: evt.viewState.zoom,
      });
    }

    if (onBoundsChange && mapRef.current) {
      const bounds = mapRef.current.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    }
  }, [onBoundsChange, onViewStateChange]);

  const handleMarkerClick = useCallback((profile: ProfilePopupData) => {
    setSelectedProfile(profile);
  }, []);

  const handlePopupClose = useCallback(() => {
    setSelectedProfile(null);
  }, []);

  const markers = useMemo(() => 
    profiles.map((profile) => {

      return (
        <Marker
          key={profile.id}
          latitude={profile.latitude}
          longitude={profile.longitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(profile);
          }}
        >
         <MapProfileIcon profileType={profile.type} />
        </Marker>
      );
    })
  , [profiles, handleMarkerClick]);

  return (
    <div className={className}>
      <ReactMap
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        mapStyle={mapStyle}
        styleDiffing={true}
        attributionControl={false}
        interactive={true}
        doubleClickZoom={true}
        touchZoomRotate={true}
        minZoom={1}
        maxZoom={20}
      >
        {showControls && (
          <>
            <NavigationControl position="top-right" />

          </>
        )}

        {markers}

        {selectedProfile && (
          <Popup
            latitude={selectedProfile.latitude}
            longitude={selectedProfile.longitude}
            anchor="top"
            onClose={handlePopupClose}
            closeButton={true}
            closeOnClick={false}
            className="mapgl-popup"
          >
            <ProfilePopup
              profile={selectedProfile}
              showCoordinates={false}
              onContactClick={onContactClick}
              onViewProfileClick={onViewProfileClick}
            />
          </Popup>
        )}
      </ReactMap>
    </div>
  );
}