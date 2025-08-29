# Profiles Map Feature - Technical Implementation Plan

## Overview

The Profiles Map feature will provide two complementary visualizations of organization and individual profiles:

1. **Geospatial Map View**: A location-based map showing profiles positioned according to their geographic coordinates
2. **Interest Graph View**: A network visualization organizing profiles by their focus areas, tactics, and relationships

Users will be able to seamlessly transition between these two views to explore different dimensions of the network.

## Architecture Integration

### Current Codebase Analysis

The application follows a well-structured Turborepo monorepo pattern with clear separation of concerns:

- **Frontend**: Next.js 15 with App Router, React 19, Tailwind CSS
- **Backend**: tRPC API with type-safe client-server communication
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: React Aria Components library with custom design system

### Key Existing Assets

- **Data Models**: Robust profile, organization, location, and relationship schemas
- **Theme System**: Comprehensive color palette with teal, yellow, orange, and neutral colors
- **Component Library**: Rich set of UI components in `@op/ui` package
- **Routing**: Next.js App Router with internationalization support

## Data Architecture

### Existing Schema Analysis

The current database schema provides excellent foundation for the map feature:

```typescript
// Profiles (organizations & individuals)
profiles {
  id, type, name, slug, bio, mission, 
  address, city, state, postalCode,
  headerImageId, avatarImageId,
  primary_location_id // NEW: Link to locations table
}

// Geographic data (EXISTING - leverages PostGIS)
locations {
  id, name, placeId, address, plusCode,
  location: geometry(point), // PostGIS point with spatial indexing
  countryCode, countryName, metadata
}

// Existing location relationships
organizationsWhereWeWork {
  organizationId, locationId // Can inform primary_location_id
}

// Relationships between profiles
profileRelationships {
  sourceProfileId, targetProfileId,
  relationshipType: 'following' | 'likes'
}

organizationRelationships {
  sourceOrganizationId, targetOrganizationId,
  relationshipType, pending, metadata
}

// Interest/taxonomy data
taxonomyTerms {
  id, taxonomyId, termUri, facet, label,
  definition, parentId, data
}

organizationsTerms {
  organizationId, taxonomyTermId
}

organizationsStrategies {
  organizationId, taxonomyTermId
}
```

### Required Schema Extensions

#### 1. Enhanced Profile-Location Relationships

```sql
-- Link profiles to their primary display location (leveraging existing locations table)
ALTER TABLE profiles 
ADD COLUMN primary_location_id UUID REFERENCES locations(id);

-- Index for efficient profile-location lookups
CREATE INDEX profiles_primary_location_idx ON profiles(primary_location_id);
```

#### 2. Runtime Computation Strategy

All map and graph data will be computed at runtime using:

- **Geospatial queries**: PostGIS spatial functions for real-time location-based filtering
- **Dynamic graph layout**: Client-side force-directed algorithms for interest graph visualization
- **In-memory caching**: React Query caching for performance optimization
- **User preferences**: Stored in existing user settings if needed, otherwise computed defaults

*No additional database tables required for map preferences or graph positions.*

## Technical Implementation

### 1. Library Selection & Feasibility Analysis

#### Library Selection: Leaflet + React Leaflet

**Implementation:**
```bash
pnpm add leaflet react-leaflet @types/leaflet
```

**Key Leaflet Features We'll Use:**
- OpenStreetMap tiles with custom styling options
- Marker clustering for performance at scale
- Custom SVG markers with profile avatars
- Popups with profile information cards
- Smooth pan/zoom animations
- Touch gesture support for mobile devices
- GeoJSON integration for complex shapes

### 2. Component Architecture

#### Map Container Component Structure

```typescript
// apps/app/src/components/ProfilesMap/
├── index.tsx                 // Main map container
├── GeospatialView/
│   ├── index.tsx            // Leaflet map implementation
│   ├── ProfileMarker.tsx    // Custom profile markers
│   ├── ClusterMarker.tsx    // Clustered markers for zoom levels
│   └── MapControls.tsx      // Zoom, filters, search controls
├── InterestGraphView/
│   ├── index.tsx            // Network graph implementation
│   ├── ProfileNode.tsx      // Individual profile nodes
│   ├── ConnectionEdge.tsx   // Relationship connections
│   ├── ClusterGroup.tsx     // Interest-based clusters
│   └── GraphControls.tsx    // Layout, filters, focus controls
├── ViewTransition/
│   ├── index.tsx            // Transition between map and graph views
│   └── AnimationController.tsx
├── Shared/
│   ├── ProfileCard.tsx      // Profile popup/tooltip
│   ├── FilterPanel.tsx      // Shared filtering controls
│   ├── SearchBar.tsx        // Profile search functionality
│   └── ViewToggle.tsx       // Switch between map/graph views
└── hooks/
    ├── useMapData.tsx       // Data fetching and caching
    ├── useViewTransition.tsx // Animation state management
    └── useProfileFilter.tsx  // Filter state management
```

### 3. State Management

#### Zustand Store Structure

```typescript
// apps/app/src/stores/profilesMapStore.ts
interface ProfilesMapStore {
  // View state
  currentView: 'geospatial' | 'interest-graph';
  isTransitioning: boolean;
  
  // Map state
  mapCenter: [number, number];
  mapZoom: number;
  selectedProfile: string | null;
  
  // Graph state
  graphLayout: 'force' | 'circular' | 'hierarchical';
  selectedCluster: string | null;
  
  // Filter state
  filters: {
    profileTypes: ('individual' | 'organization')[];
    focusAreas: string[];
    organizationTypes: string[];
    locationRadius?: { center: [number, number], radius: number };
  };
  
  // Actions
  setView: (view: 'geospatial' | 'interest-graph') => void;
  setMapPosition: (center: [number, number], zoom: number) => void;
  selectProfile: (profileId: string | null) => void;
  updateFilters: (filters: Partial<typeof filters>) => void;
}
```

### 4. API Endpoints

#### New tRPC Procedures

```typescript
// services/api/src/routers/map/index.ts
export const mapRouter = {
  // Get profiles with geographic data using existing locations table
  getProfilesForMap: publicProcedure
    .input(z.object({
      bounds: z.object({
        north: z.number(),
        south: z.number(), 
        east: z.number(),
        west: z.number()
      }).optional(),
      filters: z.object({
        profileTypes: z.array(z.enum(['individual', 'organization'])).optional(),
        focusAreas: z.array(z.string()).optional(),
        organizationTypes: z.array(z.string()).optional()
      }).optional(),
      limit: z.number().default(500)
    }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select({
          profile: profiles,
          location: {
            ...locations,
            // Extract coordinates server-side using PostGIS functions
            latitude: sql<number>`ST_Y(${locations.location})`.as('latitude'),
            longitude: sql<number>`ST_X(${locations.location})`.as('longitude')
          }
        })
        .from(profiles)
        .leftJoin(locations, eq(profiles.primaryLocationId, locations.id))
        .where(
          and(
            // Only show profiles with valid locations
            sql`${locations.location} IS NOT NULL`,
            // PostGIS spatial query using correct function pattern
            input.bounds ? sql`ST_Within(
              ${locations.location}, 
              ST_SetSRID(ST_MakeEnvelope(
                ${input.bounds.west}, ${input.bounds.south}, 
                ${input.bounds.east}, ${input.bounds.north}
              ), 4326)
            )` : undefined
          )
        )
        .limit(input.limit);
      
      // Apply server-side privacy filtering
      return result.map(item => filterLocationByVisibility(item, ctx.user));
    }),

  // Get network graph data - computed at runtime
  getProfileNetwork: publicProcedure
    .input(z.object({
      centerProfileId: z.string().optional(),
      maxDegrees: z.number().default(3),
      filters: z.object({
        focusAreas: z.array(z.string()).optional(),
        relationshipTypes: z.array(z.string()).optional()
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      // Return raw profile, relationship, and taxonomy data
      // Graph layout computed client-side for interactive responsiveness
      // No persistent graph position storage needed
    }),

  // Update profile location using existing locations infrastructure
  updateProfileLocation: authenticatedProcedure
    .input(z.object({
      profileId: z.string(),
      locationId: z.string(), // Link to existing location
      // Location preferences handled at runtime, not stored in database
    }))
    .mutation(async ({ input, ctx }) => {
      // Update profile's primary_location_id to link to existing location
      // No additional map settings storage required
    })
};
```

### 5. Routing Integration

#### New Route Structure

```typescript
// apps/app/src/app/[locale]/(main)/map/
├── page.tsx                 // Main map page
├── layout.tsx              // Map-specific layout
└── profile/
    └── [slug]/
        └── page.tsx        // Profile detail view from map
```

#### URL State Management

```typescript
// Support deep linking and shareable URLs
// /en/map?view=geospatial&lat=37.7749&lng=-122.4194&zoom=12&filters=org-type:nonprofit
// /en/map?view=interest-graph&center=profile-123&layout=force&focus=climate-change
```

## UI/UX Design Integration

### 1. Detailed Interaction Patterns & Behaviors

#### Map Interaction Specifications

**Marker Interactions:**
```typescript
// Profile marker states and behaviors
interface MarkerInteractionStates {
  default: {
    scale: 1.0,
    opacity: 0.9,
    cursor: 'pointer',
    zIndex: 100
  },
  hover: {
    scale: 1.15,
    opacity: 1.0,
    cursor: 'pointer',
    zIndex: 200,
    showPreviewTooltip: true,
    transitionDuration: '150ms'
  },
  selected: {
    scale: 1.2,
    opacity: 1.0,
    border: '2px solid hsl(var(--op-teal-500))',
    glow: '0 0 12px hsl(var(--op-teal-500) / 0.3)',
    zIndex: 300
  },
  clustered: {
    showCount: true,
    minRadius: '24px',
    maxRadius: '48px',
    backgroundColor: 'hsl(var(--op-teal-100))',
    textColor: 'hsl(var(--op-teal-700))'
  }
}
```

**Zoom Level Behaviors:**
- **Zoom 1-8**: Show country/region clusters only
- **Zoom 9-12**: Show city-level clusters (3+ profiles)
- **Zoom 13-16**: Show individual markers with clustering for 2+ profiles within 50px
- **Zoom 17+**: Show all individual markers without clustering

**Map Navigation:**
- **Mouse wheel**: Zoom in/out with smooth animation (200ms ease-out)
- **Click + drag**: Pan map with momentum scrolling
- **Double-click**: Zoom in one level centered on click point
- **Shift + drag**: Draw bounding box for area selection

#### Profile Selection & Details

**Single Selection:**
```typescript
// Profile detail presentation modes
interface ProfileDetailModes {
  tooltip: {
    trigger: 'hover',
    delay: 300,
    content: 'name + type + city',
    maxWidth: '200px',
    position: 'above-marker'
  },
  sidebar: {
    trigger: 'click',
    width: '320px',
    position: 'right',
    animation: 'slide-in-right',
    content: 'full-profile-card'
  },
  modal: {
    trigger: 'double-click OR sidebar-expand',
    size: 'medium', // 600px width
    content: 'detailed-profile-view',
    allowEdit: 'if-authorized'
  }
}
```

**Multi-Selection:**
- **Ctrl/Cmd + click**: Add/remove from selection
- **Shift + click**: Select range (in list views)
- **Area selection**: Drag bounding box to select multiple
- **Selection actions**: Compare, export, create relationship

#### View Transition Behaviors

**Geospatial ↔ Interest Graph Transition:**
```typescript
interface ViewTransitionSpec {
  duration: 800, // ms
  easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  steps: [
    { phase: 'preparation', duration: 100, action: 'capture-positions' },
    { phase: 'fade-out-map', duration: 200, action: 'opacity-0' },
    { phase: 'morph-layout', duration: 400, action: 'animate-positions' },
    { phase: 'fade-in-graph', duration: 200, action: 'opacity-1' },
    { phase: 'settle', duration: 100, action: 'micro-bounce' }
  ],
  preserveSelection: true,
  maintainFocus: true
}
```

### 2. Filter & Search Interface Design

#### Filter Panel Specification

**Desktop Layout:**
```typescript
interface FilterPanelDesktop {
  position: 'left-sidebar',
  width: '280px',
  collapsible: true,
  defaultState: 'expanded',
  sections: [
    {
      title: 'Profile Types',
      type: 'checkbox-group',
      options: ['Organizations', 'Individuals'],
      defaultSelected: ['Organizations', 'Individuals']
    },
    {
      title: 'Organization Types',
      type: 'multi-select-dropdown',
      searchable: true,
      options: 'from-taxonomy-terms',
      maxVisible: 5
    },
    {
      title: 'Focus Areas',
      type: 'tag-selector',
      searchable: true,
      options: 'from-taxonomy-terms',
      maxSelected: 8
    },
    {
      title: 'Location',
      type: 'nested-filters',
      subFilters: [
        { type: 'radius-slider', label: 'Within', range: '5-500km' },
        { type: 'country-select', searchable: true },
        { type: 'city-autocomplete', dependent: 'country-select' }
      ]
    },
    {
      title: 'Connections',
      type: 'relationship-filters',
      options: ['Following', 'Followers', 'Collaborators', 'Funders']
    }
  ]
}
```

**Mobile Layout:**
```typescript
interface FilterPanelMobile {
  trigger: 'floating-action-button',
  presentation: 'bottom-sheet',
  height: '60vh',
  sections: 'collapsed-accordions',
  quickFilters: ['Organizations', 'Individuals', 'Near Me'],
  applyButton: { position: 'sticky-bottom', text: 'Apply Filters' }
}
```

#### Search Interface Specification

**Global Search:**
```typescript
interface ProfileSearchSpec {
  position: 'top-center',
  width: { desktop: '400px', mobile: '100%' },
  placeholder: 'Search organizations and people...',
  features: {
    autocomplete: true,
    searchHistory: true,
    recentSearches: 5,
    suggestedSearches: ['nonprofits in SF', 'climate organizations']
  },
  resultTypes: [
    { type: 'profiles', maxResults: 8 },
    { type: 'locations', maxResults: 3 },
    { type: 'focus-areas', maxResults: 3 }
  ],
  resultActions: ['view-on-map', 'view-profile', 'follow']
}
```

### 3. Loading States & Error Handling

#### Progressive Loading Strategy

**Initial Load:**
```typescript
interface LoadingStates {
  skeleton: {
    mapContainer: 'gray-rectangle-shimmer',
    markers: 'pulsing-dots-grid',
    sidebar: 'content-blocks-shimmer',
    duration: 'until-first-data'
  },
  streaming: {
    markersAppear: 'fade-in-batch-of-10',
    batchDelay: 50, // ms between batches
    priorityOrder: ['selected-profile', 'viewport-center', 'viewport-edges']
  },
  dataStates: {
    empty: {
      icon: 'map-search-icon',
      title: 'No profiles found',
      subtitle: 'Try adjusting your filters or search terms',
      actions: ['clear-filters', 'expand-search-area']
    },
    error: {
      icon: 'warning-icon',
      title: 'Unable to load map data',
      subtitle: 'Please check your connection and try again',
      actions: ['retry', 'refresh-page']
    },
    offline: {
      icon: 'offline-icon',
      title: 'You\'re offline',
      subtitle: 'Showing cached profiles from your last visit',
      indicator: 'orange-banner'
    }
  }
}
```

### 4. Responsive Design Specifications

#### Breakpoint Behaviors

**Mobile (320px - 767px):**
```typescript
interface MobileLayout {
  header: {
    height: '56px',
    content: ['menu-button', 'page-title', 'search-button']
  },
  map: {
    fullScreen: true,
    controls: {
      position: 'overlay',
      zoomControls: 'bottom-right',
      viewToggle: 'top-right',
      filterButton: 'top-left'
    }
  },
  profileDetails: {
    presentation: 'bottom-sheet',
    initialHeight: '40vh',
    expandable: true,
    snapPoints: ['40vh', '80vh']
  },
  gestures: {
    pinchZoom: true,
    doubleTapZoom: true,
    longPressSelect: true,
    swipeNavigation: false
  }
}
```

**Tablet (768px - 1023px):**
```typescript
interface TabletLayout {
  orientation: {
    portrait: {
      sidebar: 'bottom-panel',
      height: '30vh',
      collapsible: true
    },
    landscape: {
      sidebar: 'right-panel',
      width: '300px',
      persistent: true
    }
  }
}
```

**Desktop (1024px+):**
```typescript
interface DesktopLayout {
  sidebar: {
    left: 'filters-panel-280px',
    right: 'profile-details-320px',
    both: 'collapsible-independently'
  },
  shortcuts: {
    'Ctrl+F': 'focus-search',
    'Escape': 'clear-selection',
    'Arrow-keys': 'navigate-markers',
    'Enter': 'select-focused-marker'
  }
}
```

### 5. Component Integration with @op/ui

#### Using Existing Components

**Buttons:**
```typescript
// Map control buttons using existing Button variants
<Button variant="icon" size="small" className="map-control">
  <ZoomInIcon />
</Button>

<Button color="secondary" size="medium">
  Switch to Graph View
</Button>

<Button color="primary" size="small">
  Follow
</Button>
```

**Modals & Sheets:**
```typescript
// Profile detail modal using existing Modal component
<Modal isDismissable onClose={handleClose}>
  <ModalHeader>
    <h2 className="title-md">{profile.name}</h2>
  </ModalHeader>
  <ModalContent>
    <ProfileDetailCard profile={profile} />
  </ModalContent>
</Modal>
```

**Filter Controls:**
```typescript
// Multi-select dropdowns for filters
<Select>
  <Label>Organization Type</Label>
  <SelectValue placeholder="Select types..." />
  <SelectContent>
    {organizationTypes.map(type => (
      <SelectItem key={type.id} value={type.id}>
        {type.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 6. Design System Compliance

#### Color Palette Usage
- **Primary Teal (`hsl(var(--op-teal-500))`)**: Selected profiles, active states
- **Yellow (`hsl(var(--op-yellow-500))`)**: Organizations offering funding
- **Orange1 (`hsl(var(--op-orange1-500))`)**: Organizations receiving funding  
- **Orange2 (`hsl(var(--op-orange2-500))`)**: Government organizations
- **Red (`hsl(var(--op-red-500))`)**: Important connections, alerts
- **Neutral Grays**: Background elements, inactive states

#### Typography
- **Title sizes**: Use existing `title-lg`, `title-md`, `title-base` for map elements
- **Body text**: Standard `base` and `sm` sizes for profile information
- **Accent font**: For special labels and highlights

### 2. Responsive Design

#### Breakpoints
- **Mobile (xxs-sm)**: Single column, simplified controls
- **Tablet (md-lg)**: Side panel + map layout
- **Desktop (xl+)**: Full featured interface with detailed panels

#### Mobile Optimizations
- Touch-friendly markers and controls
- Gesture support for pan/zoom
- Simplified filter interface
- Bottom sheet pattern for profile details

### 3. Accessibility

#### ARIA Implementation
```typescript
// Map controls with proper ARIA labels
<button 
  aria-label="Switch to interest graph view"
  aria-pressed={currentView === 'interest-graph'}
  className="map-view-toggle"
>
  <GraphIcon />
</button>

// Profile markers with semantic information
<Marker 
  position={[lat, lng]}
  aria-label={`${profile.name} - ${profile.type} - ${profile.city}`}
  tabIndex={0}
  onKeyDown={handleKeyboardNavigation}
>
```

#### Keyboard Navigation
- Tab through map markers
- Arrow keys for map navigation
- Space/Enter for selection
- Escape to close details

## Animation & Transitions

### 1. View Transition Strategy

#### View Transition Strategy
```typescript
// Transition between geospatial and interest graph views
const transitionToInterestGraph = async () => {
  // 1. Capture current profile positions from Leaflet map
  const mapPositions = captureLeafletMarkerPositions();
  
  // 2. Calculate target positions using force-directed layout
  const graphPositions = calculateForceDirectedLayout(profiles, relationships);
  
  // 3. Animate transition using CSS transforms and opacity
  await animateViewTransition({
    fromView: 'map',
    toView: 'graph',
    elementPositions: {
      map: mapPositions,
      graph: graphPositions
    },
    duration: 800,
    easing: 'ease-in-out'
  });
};
```

### 2. Micro-interactions

- **Hover effects**: Subtle scale and glow on profile markers
- **Selection animations**: Gentle pulse and elevation
- **Filter transitions**: Smooth fade in/out for filtered profiles
- **Loading states**: Skeleton components and progressive disclosure

## Performance Optimization

### 1. Data Loading Strategy

#### PostGIS Optimization & Clustering
```typescript
// Cluster nearby profiles at lower zoom levels using PostGIS
const useProfileClustering = (profiles: ProfileWithLocation[], zoom: number) => {
  return useMemo(() => {
    if (zoom > 12) return profiles; // Show individual profiles at high zoom
    
    // Use PostGIS ST_ClusterKMeans or client-side clustering
    return clusterProfiles(profiles, {
      maxClusterRadius: Math.max(50, (15 - zoom) * 10),
      minClusterSize: 2,
      // Extract coordinates from PostGIS geometry
      getCoordinates: (profile) => ({
        lat: profile.location?.location?.y || 0,
        lng: profile.location?.location?.x || 0
      })
    });
  }, [profiles, zoom]);
};

// Profile data with location information - computed at runtime
const useMapData = (bounds?: MapBounds) => {
  return useSuspenseQuery({
    queryKey: ['map-profiles', bounds],
    queryFn: () => api.map.getProfilesForMap({ bounds }),
    select: (data) => data.map(item => ({
      ...item.profile,
      coordinates: item.location ? {
        // Coordinates already extracted server-side using PostGIS functions
        lat: item.location.latitude,
        lng: item.location.longitude
      } : null,
      fullAddress: item.location?.address,
      locationMetadata: item.location?.metadata,
      // Map preferences computed at runtime
      showOnMap: shouldShowOnMap(item.profile),
      locationVisibility: getLocationVisibility(item.profile)
    })),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
```

#### Progressive Loading
- Load visible map area first
- Preload adjacent areas based on user movement
- Lazy load high-resolution profile images
- Cache graph layouts for common filter combinations

### 2. Bundle Optimization

```typescript
// Code splitting for map components
const GeospatialView = lazy(() => import('./GeospatialView'));
const InterestGraphView = lazy(() => import('./InterestGraphView'));

// Dynamic imports for heavy libraries
const loadLeaflet = () => import('leaflet');
const loadD3 = () => import('d3-force');
```

## Testing Strategy

### 1. Unit Tests

```typescript
// Component testing with React Testing Library
describe('ProfileMarker', () => {
  it('displays profile information correctly', () => {
    render(<ProfileMarker profile={mockProfile} />);
    expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onSelect = jest.fn();
    render(<ProfileMarker profile={mockProfile} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockProfile.id);
  });
});
```

### 2. Integration Tests

```typescript
// API endpoint testing
describe('mapRouter', () => {
  it('returns profiles within geographic bounds', async () => {
    const result = await caller.map.getProfilesForMap({
      bounds: { north: 38, south: 37, east: -122, west: -123 }
    });
    expect(result.profiles).toHaveLength(5);
    expect(result[0].location).toHaveProperty('latitude');
    expect(result[0].location).toHaveProperty('longitude');
  });
});
```

### 3. E2E Tests with Playwright

```typescript
// Test map interactions
test('user can navigate between map views', async ({ page }) => {
  await page.goto('/en/map');
  
  // Test geospatial view
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
  
  // Switch to interest graph
  await page.click('[data-testid="graph-view-toggle"]');
  await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
  
  // Test profile selection
  await page.click('[data-testid="profile-node-123"]');
  await expect(page.locator('[data-testid="profile-details"]')).toBeVisible();
});
```

## Security & Privacy Considerations

### 1. Location Privacy

```typescript
// Location visibility controls
enum LocationVisibility {
  PUBLIC = 'public',      // Exact coordinates visible to all
  NETWORK = 'network',    // Exact coordinates visible to connected profiles
  PRIVATE = 'private'     // Only city-level location shown
}

// Apply privacy filters using server-side computation
const filterLocationByVisibility = (profileData: ProfileWithLocationData, viewer: User) => {
  const { profile, location } = profileData;
  
  // Server-computed privacy rules (can be optimized to database level later)
  const visibility = computeLocationVisibility(profile, viewer);
  const precision = computeLocationPrecision(profile, viewer);
  
  if (visibility === 'public') return profileData;
  if (visibility === 'network' && hasConnection(profile, viewer)) {
    return profileData;
  }
  
  // Return approximate location using server-side computation
  if (location && precision !== 'exact') {
    return {
      ...profileData,
      location: {
        ...location,
        // Use PostGIS functions for server-side approximation
        latitude: sql<number>`ST_Y(ST_Centroid(ST_Buffer(${location.location}, ${getPrecisionRadius(precision)})))`,
        longitude: sql<number>`ST_X(ST_Centroid(ST_Buffer(${location.location}, ${getPrecisionRadius(precision)})))`,
        address: approximateAddressServerSide(location.address, precision)
      }
    };
  }
  
  return {
    ...profileData,
    location: null // Hide location entirely for private settings
  };
};

// Note: For better performance, consider moving privacy filtering to database level
// using row-level security or stored procedures in future iterations;
```

### 2. Access Control

- Use existing access zones for profile visibility
- Implement rate limiting for map data endpoints  
- Validate geographic bounds to prevent data scraping
- Audit trail for location updates

## Deployment & Migration Strategy

### 1. Feature Flag Implementation

```typescript
// Feature flag for gradual rollout
const useFeatureFlag = (flag: string) => {
  return process.env.NODE_ENV === 'development' || 
         process.env[`FEATURE_${flag.toUpperCase()}`] === 'true';
};

// Conditional rendering
if (useFeatureFlag('profiles_map')) {
  return <ProfilesMapView />;
} else {
  return <ComingSoonBanner />;
}
```

### 2. Database Migration Strategy

#### Migration Workflow with Drizzle ORM

**Step 1: Schema Definition**
```typescript
// services/db/schema/tables/profiles.sql.ts
export const profiles = pgTable(
  'profiles',
  {
    // ... existing fields
    primaryLocationId: uuid('primary_location_id').references(() => locations.id),
    // ... rest of schema
  },
  (table) => [
    ...serviceRolePolicies,
    // Add efficient index for location lookups
    index('profiles_primary_location_idx').on(table.primaryLocationId),
    // ... existing indexes
  ],
);
```

**Step 2: Generate Migration**
```bash
# Generate migration files from schema changes
pnpm w:db generate
# This creates a new file like: migrations/0009_migration_name.sql
```

**Step 3: Migration Execution Plan**
```sql
-- Generated migration file will contain:
ALTER TABLE "profiles" ADD COLUMN "primary_location_id" uuid;
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_primary_location_id_locations_id_fk" 
  FOREIGN KEY ("primary_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "profiles_primary_location_idx" ON "profiles" USING btree ("primary_location_id");
```

**Step 4: Data Migration Strategy**
```sql
-- Post-migration data population (separate script)
-- Link organizations to their primary work location
UPDATE profiles 
SET primary_location_id = (
  SELECT l.id 
  FROM organizations o
  JOIN organizations_where_we_work owww ON o.id = owww.organization_id
  JOIN locations l ON owww.location_id = l.id
  WHERE o.profile_id = profiles.id
  ORDER BY l.created_at ASC  -- Use oldest/first location as primary
  LIMIT 1
)
WHERE profiles.type = 'org' 
AND profiles.primary_location_id IS NULL;

-- For individuals, use address fields to geocode if available
-- This would be handled by a custom script using existing geocoding service
```

#### Migration Considerations

**Safety & Rollback:**
- **Non-destructive**: Adding nullable foreign key is safe for existing data
- **Backward compatible**: Existing queries continue to work
- **Rollback plan**: Can safely remove column if needed during development
- **Index performance**: BTREE index on UUID is efficient for lookups

**Production Deployment:**
```bash
# Staging verification
pnpm w:db migrate:test  # Test with staging database

# Production deployment
pnpm w:db migrate       # Apply to production database

# Verify migration
pnpm w:db studio        # Use Drizzle Studio to inspect schema
```

**PostGIS Specific Considerations:**
- **Extension dependency**: PostGIS already enabled in initial migration (`0000_equal_silverclaw.sql`)
- **Spatial indexes**: Existing `locations` table already has optimized PostGIS geometry indexing
- **SRID consistency**: All spatial operations use SRID 4326 (WGS84) for consistency
- **Performance**: PostGIS spatial functions are optimized for the existing geometry column

*No additional tables needed - all map preferences and graph positions computed at runtime*

### 3. Rollout Phases

1. **Phase 1**: Internal testing with feature flag
2. **Phase 2**: Beta release to select organizations
3. **Phase 3**: Gradual rollout to all users
4. **Phase 4**: Performance optimization based on usage data

## Sample Test Data Generation

### 1. Seed Data Script

```typescript
// services/db/scripts/create-map-test-data.ts
export const generateMapTestData = async () => {
  // Major cities with coordinates for realistic distribution
  const cities = [
    { name: 'San Francisco', lat: 37.7749, lng: -122.4194, country: 'US', neighborhoods: 5 },
    { name: 'New York', lat: 40.7128, lng: -74.0060, country: 'US', neighborhoods: 8 },
    { name: 'London', lat: 51.5074, lng: -0.1278, country: 'GB', neighborhoods: 6 },
    { name: 'Berlin', lat: 52.5200, lng: 13.4050, country: 'DE', neighborhoods: 4 },
    { name: 'Toronto', lat: 43.6532, lng: -79.3832, country: 'CA', neighborhoods: 5 },
    { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, country: 'NL', neighborhoods: 3 },
    { name: 'Seattle', lat: 47.6062, lng: -122.3321, country: 'US', neighborhoods: 4 },
    { name: 'Austin', lat: 30.2672, lng: -97.7431, country: 'US', neighborhoods: 3 }
  ];

  for (const city of cities) {
    // Create multiple location points within each city for realistic distribution
    const cityLocations = [];
    
    for (let i = 0; i < city.neighborhoods; i++) {
      // Add slight random offset to create neighborhood clusters
      const offsetLat = city.lat + (Math.random() - 0.5) * 0.05; // ~2.5km radius
      const offsetLng = city.lng + (Math.random() - 0.5) * 0.05;
      
      const locationId = await createLocation({
        name: `${city.name} ${getNeighborhoodName(i)}`,
        location: sql`ST_SetSRID(ST_MakePoint(${offsetLng}, ${offsetLat}), 4326)`,
        address: `${getNeighborhoodName(i)}, ${city.name}`,
        countryCode: city.country,
        countryName: getCountryName(city.country),
        placeId: `${city.name.toLowerCase()}-${i}-${Date.now()}`,
        metadata: {
          cityCenter: { lat: city.lat, lng: city.lng },
          neighborhood: getNeighborhoodName(i)
        }
      });
      
      cityLocations.push(locationId);
    }
    
    // Create organizations distributed across city locations
    await createTestOrganizations({
      cityName: city.name,
      locationIds: cityLocations,
      count: randomBetween(12, 18),
      types: ['nonprofit', 'forprofit', 'government'],
      focusAreas: ['climate-change', 'education', 'healthcare', 'housing', 'technology', 'arts']
    });
    
    // Create individuals distributed across the same locations
    await createTestIndividuals({
      cityName: city.name,
      locationIds: cityLocations,
      count: randomBetween(25, 40), // More individuals than organizations
      roles: ['activist', 'researcher', 'founder', 'volunteer', 'consultant'],
      focusAreas: ['climate-change', 'education', 'healthcare', 'housing', 'technology', 'arts', 'policy']
    });
  }
  
  // Create realistic relationship networks
  await createTestRelationships({
    connectionProbability: 0.15, // 15% chance of connection
    preferSameCity: 0.7,         // 70% of connections within same city
    preferSameFocus: 0.8,        // 80% of connections within same focus area
    orgToIndividualRatio: 0.6    // 60% chance org-individual vs org-org connections
  });
};

// Helper function to create individual profiles with locations
const createTestIndividuals = async ({
  cityName,
  locationIds,
  count,
  roles,
  focusAreas
}: {
  cityName: string;
  locationIds: string[];
  count: number;
  roles: string[];
  focusAreas: string[];
}) => {
  const individualNames = [
    'Alex Chen', 'Maria Rodriguez', 'David Kim', 'Sarah Johnson', 'Ahmed Hassan',
    'Emma Thompson', 'Luis Garcia', 'Priya Patel', 'James Wilson', 'Anna Kowalski',
    'Michael Brown', 'Lisa Chang', 'Omar Al-Rashid', 'Elena Volkov', 'John Smith',
    'Maya Singh', 'Carlos Mendoza', 'Sophie Martin', 'Ryan O\'Connor', 'Zara Ali',
    'Benjamin Lee', 'Fatima Al-Zahra', 'Lucas Silva', 'Nora Andersson', 'Kenji Tanaka',
    'Isabella Rossi', 'Dmitri Petrov', 'Amara Okafor', 'Sebastian Mueller', 'Lila Sharma'
  ];

  for (let i = 0; i < count; i++) {
    const name = individualNames[i % individualNames.length];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const locationId = locationIds[Math.floor(Math.random() * locationIds.length)];
    const selectedFocusAreas = getRandomSubset(focusAreas, randomBetween(1, 3));
    
    // Create individual profile
    const [profile] = await db
      .insert(profiles)
      .values({
        type: 'individual',
        name: `${name} (${role})`,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${cityName.toLowerCase()}-${i}`,
        bio: generateIndividualBio(name, role, selectedFocusAreas),
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        primaryLocationId: locationId,
        // Add some address info for realism
        city: cityName,
        address: `${Math.floor(Math.random() * 9999) + 1} ${getStreetName()} ${getStreetType()}`
      })
      .returning();

    // Create individual record
    await db
      .insert(individuals)
      .values({
        profileId: profile.id,
        // Add individual-specific fields if they exist in schema
      });

    // Link individual to focus areas
    if (selectedFocusAreas.length > 0) {
      const focusAreaTerms = await getFocusAreaTermIds(selectedFocusAreas);
      await Promise.all(
        focusAreaTerms.map(termId =>
          db
            .insert(individualsTerms) // Assuming similar table exists for individuals
            .values({
              individualId: profile.id,
              taxonomyTermId: termId
            })
            .onConflictDoNothing()
        )
      );
    }
  }
};

// Helper functions for realistic data generation
const getNeighborhoodName = (index: number): string => {
  const neighborhoods = [
    'Downtown', 'Midtown', 'Uptown', 'Riverside', 'Hillside', 
    'Westside', 'Eastside', 'Northbank', 'Southshore', 'Central'
  ];
  return neighborhoods[index % neighborhoods.length];
};

const generateIndividualBio = (name: string, role: string, focusAreas: string[]): string => {
  const templates = [
    `${name} is a ${role} focused on ${focusAreas.join(' and ')}. Passionate about creating positive change in the community.`,
    `Experienced ${role} working at the intersection of ${focusAreas.join(', ')} with over 5 years in the field.`,
    `${name} brings expertise in ${focusAreas.join(' & ')} to drive innovative solutions as a ${role}.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
};

const getStreetName = (): string => {
  const streets = [
    'Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Park', 'Washington', 
    'First', 'Second', 'Third', 'Broadway', 'Market', 'Spring', 'River'
  ];
  return streets[Math.floor(Math.random() * streets.length)];
};

const getStreetType = (): string => {
  const types = ['St', 'Ave', 'Blvd', 'Way', 'Dr', 'Ln', 'Rd'];
  return types[Math.floor(Math.random() * types.length)];
};

const getRandomSubset = <T>(array: T[], maxItems: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, maxItems);
};

const randomBetween = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
```

## Future Enhancements

- **Decision process mapping**: Show where decisions are being made
- **Project collaboration**: Visualize project partnerships
- **Resource sharing**: Map available resources and needs
- **Social impact**: Visualize collective impact across regions

## Conclusion

## Architecture Benefits Summary

### ✅ Advantages of Using Existing `locations` Table

**1. Data Integrity & Performance**
- Leverages existing PostGIS spatial indexing (`GIST` index on `location` geometry)
- Maintains data normalization and consistency
- Reuses established geocoding and validation infrastructure
- Optimized spatial queries (`ST_Within`, `ST_Distance`, `ST_DWithin`)

**2. Schema Consistency**
- Integrates with existing `organizationsWhereWeWork` pattern
- Single source of truth for geographic data
- Rich location metadata (address, country, plusCode)
- Future-ready for multiple locations per profile

**3. Development Efficiency**
- No duplicate location storage or maintenance
- Leverages existing location management APIs
- Consistent with current database patterns
- Easier migration path from existing data

### ⚠️ Trade-offs Addressed

**Query Complexity**: Mitigated by proper indexing and efficient JOIN patterns
**Multiple Locations**: Handled through `primary_location_id` with override capabilities
**Performance**: PostGIS spatial optimization outweighs JOIN overhead

## Conclusion

This comprehensive plan provides a robust foundation for implementing the Profiles Map feature while maintaining consistency with the existing codebase architecture and leveraging the powerful PostGIS spatial capabilities already in place. The modular approach allows for iterative development and future enhancements while ensuring optimal performance and user experience.

The combination of geospatial and interest-based views will provide users with powerful tools to discover connections, explore networks, and understand the geographic distribution of the community's impact.