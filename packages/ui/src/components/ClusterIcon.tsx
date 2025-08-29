'use client';

// Leaflet is a peer dependency - handle cases where it might not be available
let L: any;
try {
  L = require('leaflet');
} catch {
  // Leaflet not available (e.g., in Storybook)
  L = null;
}

export function createClusterCustomIcon(cluster: any) {
  try {
    const count = cluster && typeof cluster.getChildCount === 'function' ? cluster.getChildCount() : 5;
    const size = 40 + Math.min(count * 2, 20); // Scale size based on count
    
    // Use unique filter ID to avoid conflicts
    const filterId = `cluster-shadow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const svgIcon = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/>
          </filter>
        </defs>
        
        <!-- Outer circle -->
        <circle 
          cx="${size/2}" 
          cy="${size/2}" 
          r="${size/2 - 2}" 
          fill="#14B8A6" 
          stroke="white" 
          stroke-width="2"
          filter="url(#${filterId})"
        />
        
        <!-- Count text -->
        <text 
          x="${size/2}" 
          y="${size/2 + 4}" 
          text-anchor="middle" 
          fill="white" 
          font-size="14" 
          font-weight="bold"
          font-family="system-ui, -apple-system, sans-serif"
        >
          ${count}
        </text>
      </svg>
    `;

    if (!L) {
      // Return a mock object when leaflet is not available
      return {
        options: { 
          html: svgIcon, 
          className: 'custom-cluster-marker',
          iconSize: [size, size],
          iconAnchor: [size/2, size/2],
        },
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        createIcon: () => {
          const div = document.createElement('div');
          div.innerHTML = svgIcon;
          div.className = 'custom-cluster-marker';
          div.style.width = `${size}px`;
          div.style.height = `${size}px`;
          return div;
        },
        createShadow: () => null,
      } as any;
    }

    const icon = L.divIcon({
      html: svgIcon,
      className: 'custom-cluster-marker',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
    
    // Add cleanup method
    if (icon && typeof icon === 'object') {
      (icon as any)._cleanup = () => {
        try {
          const elements = document.querySelectorAll('.custom-cluster-marker');
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
    console.warn('Error creating cluster icon:', error);
    // Fallback icon
    const fallbackSize = 40;
    const fallbackSvg = `
      <svg width="${fallbackSize}" height="${fallbackSize}" viewBox="0 0 ${fallbackSize} ${fallbackSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${fallbackSize/2}" cy="${fallbackSize/2}" r="${fallbackSize/2 - 2}" fill="#14B8A6" stroke="white" stroke-width="2"/>
        <text x="${fallbackSize/2}" y="${fallbackSize/2 + 4}" text-anchor="middle" fill="white" font-size="14" font-weight="bold">?</text>
      </svg>
    `;
    
    return {
      options: { 
        html: fallbackSvg, 
        className: 'custom-cluster-marker',
        iconSize: [fallbackSize, fallbackSize],
        iconAnchor: [fallbackSize/2, fallbackSize/2],
      },
      iconSize: [fallbackSize, fallbackSize],
      iconAnchor: [fallbackSize/2, fallbackSize/2],
      createIcon: () => {
        const div = document.createElement('div');
        div.innerHTML = fallbackSvg;
        div.className = 'custom-cluster-marker';
        div.style.width = `${fallbackSize}px`;
        div.style.height = `${fallbackSize}px`;
        return div;
      },
      createShadow: () => null,
    } as any;
  }
}