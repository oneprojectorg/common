'use client';

import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { LuArrowLeft, LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

interface ProposalEditorLayoutProps {
  children: ReactNode;
  backHref: string;
  title: string;
  onSubmitProposal: () => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

export function ProposalEditorLayout({
  children,
  backHref,
  title,
  onSubmitProposal,
  isSubmitting,
  isEditMode = false,
}: ProposalEditorLayoutProps) {
  const router = useRouter();
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-neutral-gray1 grid grid-cols-3 items-center gap-2 border-b px-4 py-4 sm:px-6">
        <button
          onClick={() => router.push(backHref)}
          className="text-primary-teal hover:text-primary-tealBlack flex items-center gap-2"
        >
          <LuArrowLeft className="sm:text-primary-teal text-neutral-charcoal size-6 sm:size-4" />
          <span className="hidden sm:block">Back</span>
        </button>

        <div className="text-neutral-black flex justify-center text-lg font-medium">
          <span className="hidden sm:block">
            {title ? title : 'Untitled Proposal'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-8">
          <Button
            color="primary"
            variant="icon"
            size="small"
            onPress={onSubmitProposal}
            isDisabled={isSubmitting}
            className="px-4 py-2"
          >
            {isSubmitting ? <LoadingSpinner /> : <LuCheck />}
            {isEditMode ? (
              <>
                <span className="inline lg:hidden">{t('Update')}</span>
                <span className="hidden lg:inline">{t('Update Proposal')}</span>
              </>
            ) : (
              <>
                <span className="hidden sm:block">{t('Submit Proposal')}</span>
                <span className="sm:hidden">{t('Submit')}</span>{' '}
              </>
            )}
          </Button>
          <LocaleChooser />
          <UserAvatarMenu className="hidden sm:block" />
        </div>
      </div>

      {children}
    </div>
  );
}
