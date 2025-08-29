'use client';

// Leaflet is a peer dependency - handle cases where it might not be available
let L: any;
try {
  L = require('leaflet');
} catch {
  // Leaflet not available (e.g., in Storybook)
  L = null;
}

export interface CustomMarkerProps {
  profileType: 'individual' | 'organization';
}

export function createCustomMarker({ profileType }: CustomMarkerProps) {
  const isOrg = profileType === 'organization';
  const size = isOrg ? 36 : 28;
  const strokeWidth = 2;
  const innerSize = size - (strokeWidth * 2);
  
  const orgColor = '#14B8A6'; // teal-500 for organizations
  const individualColor = '#059669'; // teal-600 for individuals
  const color = isOrg ? orgColor : individualColor;
  
  // Use unique filter IDs to avoid conflicts in Storybook
  const filterId = `shadow-${profileType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const svgIcon = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/>
        </filter>
      </defs>
      
      <!-- Outer shape -->
      ${isOrg 
        ? `<rect 
             x="${strokeWidth}" 
             y="${strokeWidth}" 
             width="${innerSize}" 
             height="${innerSize}" 
             fill="${color}" 
             stroke="white" 
             stroke-width="${strokeWidth}"
             rx="6"
             filter="url(#${filterId})"
           />` 
        : `<circle 
             cx="${size/2}" 
             cy="${size/2}" 
             r="${innerSize/2}" 
             fill="${color}" 
             stroke="white" 
             stroke-width="${strokeWidth}"
             filter="url(#${filterId})"
           />`
      }
      
      <!-- Inner icon -->
      ${isOrg 
        ? `<!-- Building icon for organizations -->
           <g fill="white" transform="translate(${size/2 - 8}, ${size/2 - 8})">
             <rect x="2" y="4" width="12" height="12" rx="1"/>
             <rect x="4" y="6" width="2" height="2" fill="${color}"/>
             <rect x="7" y="6" width="2" height="2" fill="${color}"/>
             <rect x="10" y="6" width="2" height="2" fill="${color}"/>
             <rect x="4" y="9" width="2" height="2" fill="${color}"/>
             <rect x="7" y="9" width="2" height="2" fill="${color}"/>
             <rect x="10" y="9" width="2" height="2" fill="${color}"/>
             <rect x="4" y="12" width="2" height="2" fill="${color}"/>
             <rect x="10" y="12" width="2" height="2" fill="${color}"/>
           </g>` 
        : `<!-- Person icon for individuals -->
           <g fill="white" transform="translate(${size/2 - 6}, ${size/2 - 8})">
             <circle cx="6" cy="4" r="2.5"/>
             <path d="M2 12c0-2.2 1.8-4 4-4s4 1.8 4 4v2H2v-2z"/>
           </g>`
      }
    </svg>
  `;

  if (!L) {
    // Return a mock object when leaflet is not available
    return {
      options: { 
        html: svgIcon, 
        className: `custom-marker ${profileType}`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2],
      },
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
      createIcon: () => {
        const div = document.createElement('div');
        div.innerHTML = svgIcon;
        div.className = `custom-marker ${profileType}`;
        div.style.width = `${size}px`;
        div.style.height = `${size}px`;
        return div;
      },
      createShadow: () => null,
    } as any;
  }

  try {
    const icon = L.divIcon({
      html: svgIcon,
      className: `custom-marker ${profileType}`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
    });
    
    // Add a cleanup method to prevent memory leaks
    if (icon && typeof icon === 'object') {
      (icon as any)._cleanup = () => {
        // Clean up any DOM references
        try {
          const elements = document.querySelectorAll(`.custom-marker.${profileType}`);
          elements.forEach(el => {
            if ((el as any)._leaflet_events) {
              delete (el as any)._leaflet_events;
            }
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      };
    }
    
    return icon;
  } catch (error) {
    console.warn('Error creating custom marker:', error);
    return {
      options: { 
        html: svgIcon, 
        className: `custom-marker ${profileType}`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2],
      },
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
      createIcon: () => {
        const div = document.createElement('div');
        div.innerHTML = svgIcon;
        div.className = `custom-marker ${profileType}`;
        div.style.width = `${size}px`;
        div.style.height = `${size}px`;
        return div;
      },
      createShadow: () => null,
    } as any;
  }
}