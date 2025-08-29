import type { Meta, StoryObj } from '@storybook/react';
import { ProfilePopup } from '../src/components/ProfilePopup';

const meta: Meta<typeof ProfilePopup> = {
  title: 'Components/ProfilePopup',
  component: ProfilePopup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    showCoordinates: {
      control: 'boolean',
      description: 'Whether to show latitude and longitude coordinates'
    },
    compact: {
      control: 'boolean',
      description: 'Use compact layout for smaller popups'
    },
    onContactClick: { action: 'contact clicked' },
    onViewProfileClick: { action: 'view profile clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof ProfilePopup>;

// Sample profile data
const sampleOrganization = {
  id: '1',
  name: 'TechCorp Inc',
  type: 'organization' as const,
  latitude: 40.7128,
  longitude: -74.0060,
  description: 'Leading technology company specializing in innovative software solutions and digital transformation.',
  location: 'New York, NY',
  website: 'https://techcorp.example.com',
  email: 'contact@techcorp.example.com'
};

const sampleIndividual = {
  id: '2',
  name: 'Sarah Johnson',
  type: 'individual' as const,
  latitude: 40.7138,
  longitude: -74.0070,
  description: 'Senior Product Manager with 8+ years of experience in building user-centric digital products.',
  location: 'Brooklyn, NY',
  website: 'https://sarahjohnson.dev',
  email: 'sarah@example.com'
};

const sampleWithAvatar = {
  ...sampleIndividual,
  id: '3',
  name: 'John Smith',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
};

export const OrganizationProfile: Story = {
  args: {
    profile: sampleOrganization,
    showCoordinates: true,
    compact: false
  }
};

export const IndividualProfile: Story = {
  args: {
    profile: sampleIndividual,
    showCoordinates: true,
    compact: false
  }
};

export const WithAvatar: Story = {
  args: {
    profile: sampleWithAvatar,
    showCoordinates: true,
    compact: false
  }
};

export const CompactLayout: Story = {
  args: {
    profile: sampleOrganization,
    showCoordinates: false,
    compact: true
  }
};

export const WithoutCoordinates: Story = {
  args: {
    profile: sampleIndividual,
    showCoordinates: false,
    compact: false
  }
};

export const WithActions: Story = {
  args: {
    profile: sampleOrganization,
    showCoordinates: true,
    compact: false,
    onContactClick: (profile) => console.log('Contact clicked:', profile),
    onViewProfileClick: (profile) => console.log('View profile clicked:', profile)
  }
};

export const MinimalData: Story = {
  args: {
    profile: {
      id: '4',
      name: 'Basic Profile',
      type: 'individual' as const,
      latitude: 40.7148,
      longitude: -74.0080,
      description: 'A simple profile with minimal information.'
    },
    showCoordinates: true,
    compact: false
  }
};

// Showcase different variations
export const AllVariations: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 max-w-4xl">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Organization Profiles</h3>
        
        <div className="border border-neutral-200 rounded-lg p-2 bg-white shadow-sm">
          <h4 className="text-sm font-medium mb-2">Standard Organization</h4>
          <ProfilePopup 
            profile={sampleOrganization} 
            showCoordinates={true}
            onContactClick={(profile) => console.log('Contact:', profile)}
            onViewProfileClick={(profile) => console.log('View:', profile)}
          />
        </div>
        
        <div className="border border-neutral-200 rounded-lg p-2 bg-white shadow-sm">
          <h4 className="text-sm font-medium mb-2">Compact Organization</h4>
          <ProfilePopup 
            profile={sampleOrganization} 
            compact={true}
            showCoordinates={false}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Individual Profiles</h3>
        
        <div className="border border-neutral-200 rounded-lg p-2 bg-white shadow-sm">
          <h4 className="text-sm font-medium mb-2">With Avatar</h4>
          <ProfilePopup 
            profile={sampleWithAvatar} 
            showCoordinates={true}
            onContactClick={(profile) => console.log('Contact:', profile)}
          />
        </div>
        
        <div className="border border-neutral-200 rounded-lg p-2 bg-white shadow-sm">
          <h4 className="text-sm font-medium mb-2">Minimal Info</h4>
          <ProfilePopup 
            profile={{
              id: '5',
              name: 'Jane Doe',
              type: 'individual' as const,
              latitude: 40.7158,
              longitude: -74.0090,
              description: 'Software developer passionate about creating amazing user experiences.'
            }}
            showCoordinates={false}
            compact={true}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'A comprehensive showcase of different ProfilePopup variations and configurations.'
      }
    }
  }
};