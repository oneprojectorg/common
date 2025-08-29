'use client';

import { X } from 'lucide-react';

import { Button } from '@op/ui/Button';
import { Avatar } from '@op/ui/Avatar';
import { Skeleton } from '@op/ui/Skeleton';
import { trpc } from '@op/api/client';

interface ProfileCardProps {
  profileId: string;
  onClose: () => void;
}

export function ProfileCard({ profileId, onClose }: ProfileCardProps) {
  const { data: profile, isLoading, error } = trpc.profile.getById.useQuery({ 
    id: profileId 
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <Skeleton className="h-6 w-32" />
          <Button
            variant="icon"
            size="small"
            onPress={onClose}
            aria-label="Close profile"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-col items-center text-center">
            <Skeleton className="h-20 w-20 rounded-full mb-4" />
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Profile Details</h2>
          <Button
            variant="icon"
            size="small"
            onPress={onClose}
            aria-label="Close profile"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Unable to load profile</p>
            <p className="text-sm text-gray-500">Please try again later</p>
          </div>
        </div>
      </div>
    );
  }

  // Get location from city/state
  const location = [profile.city, profile.state].filter(Boolean).join(', ');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Profile Details</h2>
        <Button
          variant="icon"
          size="small"
          onPress={onClose}
          aria-label="Close profile"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center text-center">
          <Avatar
            placeholder={profile.name}
            className="mb-4"
          />
          
          <h3 className="text-xl font-semibold">{profile.name}</h3>
          
          {location && (
            <p className="mt-1 text-sm text-gray-500">
              📍 {location}
            </p>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-6">
            <h4 className="mb-2 font-medium text-gray-900">About</h4>
            <p className="text-sm text-gray-600">{profile.bio}</p>
          </div>
        )}

        {/* Mission (for organizations) */}
        {profile.mission && (
          <div className="mt-6">
            <h4 className="mb-2 font-medium text-gray-900">Mission</h4>
            <p className="text-sm text-gray-600">{profile.mission}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 space-y-2">
          <Button className="w-full">
            View Full Profile
          </Button>
          {profile.email && (
            <Button className="w-full">
              Send Message
            </Button>
          )}
          <Button className="w-full">
            Connect
          </Button>
        </div>

        {/* Contact Info */}
        {(profile.email || profile.website) && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="mb-2 font-medium text-gray-900">Contact</h4>
            <div className="space-y-1 text-sm text-gray-600">
              {profile.email && (
                <div>📧 {profile.email}</div>
              )}
              {profile.website && (
                <div>🌐 {profile.website}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}