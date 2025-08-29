'use client';

import { useEffect, useRef } from 'react';

// React Leaflet is a peer dependency - handle cases where it might not be available
let useMap: any;
try {
  useMap = require('react-leaflet').useMap;
} catch {
  // React Leaflet not available (e.g., in Storybook or type checking)
  useMap = () => ({});
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewSyncProps {
  onBoundsChange: (bounds: MapBounds) => void;
  mapViewState?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  setMapViewState?: (state: { latitude: number; longitude: number; zoom: number }) => void;
}

export function MapViewSync({ 
  onBoundsChange, 
  mapViewState, 
  setMapViewState 
}: MapViewSyncProps) {
  const map = useMap();
  const isInitialized = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync store to map (only on initial load)
  useEffect(() => {
    if (mapViewState && !isInitialized.current && map && typeof map.setView === 'function') {
      map.setView([mapViewState.latitude, mapViewState.longitude], mapViewState.zoom);
      isInitialized.current = true;
    }
  }, [map, mapViewState?.latitude, mapViewState?.longitude, mapViewState?.zoom]);

  // Sync map to store and track bounds with debouncing
  useEffect(() => {
    if (!map || typeof map.getCenter !== 'function') {
      return;
    }

    const handleMove = () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        
        if (!center || !bounds) {
          return;
        }
        
        // Debounce store updates to prevent infinite loops
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        updateTimeoutRef.current = setTimeout(() => {
          // Only update if values have actually changed significantly and setMapViewState is provided
          if (setMapViewState && mapViewState) {
            const latDiff = Math.abs(center.lat - mapViewState.latitude);
            const lngDiff = Math.abs(center.lng - mapViewState.longitude);
            const zoomDiff = Math.abs(zoom - mapViewState.zoom);
            
            if (latDiff > 0.001 || lngDiff > 0.001 || zoomDiff > 0.1) {
              setMapViewState({
                latitude: center.lat,
                longitude: center.lng,
                zoom,
              });
            }
          }
          
          // Always update bounds for API queries
          onBoundsChange({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        }, 300); // 300ms debounce
      } catch (error) {
        console.warn('MapViewSync: Error handling map move event:', error);
      }
    };

    // Initial bounds calculation (without store update)
    try {
      if (typeof map.getBounds === 'function') {
        const initialBounds = map.getBounds();
        if (initialBounds) {
          onBoundsChange({
            north: initialBounds.getNorth(),
            south: initialBounds.getSouth(),
            east: initialBounds.getEast(),
            west: initialBounds.getWest(),
          });
        }
      }
    } catch (error) {
      console.warn('MapViewSync: Error getting initial bounds:', error);
    }

    if (typeof map.on === 'function') {
      map.on('moveend', handleMove);
      map.on('zoomend', handleMove);
    }
    
    return () => {
      if (typeof map.off === 'function') {
        map.off('moveend', handleMove);
        map.off('zoomend', handleMove);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [map, onBoundsChange, setMapViewState, mapViewState]);

  return null;
}