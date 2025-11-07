'use client';

import { PlatformStats } from './PlatformStats';
import { UsersList } from './UsersList';

export const PlatformAdminScreen = () => {
  return (
    <div className="p-8">
      <PlatformStats />
      <UsersList />
    </div>
  );
};
