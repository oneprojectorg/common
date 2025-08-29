import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface FilterState {
  focusAreas: string[];
  relationshipTypes: string[];
  searchQuery?: string;
}

export interface ProfilesMapStore {
  // Map state
  isTransitioning: boolean;
  mapViewState: MapViewState;
  
  // Selection state
  selectedProfile: string | null;
  
  // Filter state
  filters: FilterState;
  
  // Actions
  setMapViewState: (state: Partial<MapViewState>) => void;
  selectProfile: (profileId: string | null) => void;
  updateFilters: (updates: Partial<FilterState>) => void;
  resetFilters: () => void;
}

const defaultMapViewState: MapViewState = {
  latitude: 40.7128, // New York City
  longitude: -74.0060,
  zoom: 10,
};

const defaultFilters: FilterState = {
  focusAreas: [],
  relationshipTypes: [],
  searchQuery: '',
};

export const useProfilesMapStore = create<ProfilesMapStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      isTransitioning: false,
      mapViewState: defaultMapViewState,
      selectedProfile: null,
      filters: defaultFilters,

      // Actions
      setMapViewState: (state) => {
        const currentState = get().mapViewState;
        const newState = { ...currentState, ...state };
        
        // Only update if values have actually changed to prevent infinite loops
        const hasChanged = 
          Math.abs(newState.latitude - currentState.latitude) > 0.0001 ||
          Math.abs(newState.longitude - currentState.longitude) > 0.0001 ||
          Math.abs(newState.zoom - currentState.zoom) > 0.01;
          
        if (hasChanged) {
          set({ mapViewState: newState });
        }
      },

      selectProfile: (profileId) => {
        set({ selectedProfile: profileId });
      },

      updateFilters: (updates) => {
        set({
          filters: { ...get().filters, ...updates }
        });
      },

      resetFilters: () => {
        set({ filters: defaultFilters });
      },
    }),
    { name: 'profiles-map-store' }
  )
);