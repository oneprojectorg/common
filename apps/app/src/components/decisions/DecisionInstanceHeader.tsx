'use client';

import { Avatar } from '@op/ui/Avatar';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface DecisionInstanceHeaderProps {
  backTo: {
    label?: string;
    href: string;
  };
  title: string;
  userAvatar?: {
    src?: string;
    name?: string;
  };
}

export function DecisionInstanceHeader({
  backTo,
  title,
  userAvatar,
}: DecisionInstanceHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-gray1 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <Link
          href={backTo.href}
          className="flex items-center gap-2 text-sm text-primary-teal hover:text-primary-tealBlack"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back {backTo.label ? `to ${backTo.label}` : ''}</span>
        </Link>
      </div>

      <div className="text-center">
        <h1 className="text-lg font-medium text-neutral-charcoal">{title}</h1>
      </div>

      <div className="flex items-center">
        <Avatar className="h-8 w-8" placeholder={userAvatar?.name}>
          {userAvatar?.src && (
            <img
              src={userAvatar.src}
              alt={userAvatar.name || 'User avatar'}
              className="h-full w-full object-cover"
            />
          )}
        </Avatar>
      </div>
    </header>
  );
}
