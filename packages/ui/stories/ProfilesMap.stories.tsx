import type { Meta, StoryObj } from '@storybook/react';
import dynamic from 'next/dynamic';

// Mock the leaflet-dependent functions for Storybook
const mockCreateCustomMarker = ({ profileType }: { profileType: 'individual' | 'organization' }) => {
  const isOrg = profileType === 'organization';
  const size = isOrg ? 36 : 28;
  const color = isOrg ? '#14B8A6' : '#059669';
  
  return {
    options: {
      html: `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          ${isOrg 
            ? `<rect x="2" y="2" width="32" height="32" fill="${color}" stroke="white" stroke-width="2" rx="6"/>` 
            : `<circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>`
          }
        </svg>
      `
    }
  };
};

const mockCreateClusterCustomIcon = (cluster: any) => {
  const count = typeof cluster.getChildCount === 'function' ? cluster.getChildCount() : 5;
  const size = 40 + Math.min(count * 2, 20);
  
  return {
    options: {
      html: `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="#14B8A6" stroke="white" stroke-width="2"/>
          <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-size="14" font-weight="bold">
            ${count}
          </text>
        </svg>
      `
    }
  };
};

// Mock profile data for demonstration with enhanced information
const mockProfiles = [
  { 
    id: '1', 
    name: 'TechCorp Inc', 
    type: 'organization' as const, 
    latitude: 40.7128, 
    longitude: -74.0060, 
    description: 'Leading technology company specializing in innovative software solutions and digital transformation.',
    location: 'Manhattan, NY',
    website: 'https://techcorp.example.com',
    email: 'contact@techcorp.com'
  },
  { 
    id: '2', 
    name: 'John Smith', 
    type: 'individual' as const, 
    latitude: 40.7138, 
    longitude: -74.0070, 
    description: 'Senior Software Engineer with 8+ years of experience in full-stack development.',
    location: 'New York, NY',
    website: 'https://johnsmith.dev',
    email: 'john@example.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  },
  { 
    id: '3', 
    name: 'Sarah Johnson', 
    type: 'individual' as const, 
    latitude: 40.7148, 
    longitude: -74.0080, 
    description: 'Product Manager passionate about creating user-centric digital experiences.',
    location: 'Brooklyn, NY',
    email: 'sarah@example.com',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
  },
  { 
    id: '4', 
    name: 'Innovate Labs', 
    type: 'organization' as const, 
    latitude: 40.7158, 
    longitude: -74.0090, 
    description: 'Research & Development company focused on emerging technologies and innovation.',
    location: 'Lower Manhattan, NY',
    website: 'https://innovatelabs.com',
    email: 'info@innovatelabs.com'
  },
  { 
    id: '5', 
    name: 'Mike Wilson', 
    type: 'individual' as const, 
    latitude: 40.7168, 
    longitude: -74.0100, 
    description: 'UX Designer specializing in mobile applications and user research.',
    location: 'Queens, NY',
    website: 'https://mikewilson.design',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  { 
    id: '6', 
    name: 'DataWorks', 
    type: 'organization' as const, 
    latitude: 40.7178, 
    longitude: -74.0110, 
    description: 'Data Analytics company providing insights and business intelligence solutions.',
    location: 'Midtown, NY',
    website: 'https://dataworks.com',
    email: 'hello@dataworks.com'
  },
  { 
    id: '7', 
    name: 'Emily Chen', 
    type: 'individual' as const, 
    latitude: 40.7188, 
    longitude: -74.0120, 
    description: 'Data Scientist with expertise in machine learning and artificial intelligence.',
    location: 'Manhattan, NY',
    email: 'emily@example.com',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
  },
  { 
    id: '8', 
    name: 'Cloud Solutions', 
    type: 'organization' as const, 
    latitude: 40.7198, 
    longitude: -74.0130, 
    description: 'Cloud infrastructure and services provider for modern applications.',
    location: 'Financial District, NY',
    website: 'https://cloudsolutions.com',
    email: 'support@cloudsolutions.com'
  },
  { 
    id: '9', 
    name: 'Alex Rodriguez', 
    type: 'individual' as const, 
    latitude: 40.7208, 
    longitude: -74.0140, 
    description: 'DevOps Engineer focused on automation, CI/CD, and cloud infrastructure.',
    location: 'Staten Island, NY',
    website: 'https://alexrodriguez.tech',
    email: 'alex@example.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face'
  },
  { 
    id: '10', 
    name: 'FutureTech', 
    type: 'organization' as const, 
    latitude: 40.7218, 
    longitude: -74.0150, 
    description: 'AI Research company developing next-generation artificial intelligence solutions.',
    location: 'Chelsea, NY',
    website: 'https://futuretech.ai',
    email: 'research@futuretech.ai'
  }
];

// Dynamically import the interactive map component
const InteractiveMapDemo = dynamic(() => import('./InteractiveMapDemo'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-neutral-100 flex items-center justify-center">Loading map...</div>
});

// Show the map components in Storybook
const MapComponentsDemo = () => {
  return (
    <div className="h-screen w-full bg-neutral-50 p-4">
      <div className="mb-6 bg-white p-6 shadow-sm rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Profiles Map Components</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Reusable map components extracted from the main app. These components handle
          marker creation, clustering, and map synchronization without complex state.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Custom Marker Demo */}
          <div className="bg-neutral-50 p-4 rounded-lg border">
            <h3 className="font-medium mb-3">Custom Markers</h3>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div 
                  className="w-9 h-9 bg-teal-500 rounded-lg border-2 border-white shadow-lg flex items-center justify-center"
                  dangerouslySetInnerHTML={{ 
                    __html: mockCreateCustomMarker({ profileType: 'organization' }).options.html || '' 
                  }}
                />
                <span className="text-xs text-neutral-600 mt-1">Organization</span>
              </div>
              <div className="flex flex-col items-center">
                <div 
                  className="w-7 h-7 bg-teal-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                  dangerouslySetInnerHTML={{ 
                    __html: mockCreateCustomMarker({ profileType: 'individual' }).options.html || '' 
                  }}
                />
                <span className="text-xs text-neutral-600 mt-1">Individual</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Different marker styles for organizations (square) and individuals (circle)
            </p>
          </div>

          {/* Cluster Icon Demo */}
          <div className="bg-neutral-50 p-4 rounded-lg border">
            <h3 className="font-medium mb-3">Cluster Icons</h3>
            <div className="flex items-center gap-4">
              {[5, 15, 42].map((count) => (
                <div key={count} className="flex flex-col items-center">
                  <div 
                    className="w-12 h-12 bg-teal-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                    dangerouslySetInnerHTML={{ 
                      __html: mockCreateClusterCustomIcon({ getChildCount: () => count }).options.html || '' 
                    }}
                  />
                  <span className="text-xs text-neutral-600 mt-1">{count} profiles</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Dynamic cluster icons that scale based on profile count
            </p>
          </div>
        </div>

        {/* MapViewSync Info */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">MapViewSync Component</h3>
          <p className="text-sm text-blue-700">
            The <code className="bg-blue-100 px-1 py-0.5 rounded">MapViewSync</code> component handles 
            map view synchronization with debounced bounds updates. It manages:
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1">
            <li>• Initial map position synchronization</li>
            <li>• Debounced bounds updates (300ms)</li>
            <li>• Map movement tracking</li>
            <li>• Prevent infinite update loops</li>
          </ul>
        </div>
      </div>

      {/* Interactive Map Demo */}
      <div className="bg-white p-6 shadow-sm rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Interactive Map Demo</h2>
        <p className="text-sm text-neutral-600 mb-4">
          This interactive map demonstrates the complete integration of all map components 
          using real leaflet and react-leaflet with mock profile data.
        </p>
        
        <div className="h-96 border rounded-lg overflow-hidden">
          <InteractiveMapDemo profiles={mockProfiles} />
        </div>

      </div>
    </div>
  );
};

const meta: Meta<typeof MapComponentsDemo> = {
  title: 'Components/ProfilesMap',
  component: MapComponentsDemo,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof MapComponentsDemo>;

export const MapComponents: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Reusable map components for the Profiles Map feature. These components handle marker creation, clustering, and map synchronization without complex state management.',
      },
    },
  },
};