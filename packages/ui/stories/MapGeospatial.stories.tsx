import type { Meta } from '@storybook/react';
import { MapGeospatial } from '../src/components/MapGeospatial';


const meta: Meta<typeof MapGeospatial> = {
  title: 'Components/Profiles Map',
  component: MapGeospatial,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;


// Show the map components in Storybook
export const Example = () => (
  <div style={{ width: '800px', height: '600px' }}>
    <MapGeospatial profiles={mockProfiles} />
  </div>
);


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
    latitude: 40.7158,
    longitude: -74.0090,
    description: 'UX Designer specializing in mobile applications and user research.',
    location: 'Queens, NY',
    website: 'https://mikewilson.design',
    email: 'mike@example.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: '6',
    name: 'DataWorks',
    type: 'organization' as const,
    latitude: 40.7158,
    longitude: -74.0090,
    description: 'Data Analytics company providing insights and business intelligence solutions.',
    location: 'Midtown, NY',
    website: 'https://dataworks.com',
    email: 'hello@dataworks.com'
  },
  {
    id: '7',
    name: 'Emily Chen',
    type: 'individual' as const,
    latitude: 40.7158,
    longitude: -74.0090,
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
