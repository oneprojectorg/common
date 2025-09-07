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
  }
};

export const IndividualProfile: Story = {
  args: {
    profile: sampleIndividual,
  }
};

export const WithAvatar: Story = {
  args: {
    profile: sampleWithAvatar,
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
  }
};
