'use client';

export interface ProfilePopupData {
  id: string;
  name: string;
  type: 'individual' | 'organization';
  latitude: number;
  longitude: number;
  description: string;
  avatar?: string;
  location?: string;
  website?: string;
  email?: string;
}

export interface ProfilePopupProps {
  profile: ProfilePopupData;
  showCoordinates?: boolean;
  compact?: boolean;
  onContactClick?: (profile: ProfilePopupData) => void;
  onViewProfileClick?: (profile: ProfilePopupData) => void;
}

export function ProfilePopup({ 
  profile, 
  onContactClick,
  onViewProfileClick
}: ProfilePopupProps) {
  const isOrganization = profile.type === 'organization';
  
  return (
    <div className="bg-white p-4 min-w-[240px] max-w-[320px]">
      {/* Header with avatar and basic info */}
      <div className="flex items-start gap-3 mb-3">
        {profile.avatar ? (
          <img 
            src={profile.avatar} 
            alt={profile.name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isOrganization ? 'bg-teal-500' : 'bg-teal-600'
          }`}>
            <span className="text-white text-xs font-medium">
              {isOrganization ? '🏢' : '👤'}
            </span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-neutral-900 mb-1 truncate">
            {profile.name}
          </h3>
          <div className="flex items-center gap-1 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isOrganization 
                ? 'bg-teal-100 text-teal-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {isOrganization ? 'Organization' : 'Individual'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
        {profile.description}
      </p>

      {/* Additional Info */}
      <div className="space-y-2 mb-3">
        {profile.location && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>📍</span>
            <span className="truncate">{profile.location}</span>
          </div>
        )}
        {profile.website && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>🌐</span>
            <a 
              href={profile.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-teal-600 hover:text-teal-700 truncate"
            >
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        {profile.email && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>✉️</span>
            <a 
              href={`mailto:${profile.email}`}
              className="text-teal-600 hover:text-teal-700 truncate"
            >
              {profile.email}
            </a>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(onViewProfileClick || onContactClick) && (
        <div className="flex gap-2 mb-3">
          {onViewProfileClick && (
            <button
              onClick={() => onViewProfileClick(profile)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors"
            >
              View Profile
            </button>
          )}
          {onContactClick && (
            <button
              onClick={() => onContactClick(profile)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors"
            >
              Contact
            </button>
          )}
        </div>
      )}

    </div>
  );
}

export default ProfilePopup;