'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CommunityCommitmentsContent } from '../CommunityCommitmentsContent';
import { PrivacyPolicyContent } from '../PrivacyPolicyContent';
import { ToSContent } from '../ToSContent';

export type LegalDialog = 'privacy' | 'tos' | 'community';

const legalTitles = {
  privacy: 'Privacy Policy',
  tos: 'Terms of Service',
  community: 'Community Commitments',
} as const;

/**
 * The three legal documents, in their own module because they are ~2k lines of
 * static copy that nobody reads on first paint. `UserAvatarMenu` pulls this in
 * with `next/dynamic` the first time a viewer opens one of them.
 */
export const LegalDialogs = ({
  dialog,
  isOpen,
  onOpenChange,
}: {
  dialog: LegalDialog;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* `initialFocus` on the scroll container, else base-ui focuses the first
          link deep in the legal text and opens the dialog scrolled. */}
      <DialogContent className="p-0 sm:max-w-xl" initialFocus={scrollRef}>
        <DialogHeader>
          <DialogTitle>{t(legalTitles[dialog])}</DialogTitle>
        </DialogHeader>
        <div
          ref={scrollRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-4 outline-none"
        >
          {dialog === 'privacy' ? <PrivacyPolicyContent /> : null}
          {dialog === 'tos' ? <ToSContent /> : null}
          {dialog === 'community' ? <CommunityCommitmentsContent /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
